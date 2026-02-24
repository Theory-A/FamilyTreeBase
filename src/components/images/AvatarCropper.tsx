"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useI18n } from "@/lib/i18n";
import Portal from "@/components/Portal";

interface AvatarCropperProps {
  imageUrl: string;
  imageId: string;
  nodeId: string;
  initialCrop?: {
    cropX: number;
    cropY: number;
    cropWidth: number;
    cropHeight: number;
  };
  onSave: (crop: {
    cropX: number;
    cropY: number;
    cropWidth: number;
    cropHeight: number;
  }) => void;
  onCancel: () => void;
}

export default function AvatarCropper({
  imageUrl,
  imageId,
  nodeId,
  initialCrop,
  onSave,
  onCancel,
}: AvatarCropperProps) {
  const { t } = useI18n();
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [saving, setSaving] = useState(false);

  // Image natural dimensions
  const [imageSize, setImageSize] = useState({ width: 1, height: 1 });

  // Image position within container (for object-contain letterboxing)
  const [imageBounds, setImageBounds] = useState({ x: 0, y: 0, width: 100, height: 100 });

  // Crop state: x, y are percentages of image; size is percentage of image's SMALLER dimension
  // This ensures cropWidth% of smaller dim = cropHeight% of smaller dim = square pixels
  const [crop, setCrop] = useState(() => {
    if (initialCrop) {
      return {
        cropX: initialCrop.cropX,
        cropY: initialCrop.cropY,
        // Use the smaller of the two as the "size" (they should be equal for square crops)
        size: Math.min(initialCrop.cropWidth, initialCrop.cropHeight),
      };
    }
    return { cropX: 25, cropY: 25, size: 50 };
  });

  // Dragging state
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [cropStart, setCropStart] = useState({ ...crop });

  // Calculate image bounds within container
  const calculateImageBounds = useCallback(() => {
    if (!imageRef.current || !containerRef.current) return;

    const img = imageRef.current;
    const container = containerRef.current;
    const containerRect = container.getBoundingClientRect();

    setImageSize({ width: img.naturalWidth, height: img.naturalHeight });

    const imgAspect = img.naturalWidth / img.naturalHeight;
    const containerAspect = containerRect.width / containerRect.height;

    let imgWidth, imgHeight, imgX, imgY;

    if (imgAspect > containerAspect) {
      // Landscape: width fills, letterbox top/bottom
      imgWidth = containerRect.width;
      imgHeight = containerRect.width / imgAspect;
      imgX = 0;
      imgY = (containerRect.height - imgHeight) / 2;
    } else {
      // Portrait: height fills, letterbox left/right
      imgHeight = containerRect.height;
      imgWidth = containerRect.height * imgAspect;
      imgX = (containerRect.width - imgWidth) / 2;
      imgY = 0;
    }

    setImageBounds({
      x: (imgX / containerRect.width) * 100,
      y: (imgY / containerRect.height) * 100,
      width: (imgWidth / containerRect.width) * 100,
      height: (imgHeight / containerRect.height) * 100,
    });
  }, []);

  const handleImageLoad = useCallback(() => {
    setImageLoaded(true);
    calculateImageBounds();
  }, [calculateImageBounds]);

  useEffect(() => {
    window.addEventListener("resize", calculateImageBounds);
    return () => window.removeEventListener("resize", calculateImageBounds);
  }, [calculateImageBounds]);

  const getContainerRect = useCallback(() => {
    if (!containerRef.current) return null;
    return containerRef.current.getBoundingClientRect();
  }, []);

  // For a square crop on a non-square image:
  // cropWidth (% of image width) and cropHeight (% of image height) differ
  // size% of min(W,H) in pixels = the square side length
  const getCropDimensions = useCallback(() => {
    const aspect = imageSize.width / imageSize.height;
    if (aspect >= 1) {
      // Landscape: height is smaller dimension
      // size% of height = square side in pixels
      // cropHeight = size (% of height)
      // cropWidth = size / aspect (% of width, since width is larger)
      return {
        cropWidth: crop.size / aspect,
        cropHeight: crop.size,
      };
    } else {
      // Portrait: width is smaller dimension
      return {
        cropWidth: crop.size,
        cropHeight: crop.size * aspect,
      };
    }
  }, [crop.size, imageSize]);

  const handleCropMouseDown = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
    setIsDragging(true);
    setDragStart({ x: clientX, y: clientY });
    setCropStart({ ...crop });
  }, [crop]);

  const handleResizeMouseDown = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
    setIsResizing(true);
    setDragStart({ x: clientX, y: clientY });
    setCropStart({ ...crop });
  }, [crop]);

  useEffect(() => {
    const handleMove = (e: MouseEvent | TouchEvent) => {
      if (!isDragging && !isResizing) return;

      const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
      const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;

      const rect = getContainerRect();
      if (!rect) return;

      const deltaXPx = clientX - dragStart.x;
      const deltaYPx = clientY - dragStart.y;

      // Convert to percentage of displayed image
      const imgWidthPx = (imageBounds.width / 100) * rect.width;
      const imgHeightPx = (imageBounds.height / 100) * rect.height;

      const deltaXPercent = (deltaXPx / imgWidthPx) * 100;
      const deltaYPercent = (deltaYPx / imgHeightPx) * 100;

      const { cropWidth, cropHeight } = getCropDimensions();

      if (isDragging) {
        const newX = Math.max(0, Math.min(100 - cropWidth, cropStart.cropX + deltaXPercent));
        const newY = Math.max(0, Math.min(100 - cropHeight, cropStart.cropY + deltaYPercent));
        setCrop(prev => ({ ...prev, cropX: newX, cropY: newY }));
      } else if (isResizing) {
        const aspect = imageSize.width / imageSize.height;

        // Use diagonal movement (average of X and Y) for intuitive corner resize
        const deltaSizePercent = (deltaXPercent + deltaYPercent) / 2;

        // Calculate max size so crop stays within image bounds
        let maxSize: number;
        if (aspect >= 1) {
          // Landscape: size = cropHeight, cropWidth = size/aspect
          // Constraints: cropX + size/aspect <= 100, cropY + size <= 100
          maxSize = Math.min(
            (100 - cropStart.cropX) * aspect,
            100 - cropStart.cropY
          );
        } else {
          // Portrait: size = cropWidth, cropHeight = size*aspect
          // Constraints: cropX + size <= 100, cropY + size*aspect <= 100
          maxSize = Math.min(
            100 - cropStart.cropX,
            (100 - cropStart.cropY) / aspect
          );
        }

        const newSize = Math.max(10, Math.min(maxSize, cropStart.size + deltaSizePercent));
        setCrop(prev => ({ ...prev, size: newSize }));
      }
    };

    const handleEnd = () => {
      setIsDragging(false);
      setIsResizing(false);
    };

    if (isDragging || isResizing) {
      window.addEventListener("mousemove", handleMove);
      window.addEventListener("mouseup", handleEnd);
      window.addEventListener("touchmove", handleMove);
      window.addEventListener("touchend", handleEnd);
    }

    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleEnd);
      window.removeEventListener("touchmove", handleMove);
      window.removeEventListener("touchend", handleEnd);
    };
  }, [isDragging, isResizing, dragStart, cropStart, getContainerRect, imageBounds, imageSize, getCropDimensions]);

  const handleSave = async () => {
    setSaving(true);
    const { cropWidth, cropHeight } = getCropDimensions();
    const cropData = {
      cropX: crop.cropX,
      cropY: crop.cropY,
      cropWidth,
      cropHeight,
    };

    try {
      const response = await fetch(`/api/images/${imageId}/crop`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ node_id: nodeId, ...cropData }),
      });

      const data = await response.json();
      if (data.success) {
        onSave(cropData);
      }
    } catch (error) {
      console.error("Error saving avatar crop:", error);
    } finally {
      setSaving(false);
    }
  };

  // Calculate UI position: crop circle in container coordinates
  const { cropWidth, cropHeight } = getCropDimensions();

  // The circle should be square in the container (same width and height in pixels)
  // Use the smaller dimension of the displayed image as reference
  const displayedImgWidthPx = imageBounds.width;
  const displayedImgHeightPx = imageBounds.height;

  // Size of crop box in container % (should be equal for both to make a circle)
  const cropBoxSize = Math.min(
    (cropWidth / 100) * displayedImgWidthPx,
    (cropHeight / 100) * displayedImgHeightPx
  );

  const cropInContainer = {
    x: imageBounds.x + (crop.cropX / 100) * imageBounds.width,
    y: imageBounds.y + (crop.cropY / 100) * imageBounds.height,
    size: cropBoxSize,
  };

  // Preview coordinates (percentage of full image)
  const previewCrop = { cropX: crop.cropX, cropY: crop.cropY, cropWidth, cropHeight };

  return (
    <Portal>
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70">
        <div className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-800">{t("adjustCrop")}</h3>
          </div>

          <div className="p-4">
            <div
              ref={containerRef}
              className="relative w-full aspect-square bg-gray-900 rounded-lg overflow-hidden select-none"
            >
              <img
                ref={imageRef}
                src={imageUrl}
                alt="Crop preview"
                className="w-full h-full object-contain"
                onLoad={handleImageLoad}
                draggable={false}
              />

              {imageLoaded && (
                <div
                  className="absolute border-2 border-white rounded-full cursor-move"
                  style={{
                    left: `${cropInContainer.x}%`,
                    top: `${cropInContainer.y}%`,
                    width: `${cropInContainer.size}%`,
                    height: `${cropInContainer.size}%`,
                    boxShadow: "0 0 0 9999px rgba(0,0,0,0.6)",
                  }}
                  onMouseDown={handleCropMouseDown}
                  onTouchStart={handleCropMouseDown}
                >
                  <div
                    className="absolute -bottom-2 -right-2 w-5 h-5 bg-white rounded-full border-2 border-amber-500 cursor-se-resize"
                    onMouseDown={handleResizeMouseDown}
                    onTouchStart={handleResizeMouseDown}
                  />
                </div>
              )}
            </div>

            <div className="mt-4 flex items-center gap-4">
              <span className="text-sm text-gray-500">Preview:</span>
              <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-gray-200">
                <div
                  className="w-full h-full"
                  style={{
                    backgroundImage: `url(${imageUrl})`,
                    backgroundSize: `${100 / previewCrop.cropWidth * 100}% ${100 / previewCrop.cropHeight * 100}%`,
                    backgroundPosition: `${previewCrop.cropX / (100 - previewCrop.cropWidth) * 100}% ${previewCrop.cropY / (100 - previewCrop.cropHeight) * 100}%`,
                  }}
                />
              </div>
            </div>
          </div>

          <div className="px-4 py-3 border-t border-gray-200 flex justify-end gap-2">
            <button
              onClick={onCancel}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
            >
              {t("cancelCrop")}
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 bg-amber-500 text-white text-sm font-medium rounded hover:bg-amber-600 disabled:opacity-50"
            >
              {saving ? t("saving") : t("saveCrop")}
            </button>
          </div>
        </div>
      </div>
    </Portal>
  );
}
