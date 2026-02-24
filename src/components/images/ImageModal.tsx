"use client";

import { useState, useEffect, useCallback } from "react";
import { ImageMetadata } from "@/types/image";
import { FamilyNode } from "@/types/family";
import { useI18n } from "@/lib/i18n";
import Portal from "@/components/Portal";
import ImageTagSelector from "./ImageTagSelector";
import { PersonAvatar } from "@/components/mobile";

interface ImageModalProps {
  image: ImageMetadata;
  images: ImageMetadata[];
  currentIndex: number;
  allNodes: FamilyNode[];
  currentNodeId: string;
  isEditing?: boolean;
  onClose: () => void;
  onUpdate: (image: ImageMetadata) => void;
  onDelete: (imageId: string) => void;
  onSetAvatar?: (imageId: string) => void;
  onNavigate: (index: number) => void;
  hasAvatar?: boolean;
}

export default function ImageModal({
  image,
  images,
  currentIndex,
  allNodes,
  currentNodeId,
  isEditing = false,
  onClose,
  onUpdate,
  onDelete,
  onSetAvatar,
  onNavigate,
  hasAvatar = false,
}: ImageModalProps) {
  const { t } = useI18n();
  const [isEditingTags, setIsEditingTags] = useState(false);
  const [taggedIds, setTaggedIds] = useState<string[]>(image.tagged_node_ids);
  const [caption, setCaption] = useState(image.caption || "");
  const [dateTaken, setDateTaken] = useState(image.date_taken || "");
  const [isApproximate, setIsApproximate] = useState(image.is_approximate_date || false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < images.length - 1;

  // Sync local state when image changes (e.g., via carousel navigation)
  useEffect(() => {
    setTaggedIds(image.tagged_node_ids);
    setCaption(image.caption || "");
    setDateTaken(image.date_taken || "");
    setIsApproximate(image.is_approximate_date || false);
    setIsEditingTags(false);
  }, [image.id]);

  const goToPrev = useCallback(() => {
    if (hasPrev) {
      onNavigate(currentIndex - 1);
    }
  }, [hasPrev, currentIndex, onNavigate]);

  const goToNext = useCallback(() => {
    if (hasNext) {
      onNavigate(currentIndex + 1);
    }
  }, [hasNext, currentIndex, onNavigate]);

  // Keyboard navigation: Escape to close, arrows to navigate
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        e.stopPropagation();
        goToPrev();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        e.stopPropagation();
        goToNext();
      }
    };
    // Use capture phase to intercept events before they reach other handlers
    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [onClose, goToPrev, goToNext]);

  // Get tagged people objects
  const getTaggedPeople = useCallback(() => {
    return taggedIds
      .map(id => allNodes.find(n => n.id === id))
      .filter((node): node is FamilyNode => Boolean(node));
  }, [taggedIds, allNodes]);

  const handleSave = async () => {
    if (taggedIds.length === 0) return;

    setSaving(true);
    try {
      const response = await fetch(`/api/images/${image.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tagged_node_ids: taggedIds,
          caption: caption || null,
          date_taken: dateTaken || null,
          is_approximate_date: isApproximate,
        }),
      });

      const data = await response.json();
      if (data.success) {
        onUpdate(data.image);
        setIsEditingTags(false);
      }
    } catch (error) {
      console.error("Error saving image:", error);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const response = await fetch(`/api/images/${image.id}`, {
        method: "DELETE",
      });

      const data = await response.json();
      if (data.success) {
        onDelete(image.id);
      }
    } catch (error) {
      console.error("Error deleting image:", error);
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const handleSetAsAvatar = () => {
    if (onSetAvatar) {
      onSetAvatar(image.id);
    }
  };

  return (
    <Portal>
      <div
        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70"
        onClick={onClose}
      >
        <div
          className="bg-white rounded-lg shadow-xl max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-800">
            {image.caption || t("photos")}
          </h3>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex flex-col md:flex-row overflow-hidden">
          {/* Image with navigation */}
          <div className="flex-1 bg-gray-900 flex items-center justify-center min-h-[300px] md:min-h-[400px] relative">
            {/* Previous button */}
            {hasPrev && (
              <button
                onClick={(e) => { e.stopPropagation(); goToPrev(); }}
                className="absolute left-2 top-1/2 -translate-y-1/2 z-10 p-2 bg-black/50 hover:bg-black/70 text-white rounded-full transition-colors"
                aria-label="Previous image"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            )}

            <img
              src={image.storage_url}
              alt={image.caption || "Family photo"}
              className="max-w-full max-h-[60vh] object-contain"
            />

            {/* Next button */}
            {hasNext && (
              <button
                onClick={(e) => { e.stopPropagation(); goToNext(); }}
                className="absolute right-2 top-1/2 -translate-y-1/2 z-10 p-2 bg-black/50 hover:bg-black/70 text-white rounded-full transition-colors"
                aria-label="Next image"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            )}

            {/* Image counter */}
            {images.length > 1 && (
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 px-3 py-1 bg-black/60 text-white text-sm rounded-full">
                {currentIndex + 1} / {images.length}
              </div>
            )}
          </div>

          {/* Info Panel */}
          <div className="w-full md:w-80 p-4 overflow-y-auto bg-gray-50">
            {/* Tagged People - always editable */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs uppercase tracking-wider text-gray-500">
                  {t("taggedPeople")}
                </label>
                {!isEditingTags && (
                  <button
                    onClick={() => setIsEditingTags(true)}
                    className="text-xs text-amber-600 hover:text-amber-700"
                  >
                    {t("edit")}
                  </button>
                )}
              </div>
              {isEditingTags ? (
                <>
                  <ImageTagSelector
                    allNodes={allNodes}
                    selectedIds={taggedIds}
                    currentNodeId={currentNodeId}
                    onChange={setTaggedIds}
                  />
                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={handleSave}
                      disabled={saving || taggedIds.length === 0}
                      className="flex-1 px-3 py-1.5 bg-amber-500 text-white text-sm font-medium rounded hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {saving ? t("saving") : t("saveChanges")}
                    </button>
                    <button
                      onClick={() => {
                        setTaggedIds(image.tagged_node_ids);
                        setCaption(image.caption || "");
                        setDateTaken(image.date_taken || "");
                        setIsApproximate(image.is_approximate_date || false);
                        setIsEditingTags(false);
                      }}
                      className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800"
                    >
                      {t("cancel")}
                    </button>
                  </div>
                </>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {getTaggedPeople().map((person) => (
                    <div key={person.id} className="flex flex-col items-center">
                      <PersonAvatar person={person} size="sm" />
                      <span className="text-[10px] text-gray-500 mt-0.5 max-w-[48px] truncate text-center">
                        {person.names.primary_zh || person.names.pinyin}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Caption */}
            {isEditingTags ? (
              <div className="mb-4">
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
            ) : image.caption ? (
              <div className="mb-4">
                <label className="block text-xs uppercase tracking-wider text-gray-500 mb-1">
                  {t("photoCaption")}
                </label>
                <p className="text-sm text-gray-700">{image.caption}</p>
              </div>
            ) : null}

            {/* Date Taken */}
            {isEditingTags ? (
              <div className="mb-4">
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
                  <label className="flex items-center gap-1 text-xs text-gray-600">
                    <input
                      type="checkbox"
                      checked={isApproximate}
                      onChange={(e) => setIsApproximate(e.target.checked)}
                      className="rounded"
                    />
                    {t("approximateDate")}
                  </label>
                </div>
              </div>
            ) : image.date_taken ? (
              <div className="mb-4">
                <label className="block text-xs uppercase tracking-wider text-gray-500 mb-1">
                  {t("dateTaken")}
                </label>
                <p className="text-sm text-gray-700">
                  {image.is_approximate_date && `${t("approx")} `}
                  {image.date_taken}
                </p>
              </div>
            ) : null}

            {/* Actions */}
            <div className="mt-6 pt-4 border-t border-gray-200 space-y-2">
              {/* Set as Avatar - always visible */}
              {onSetAvatar && !isEditingTags && (
                <button
                  onClick={handleSetAsAvatar}
                  className="w-full px-3 py-1.5 bg-blue-50 text-blue-700 text-sm font-medium rounded hover:bg-blue-100"
                >
                  {hasAvatar ? t("replaceAvatar") : t("setAsAvatar")}
                </button>
              )}

              {/* Delete photo - always visible */}
              {!isEditingTags && (
                <>
                  {showDeleteConfirm ? (
                    <div className="flex gap-2">
                      <button
                        onClick={handleDelete}
                        disabled={deleting}
                        className="flex-1 px-3 py-1.5 bg-red-500 text-white text-sm font-medium rounded hover:bg-red-600 disabled:opacity-50"
                      >
                        {deleting ? t("deleting") : t("delete")}
                      </button>
                      <button
                        onClick={() => setShowDeleteConfirm(false)}
                        className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800"
                      >
                        {t("cancel")}
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setShowDeleteConfirm(true)}
                      className="w-full px-3 py-1.5 text-sm text-red-600 hover:text-red-700 hover:bg-red-50 rounded"
                    >
                      {t("deletePhoto")}
                    </button>
                  )}
                </>
              )}
            </div>

            {/* Upload info */}
            <div className="mt-4 pt-4 border-t border-gray-200 text-xs text-gray-400">
              <p>Uploaded: {new Date(image.uploaded_at).toLocaleDateString()}</p>
              {image.file_size && (
                <p>Size: {(image.file_size / 1024 / 1024).toFixed(2)} MB</p>
              )}
            </div>
          </div>
        </div>
        </div>
      </div>
    </Portal>
  );
}
