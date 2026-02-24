"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { FilterSettings, ChannelMode } from "@/types/source";

interface MagnifierProps {
  imageRef: React.RefObject<HTMLImageElement | null>;
  containerRef: React.RefObject<HTMLDivElement | null>;
  zoom: number;
  lensSize: number;
  filters: FilterSettings;
  mode: "lens" | "fixed";
  // For lens mode: current position in content coordinates (includes scroll)
  position?: { x: number; y: number };
  // For lens mode: callback when position changes via drag
  onPositionChange?: (pos: { x: number; y: number }) => void;
  // For fixed mode: custom size for preview boxes
  fixedSize?: number;
}

// ============================================================================
// Image Processing Utilities
// ============================================================================

/**
 * Clamp a value between 0 and 255
 */
function clamp(value: number): number {
  return Math.max(0, Math.min(255, value));
}

/**
 * Convert RGB to luminance using Rec.601 coefficients
 */
function luminance(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

/**
 * Apply gamma correction to image data
 * gamma < 1 darkens midtones (useful for faded documents)
 * gamma > 1 lightens midtones
 */
function applyGamma(data: Uint8ClampedArray, gamma: number): void {
  if (gamma === 1) return;
  const invGamma = 1 / gamma;
  // Build lookup table for performance
  const lut = new Uint8Array(256);
  for (let i = 0; i < 256; i++) {
    lut[i] = clamp(255 * Math.pow(i / 255, invGamma));
  }
  for (let i = 0; i < data.length; i += 4) {
    data[i] = lut[data[i]];
    data[i + 1] = lut[data[i + 1]];
    data[i + 2] = lut[data[i + 2]];
  }
}

/**
 * Apply channel isolation or boost
 * 'red' - useful for revealing red seals while suppressing black ink
 * 'blue' - penetrates iron gall ink better, counteracts yellowed paper
 * 'green' - general purpose, highest luminance contribution
 */
function applyChannelMode(data: Uint8ClampedArray, mode: ChannelMode): void {
  if (mode === 'none') return;

  for (let i = 0; i < data.length; i += 4) {
    let value: number;
    switch (mode) {
      case 'red':
        value = data[i];
        break;
      case 'green':
        value = data[i + 1];
        break;
      case 'blue':
        // Boost blue channel to counteract yellow paper
        // Yellow = high R + high G, low B
        // We boost blue and reduce the yellow cast
        value = clamp(data[i + 2] * 1.3 + 20);
        break;
      default:
        value = luminance(data[i], data[i + 1], data[i + 2]);
    }
    data[i] = value;
    data[i + 1] = value;
    data[i + 2] = value;
  }
}

/**
 * Separable box blur - O(n) regardless of radius
 * Uses sliding window sum technique
 */
function boxBlur(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  radius: number
): Uint8ClampedArray {
  const output = new Uint8ClampedArray(data.length);
  const windowSize = radius * 2 + 1;

  // Horizontal pass
  for (let y = 0; y < height; y++) {
    for (let c = 0; c < 3; c++) {
      let sum = 0;
      // Initialize window
      for (let x = -radius; x <= radius; x++) {
        const xi = Math.max(0, Math.min(width - 1, x));
        sum += data[(y * width + xi) * 4 + c];
      }

      for (let x = 0; x < width; x++) {
        output[(y * width + x) * 4 + c] = sum / windowSize;

        // Slide window
        const leftX = Math.max(0, Math.min(width - 1, x - radius));
        const rightX = Math.max(0, Math.min(width - 1, x + radius + 1));
        sum -= data[(y * width + leftX) * 4 + c];
        sum += data[(y * width + rightX) * 4 + c];
      }
    }
    // Copy alpha
    for (let x = 0; x < width; x++) {
      output[(y * width + x) * 4 + 3] = data[(y * width + x) * 4 + 3];
    }
  }

  // Vertical pass (in place on output)
  const temp = new Uint8ClampedArray(output.length);
  for (let x = 0; x < width; x++) {
    for (let c = 0; c < 3; c++) {
      let sum = 0;
      // Initialize window
      for (let y = -radius; y <= radius; y++) {
        const yi = Math.max(0, Math.min(height - 1, y));
        sum += output[(yi * width + x) * 4 + c];
      }

      for (let y = 0; y < height; y++) {
        temp[(y * width + x) * 4 + c] = sum / windowSize;

        // Slide window
        const topY = Math.max(0, Math.min(height - 1, y - radius));
        const bottomY = Math.max(0, Math.min(height - 1, y + radius + 1));
        sum -= output[(topY * width + x) * 4 + c];
        sum += output[(bottomY * width + x) * 4 + c];
      }
    }
    // Copy alpha
    for (let y = 0; y < height; y++) {
      temp[(y * width + x) * 4 + 3] = output[(y * width + x) * 4 + 3];
    }
  }

  return temp;
}

/**
 * Unsharp masking - enhances edges by subtracting blurred version
 * enhanced = original + amount * (original - blurred)
 */
function applyUnsharpMask(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  amount: number,
  radius: number
): void {
  if (amount <= 0) return;

  // Create blurred version (3 box blurs approximate Gaussian per CLT)
  let blurred = boxBlur(data, width, height, radius);
  blurred = boxBlur(blurred, width, height, radius);
  blurred = boxBlur(blurred, width, height, radius);

  // Apply unsharp mask
  for (let i = 0; i < data.length; i += 4) {
    for (let c = 0; c < 3; c++) {
      const original = data[i + c];
      const blur = blurred[i + c];
      data[i + c] = clamp(original + amount * (original - blur));
    }
  }
}

/**
 * Build integral images for efficient local mean/variance computation
 * Returns [integralSum, integralSumSq] for O(1) window queries
 */
function buildIntegralImages(
  data: Uint8ClampedArray,
  width: number,
  height: number
): [Float64Array, Float64Array] {
  const integral = new Float64Array(width * height);
  const integralSq = new Float64Array(width * height);

  for (let y = 0; y < height; y++) {
    let rowSum = 0;
    let rowSumSq = 0;

    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      const pixelIdx = idx * 4;
      const lum = luminance(data[pixelIdx], data[pixelIdx + 1], data[pixelIdx + 2]);

      rowSum += lum;
      rowSumSq += lum * lum;

      integral[idx] = rowSum + (y > 0 ? integral[idx - width] : 0);
      integralSq[idx] = rowSumSq + (y > 0 ? integralSq[idx - width] : 0);
    }
  }

  return [integral, integralSq];
}

/**
 * Query integral image for sum in rectangle [x1,y1] to [x2,y2] inclusive
 */
function integralQuery(
  integral: Float64Array,
  width: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number
): number {
  // Clamp coordinates
  x1 = Math.max(0, x1);
  y1 = Math.max(0, y1);
  x2 = Math.min(width - 1, x2);
  y2 = Math.min(integral.length / width - 1, y2);

  const A = (y1 > 0 && x1 > 0) ? integral[(y1 - 1) * width + (x1 - 1)] : 0;
  const B = (y1 > 0) ? integral[(y1 - 1) * width + x2] : 0;
  const C = (x1 > 0) ? integral[y2 * width + (x1 - 1)] : 0;
  const D = integral[y2 * width + x2];

  return D - B - C + A;
}

/**
 * Sauvola adaptive thresholding
 * threshold(x,y) = mean * (1 + k * (stddev / R - 1))
 * Much better than global threshold for documents with uneven illumination
 */
function applySauvolaThreshold(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  k: number,
  windowRadius: number,
  R: number = 128
): void {
  const [integral, integralSq] = buildIntegralImages(data, width, height);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const x1 = x - windowRadius;
      const y1 = y - windowRadius;
      const x2 = x + windowRadius;
      const y2 = y + windowRadius;

      // Clamp window to image bounds
      const clampedX1 = Math.max(0, x1);
      const clampedY1 = Math.max(0, y1);
      const clampedX2 = Math.min(width - 1, x2);
      const clampedY2 = Math.min(height - 1, y2);

      const count = (clampedX2 - clampedX1 + 1) * (clampedY2 - clampedY1 + 1);

      const sum = integralQuery(integral, width, x1, y1, x2, y2);
      const sumSq = integralQuery(integralSq, width, x1, y1, x2, y2);

      const mean = sum / count;
      const variance = Math.max(0, (sumSq / count) - (mean * mean));
      const stddev = Math.sqrt(variance);

      // Sauvola formula
      const threshold = mean * (1 + k * (stddev / R - 1));

      const idx = (y * width + x) * 4;
      const lum = luminance(data[idx], data[idx + 1], data[idx + 2]);
      const value = lum > threshold ? 255 : 0;

      data[idx] = value;
      data[idx + 1] = value;
      data[idx + 2] = value;
    }
  }
}

/**
 * Global threshold (simple binarization)
 */
function applyGlobalThreshold(
  data: Uint8ClampedArray,
  threshold: number
): void {
  const thresholdValue = threshold * 255;

  for (let i = 0; i < data.length; i += 4) {
    const lum = luminance(data[i], data[i + 1], data[i + 2]);
    const value = lum > thresholdValue ? 255 : 0;
    data[i] = value;
    data[i + 1] = value;
    data[i + 2] = value;
  }
}

// ============================================================================
// Magnifier Component
// ============================================================================

export default function Magnifier({
  imageRef,
  containerRef,
  zoom,
  lensSize,
  filters,
  mode,
  position,
  onPositionChange,
  fixedSize = 200,
}: MagnifierProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const size = mode === "fixed" ? fixedSize : lensSize;
  const radius = size / 2;

  // Drag state for lens mode
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const positionStartRef = useRef<{ x: number; y: number } | null>(null);

  /**
   * Apply all pixel-level filters to image data
   */
  const applyPixelFilters = useCallback(
    (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, filters: FilterSettings) => {
      try {
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        const width = canvas.width;
        const height = canvas.height;

        // 1. Gamma correction (applied early, before other adjustments)
        if (filters.gamma !== 1) {
          applyGamma(data, filters.gamma);
        }

        // 2. Channel isolation/boost
        if (filters.channelMode !== 'none') {
          applyChannelMode(data, filters.channelMode);
        }

        // 3. Unsharp masking (edge enhancement)
        if (filters.unsharpAmount > 0) {
          applyUnsharpMask(data, width, height, filters.unsharpAmount, filters.unsharpRadius);
        }

        // 4. Thresholding (binarization) - applied last
        if (filters.threshold > 0) {
          if (filters.adaptiveThreshold) {
            applySauvolaThreshold(data, width, height, filters.adaptiveK, filters.adaptiveRadius);
          } else {
            applyGlobalThreshold(data, filters.threshold);
          }
        }

        ctx.putImageData(imageData, 0, 0);
      } catch {
        // Canvas may be tainted by cross-origin image, skip pixel filters
      }
    },
    []
  );

  // Draw the magnified view
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const image = imageRef.current;
    const container = containerRef.current;
    if (!canvas || !image || !container || !position) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, size, size);

    // Get image position relative to container's content (not viewport)
    // The image is inside a centered div with padding
    const imageRect = image.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();

    // Image position relative to container viewport
    const imageLeftInViewport = imageRect.left - containerRect.left;
    const imageTopInViewport = imageRect.top - containerRect.top;

    // Image position in content coordinates (accounting for scroll)
    const imageLeft = imageLeftInViewport + container.scrollLeft;
    const imageTop = imageTopInViewport + container.scrollTop;

    // Position is already in content coordinates
    const mouseOnImageX = position.x - imageLeft;
    const mouseOnImageY = position.y - imageTop;

    // Check if position is over the image
    if (
      mouseOnImageX < 0 ||
      mouseOnImageY < 0 ||
      mouseOnImageX > imageRect.width ||
      mouseOnImageY > imageRect.height
    ) {
      // Draw placeholder when outside image
      ctx.fillStyle = "#374151";
      ctx.fillRect(0, 0, size, size);
      ctx.fillStyle = "#9CA3AF";
      ctx.font = "12px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Outside image", size / 2, size / 2);
      return;
    }

    // Calculate the source area from the natural image
    const scaleX = image.naturalWidth / imageRect.width;
    const scaleY = image.naturalHeight / imageRect.height;

    const sourceX = mouseOnImageX * scaleX;
    const sourceY = mouseOnImageY * scaleY;

    const sourceWidth = (size / zoom) * scaleX;
    const sourceHeight = (size / zoom) * scaleY;

    ctx.save();

    // Circular clip for lens mode, square for fixed mode
    if (mode === "lens") {
      ctx.beginPath();
      ctx.arc(radius, radius, radius, 0, Math.PI * 2);
      ctx.clip();
    }

    // Apply CSS filters for brightness, contrast, grayscale, invert
    // (gamma, channel mode, unsharp, and thresholding are applied via pixel manipulation)
    const filterString = [
      `brightness(${filters.brightness})`,
      `contrast(${filters.contrast})`,
      `grayscale(${filters.grayscale})`,
      `invert(${filters.invert})`,
    ].join(" ");
    ctx.filter = filterString;

    // Draw the zoomed portion
    ctx.drawImage(
      image,
      sourceX - sourceWidth / 2,
      sourceY - sourceHeight / 2,
      sourceWidth,
      sourceHeight,
      0,
      0,
      size,
      size
    );

    ctx.filter = "none";

    // Apply pixel-level filters (gamma, channel mode, unsharp mask, thresholding)
    const hasPixelFilters =
      filters.gamma !== 1 ||
      filters.channelMode !== 'none' ||
      filters.unsharpAmount > 0 ||
      filters.threshold > 0;

    if (hasPixelFilters) {
      applyPixelFilters(ctx, canvas, filters);
    }

    ctx.restore();

    // Draw border
    if (mode === "lens") {
      ctx.beginPath();
      ctx.arc(radius, radius, radius - 2, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(255, 255, 255, 0.9)";
      ctx.lineWidth = 3;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(radius, radius, radius - 1, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(0, 0, 0, 0.3)";
      ctx.lineWidth = 1;
      ctx.stroke();

      // Crosshair
      ctx.strokeStyle = "rgba(255, 255, 255, 0.5)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(radius - 10, radius);
      ctx.lineTo(radius + 10, radius);
      ctx.moveTo(radius, radius - 10);
      ctx.lineTo(radius, radius + 10);
      ctx.stroke();
    } else {
      ctx.strokeStyle = "rgba(255, 255, 255, 0.5)";
      ctx.lineWidth = 2;
      ctx.strokeRect(1, 1, size - 2, size - 2);
    }
  }, [imageRef, containerRef, position, zoom, filters, applyPixelFilters, size, radius, mode]);

  useEffect(() => {
    draw();
  }, [draw]);

  // Handle drag for lens mode
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (mode !== "lens") return;
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(true);
      dragStartRef.current = { x: e.clientX, y: e.clientY };
      positionStartRef.current = position || { x: 0, y: 0 };
    },
    [mode, position]
  );

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging || !dragStartRef.current || !positionStartRef.current || !onPositionChange) return;

      const dx = e.clientX - dragStartRef.current.x;
      const dy = e.clientY - dragStartRef.current.y;

      onPositionChange({
        x: positionStartRef.current.x + dx,
        y: positionStartRef.current.y + dy,
      });
    },
    [isDragging, onPositionChange]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    dragStartRef.current = null;
    positionStartRef.current = null;
  }, []);

  // Global mouse listeners for drag
  useEffect(() => {
    if (mode !== "lens") return;

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [mode, handleMouseMove, handleMouseUp]);

  // For fixed mode, render without positioning
  if (mode === "fixed") {
    return (
      <canvas
        ref={canvasRef}
        className="pointer-events-none rounded"
        style={{
          width: size,
          height: size,
        }}
      />
    );
  }

  // Lens mode: calculate position for rendering
  const container = containerRef.current;
  if (!container || !position) return null;

  // Position in content coordinates (absolute positioning in scrollable container
  // is relative to content, not viewport)
  const lensX = position.x - radius;
  const lensY = position.y - radius;

  return (
    <canvas
      ref={canvasRef}
      className={`absolute shadow-2xl rounded-full ${isDragging ? "cursor-grabbing" : "cursor-grab"}`}
      style={{
        width: size,
        height: size,
        left: lensX,
        top: lensY,
        boxShadow: "0 0 20px rgba(0, 0, 0, 0.5), inset 0 0 10px rgba(255, 255, 255, 0.1)",
        pointerEvents: "auto",
      }}
      onMouseDown={handleMouseDown}
    />
  );
}
