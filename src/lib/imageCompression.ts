/**
 * Client-side image compression using Canvas API
 */

export interface CompressionResult {
  blob: Blob;
  width: number;
  height: number;
  originalSize: number;
  compressedSize: number;
  wasResized: boolean;
}

export interface CompressionOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number; // 0-1, for JPEG/WebP
  maxSizeBytes?: number; // Target max file size
}

const DEFAULT_OPTIONS: Required<CompressionOptions> = {
  maxWidth: 2000,
  maxHeight: 2000,
  quality: 0.85,
  maxSizeBytes: 1024 * 1024, // 1MB target
};

/**
 * Load an image from a File object
 */
function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

/**
 * Calculate new dimensions while maintaining aspect ratio
 */
function calculateDimensions(
  width: number,
  height: number,
  maxWidth: number,
  maxHeight: number
): { width: number; height: number; scaled: boolean } {
  if (width <= maxWidth && height <= maxHeight) {
    return { width, height, scaled: false };
  }

  const aspectRatio = width / height;

  let newWidth = width;
  let newHeight = height;

  if (width > maxWidth) {
    newWidth = maxWidth;
    newHeight = maxWidth / aspectRatio;
  }

  if (newHeight > maxHeight) {
    newHeight = maxHeight;
    newWidth = maxHeight * aspectRatio;
  }

  return {
    width: Math.round(newWidth),
    height: Math.round(newHeight),
    scaled: true,
  };
}

/**
 * Compress an image file
 */
export async function compressImage(
  file: File,
  options: CompressionOptions = {}
): Promise<CompressionResult> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const originalSize = file.size;

  // Load the image
  const img = await loadImage(file);
  const originalWidth = img.width;
  const originalHeight = img.height;

  // Calculate target dimensions
  const { width, height, scaled } = calculateDimensions(
    originalWidth,
    originalHeight,
    opts.maxWidth,
    opts.maxHeight
  );

  // Create canvas
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Failed to get canvas context");
  }

  // Draw image with high quality
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, width, height);

  // Clean up the object URL
  URL.revokeObjectURL(img.src);

  // Determine output format
  // Use WebP if supported (better compression), fallback to JPEG
  const outputType = file.type === "image/png" ? "image/png" : "image/jpeg";

  // Convert to blob with quality setting
  let quality = opts.quality;
  let blob = await canvasToBlob(canvas, outputType, quality);

  // If still too large and not PNG, try reducing quality further
  if (blob.size > opts.maxSizeBytes && outputType !== "image/png") {
    const qualitySteps = [0.7, 0.5, 0.3];
    for (const q of qualitySteps) {
      if (blob.size <= opts.maxSizeBytes) break;
      quality = q;
      blob = await canvasToBlob(canvas, outputType, quality);
    }
  }

  return {
    blob,
    width,
    height,
    originalSize,
    compressedSize: blob.size,
    wasResized: scaled || blob.size < originalSize,
  };
}

/**
 * Convert canvas to blob
 */
function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error("Failed to convert canvas to blob"));
        }
      },
      type,
      quality
    );
  });
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export interface ThumbnailResult {
  blob: Blob;
  width: number;
  height: number;
}

/**
 * Generate a thumbnail from an image file
 * Target: ~200px on longest side, JPEG quality 0.7
 */
export async function generateThumbnail(
  file: File,
  maxSize: number = 200
): Promise<ThumbnailResult> {
  const img = await loadImage(file);
  const originalWidth = img.width;
  const originalHeight = img.height;

  // Calculate dimensions to fit within maxSize
  const { width, height } = calculateDimensions(
    originalWidth,
    originalHeight,
    maxSize,
    maxSize
  );

  // Create canvas
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Failed to get canvas context");
  }

  // Draw with high quality
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, width, height);

  // Clean up object URL
  URL.revokeObjectURL(img.src);

  // Always output JPEG for thumbnails (good compression, widely supported)
  const blob = await canvasToBlob(canvas, "image/jpeg", 0.7);

  return {
    blob,
    width,
    height,
  };
}
