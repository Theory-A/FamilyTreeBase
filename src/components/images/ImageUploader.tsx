"use client";

import { useState, useRef, DragEvent, ChangeEvent } from "react";
import { FamilyNode } from "@/types/family";
import { ImageMetadata } from "@/types/image";
import { useI18n } from "@/lib/i18n";
import { compressImage, formatFileSize, CompressionResult, generateThumbnail, ThumbnailResult } from "@/lib/imageCompression";
import ImageTagSelector from "./ImageTagSelector";

interface ImageUploaderProps {
  nodeId: string;
  allNodes: FamilyNode[];
  onUploadComplete: (image: ImageMetadata) => void;
}

export default function ImageUploader({
  nodeId,
  allNodes,
  onUploadComplete,
}: ImageUploaderProps) {
  const { t } = useI18n();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [compressing, setCompressing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Upload form state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [compressedBlob, setCompressedBlob] = useState<Blob | null>(null);
  const [thumbnailBlob, setThumbnailBlob] = useState<Blob | null>(null);
  const [compressionInfo, setCompressionInfo] = useState<CompressionResult | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [taggedIds, setTaggedIds] = useState<string[]>([nodeId]);
  const [caption, setCaption] = useState("");
  const [dateTaken, setDateTaken] = useState("");
  const [isApproximate, setIsApproximate] = useState(false);

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("image/")) {
      selectFile(file);
    } else {
      setError("Please drop an image file");
    }
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      selectFile(file);
    }
  };

  const selectFile = async (file: File) => {
    setSelectedFile(file);
    setError(null);
    setCompressing(true);

    try {
      // Compress the image and generate thumbnail in parallel
      const [compressionResult, thumbnailResult] = await Promise.all([
        compressImage(file, {
          maxWidth: 2000,
          maxHeight: 2000,
          quality: 0.85,
          maxSizeBytes: 1024 * 1024, // 1MB target
        }),
        generateThumbnail(file, 200),
      ]);

      setCompressedBlob(compressionResult.blob);
      setThumbnailBlob(thumbnailResult.blob);
      setCompressionInfo(compressionResult);

      // Create preview URL from compressed blob
      const url = URL.createObjectURL(compressionResult.blob);
      setPreviewUrl(url);
    } catch (err) {
      console.error("Compression error:", err);
      // Fall back to original file if compression fails
      setCompressedBlob(null);
      setThumbnailBlob(null);
      setCompressionInfo(null);
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    } finally {
      setCompressing(false);
    }
  };

  const handleClearSelection = () => {
    setSelectedFile(null);
    setCompressedBlob(null);
    setThumbnailBlob(null);
    setCompressionInfo(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    setTaggedIds([nodeId]);
    setCaption("");
    setDateTaken("");
    setIsApproximate(false);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || taggedIds.length === 0) return;

    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();

      // Use compressed blob if available, otherwise original file
      const fileToUpload = compressedBlob
        ? new File([compressedBlob], selectedFile.name, { type: compressedBlob.type })
        : selectedFile;

      formData.append("file", fileToUpload);
      formData.append("tagged_node_ids", JSON.stringify(taggedIds));
      if (caption) formData.append("caption", caption);
      if (dateTaken) formData.append("date_taken", dateTaken);
      formData.append("is_approximate_date", String(isApproximate));

      // Append thumbnail if available
      if (thumbnailBlob) {
        const thumbName = selectedFile.name.replace(/\.[^.]+$/, "_thumb.jpg");
        const thumbnailFile = new File([thumbnailBlob], thumbName, { type: "image/jpeg" });
        formData.append("thumbnail", thumbnailFile);
      }

      const response = await fetch("/api/images", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (data.success) {
        onUploadComplete(data.image);
        handleClearSelection();
      } else {
        setError(data.error || t("uploadFailed"));
      }
    } catch (err) {
      console.error("Upload error:", err);
      setError(t("uploadFailed"));
    } finally {
      setUploading(false);
    }
  };

  // If no file selected, show dropzone
  if (!selectedFile) {
    return (
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`
          border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors
          ${isDragging
            ? "border-amber-400 bg-amber-50"
            : "border-gray-300 hover:border-amber-400 hover:bg-amber-50/50"
          }
        `}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="hidden"
        />
        <svg
          className="w-10 h-10 mx-auto text-gray-400 mb-2"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
        <p className="text-sm text-gray-500">{t("dragDropPhoto")}</p>
        {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
      </div>
    );
  }

  // Show upload form with preview
  return (
    <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
      {/* Preview */}
      <div className="flex gap-4 mb-4">
        <div className="relative w-24 h-24 flex-shrink-0">
          {compressing ? (
            <div className="w-full h-full rounded-lg bg-gray-200 flex items-center justify-center">
              <div className="w-6 h-6 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <img
              src={previewUrl!}
              alt="Preview"
              className="w-full h-full object-cover rounded-lg"
            />
          )}
          <button
            onClick={handleClearSelection}
            disabled={compressing}
            className="absolute -top-2 -right-2 w-5 h-5 bg-gray-500 text-white rounded-full flex items-center justify-center hover:bg-gray-600 disabled:opacity-50"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          {/* Compression info badge */}
          {compressionInfo && compressionInfo.wasResized && (
            <div className="absolute -bottom-1 -left-1 px-1.5 py-0.5 bg-green-500 text-white text-[10px] rounded-full">
              {Math.round((1 - compressionInfo.compressedSize / compressionInfo.originalSize) * 100)}% smaller
            </div>
          )}
        </div>

        <div className="flex-1 space-y-3">
          {/* Tag people */}
          <div>
            <label className="block text-xs uppercase tracking-wider text-gray-500 mb-1">
              {t("taggedPeople")} <span className="text-red-500">*</span>
            </label>
            <ImageTagSelector
              allNodes={allNodes}
              selectedIds={taggedIds}
              currentNodeId={nodeId}
              onChange={setTaggedIds}
            />
          </div>
        </div>
      </div>

      {/* Additional fields */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <label className="block text-xs uppercase tracking-wider text-gray-500 mb-1">
            {t("photoCaption")}
          </label>
          <input
            type="text"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder={t("captionPlaceholder")}
            className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-amber-400"
          />
        </div>
        <div>
          <label className="block text-xs uppercase tracking-wider text-gray-500 mb-1">
            {t("dateTaken")}
          </label>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={dateTaken}
              onChange={(e) => setDateTaken(e.target.value)}
              className="flex-1 px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
            <label className="flex items-center gap-1 text-xs text-gray-600 whitespace-nowrap">
              <input
                type="checkbox"
                checked={isApproximate}
                onChange={(e) => setIsApproximate(e.target.checked)}
                className="rounded"
              />
              ~
            </label>
          </div>
        </div>
      </div>

      {/* Compression info */}
      {compressionInfo && (
        <div className="mb-3 text-xs text-gray-500 flex items-center gap-2">
          <span>{compressionInfo.width} × {compressionInfo.height}px</span>
          <span>•</span>
          {compressionInfo.wasResized ? (
            <span className="text-green-600">
              {formatFileSize(compressionInfo.originalSize)} → {formatFileSize(compressionInfo.compressedSize)}
            </span>
          ) : (
            <span>{formatFileSize(compressionInfo.compressedSize)}</span>
          )}
        </div>
      )}

      {/* Error message */}
      {error && (
        <p className="mb-4 text-sm text-red-500">{error}</p>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={handleUpload}
          disabled={uploading || compressing || taggedIds.length === 0}
          className="flex-1 px-4 py-2 bg-amber-500 text-white text-sm font-medium rounded hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {(uploading || compressing) && (
            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          )}
          {compressing ? "Compressing..." : uploading ? t("uploading") : t("uploadPhoto")}
        </button>
        <button
          onClick={handleClearSelection}
          disabled={uploading}
          className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
        >
          {t("cancel")}
        </button>
      </div>
    </div>
  );
}
