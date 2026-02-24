"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { SourceDocument, FilterPreset, FILTER_PRESETS } from "@/types/source";
import { useI18n } from "@/lib/i18n";
import Portal from "@/components/Portal";
import Magnifier from "./Magnifier";

// Preset labels for display
const PRESET_LABELS: Record<FilterPreset, string> = {
  original: "Original",
  "faded-ink": "Faded Ink",
  "yellowed-paper": "Yellowed",
  "high-contrast": "High Contrast",
  "photo-negative": "Negative",
  handwriting: "Handwriting",
};

const ALL_PRESETS: FilterPreset[] = [
  "original",
  "faded-ink",
  "yellowed-paper",
  "high-contrast",
  "photo-negative",
  "handwriting",
];

interface DocumentViewerProps {
  document: SourceDocument;
  onClose: () => void;
  onUpdate: (doc: SourceDocument) => void;
  onDelete: (id: string) => void;
}

export default function DocumentViewer({
  document,
  onClose,
  onUpdate,
  onDelete,
}: DocumentViewerProps) {
  const { t } = useI18n();
  const imageRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Magnifier state
  const magnifierEnabled = true; // Always enabled
  const [zoom, setZoom] = useState(2.5);
  const lensSize = 300; // Fixed lens size
  // Lens position in content coordinates (stays fixed when scrolling)
  const [lensPosition, setLensPosition] = useState<{ x: number; y: number } | null>(null);
  // Track scroll position for re-rendering
  const [scrollPos, setScrollPos] = useState({ x: 0, y: 0 });
  // Track if image is loaded
  const [imageLoaded, setImageLoaded] = useState(false);
  // Preview box size (calculated from window height)
  const [previewSize, setPreviewSize] = useState(180);

  // Edit state
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(document.title);
  const [editDate, setEditDate] = useState(document.document_date || "");
  const [editNotes, setEditNotes] = useState(document.source_notes || "");
  const [editLocation, setEditLocation] = useState(document.source_location || "");
  const [saving, setSaving] = useState(false);

  // Delete confirmation
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Calculate preview box size based on available space
  const previewColumnRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const calculatePreviewSize = () => {
      const column = previewColumnRef.current;
      if (!column) return;

      // Get available dimensions (accounting for padding: p-3 = 12px, pb-6 = 24px)
      const rect = column.getBoundingClientRect();
      const verticalPadding = 12 + 24; // top + bottom padding
      const horizontalPadding = 24; // left + right padding
      const availableHeight = rect.height - verticalPadding;
      const availableWidth = rect.width - horizontalPadding;

      // 3 rows, 2 columns - find the max size that fits
      // Account for labels (~20px each) and gaps (8px between rows/cols)
      const labelHeight = 20;
      const gap = 8;
      const maxByHeight = Math.floor((availableHeight - (labelHeight * 3) - (gap * 2)) / 3);
      const maxByWidth = Math.floor((availableWidth - gap) / 2);

      const size = Math.max(80, Math.min(maxByHeight, maxByWidth));
      setPreviewSize(size);
    };

    // Initial calculation after a short delay to ensure layout is complete
    const timer = setTimeout(calculatePreviewSize, 100);

    window.addEventListener("resize", calculatePreviewSize);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("resize", calculatePreviewSize);
    };
  }, [imageLoaded, magnifierEnabled]);

  // Initialize lens position when image loads
  useEffect(() => {
    if (!imageLoaded) return;

    const image = imageRef.current;
    const container = containerRef.current;
    if (!image || !container) return;

    const imageRect = image.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();

    // Position lens at center of visible image
    const imageLeftInViewport = imageRect.left - containerRect.left;
    const imageTopInViewport = imageRect.top - containerRect.top;

    // Convert to content coordinates
    const centerX = imageLeftInViewport + container.scrollLeft + imageRect.width / 2;
    const centerY = imageTopInViewport + container.scrollTop + Math.min(imageRect.height / 2, containerRect.height / 2);

    setLensPosition({ x: centerX, y: centerY });
  }, [imageLoaded]);

  // Track scroll position
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      setScrollPos({ x: container.scrollLeft, y: container.scrollTop });
    };

    container.addEventListener("scroll", handleScroll);
    return () => container.removeEventListener("scroll", handleScroll);
  }, []);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (isEditing) {
          setIsEditing(false);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, isEditing]);

  // Handle lens position change from drag
  const handleLensPositionChange = useCallback((pos: { x: number; y: number }) => {
    setLensPosition(pos);
  }, []);

  // Handle click on document to snap magnifier to that position
  const handleContainerClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!magnifierEnabled || !containerRef.current) return;

    const container = containerRef.current;
    const rect = container.getBoundingClientRect();

    // Calculate position in content coordinates (including scroll)
    const x = e.clientX - rect.left + container.scrollLeft;
    const y = e.clientY - rect.top + container.scrollTop;

    setLensPosition({ x, y });
  }, [magnifierEnabled]);

  // Error state for user feedback
  const [saveError, setSaveError] = useState<string | null>(null);

  // Save edits
  const handleSave = async () => {
    if (!editTitle.trim()) return;

    setSaving(true);
    setSaveError(null);
    try {
      const response = await fetch(`/api/sources/${document.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editTitle.trim(),
          document_date: editDate || null,
          source_notes: editNotes.trim() || null,
          source_location: editLocation.trim() || null,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMsg = errorData.error || `Server error: ${response.status}`;
        console.error("Save failed:", response.status, errorData);
        setSaveError(errorMsg);
        return;
      }

      const data = await response.json();
      if (data.success) {
        onUpdate(data.document);
        setIsEditing(false);
      } else {
        console.error("Save failed:", data.error);
        setSaveError(data.error || "Unknown error");
      }
    } catch (error) {
      console.error("Error saving document:", error);
      setSaveError("Network error - check console");
    } finally {
      setSaving(false);
    }
  };

  // Delete document
  const handleDelete = async () => {
    setDeleting(true);
    try {
      const response = await fetch(`/api/sources/${document.id}`, {
        method: "DELETE",
      });

      const data = await response.json();
      if (data.success) {
        onDelete(document.id);
      }
    } catch (error) {
      console.error("Error deleting document:", error);
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const formatDate = (dateStr: string | undefined) => {
    if (!dateStr) return null;
    return dateStr;
  };

  // Use scrollPos in dependency to trigger re-renders
  void scrollPos;

  return (
    <Portal>
      <div
        className="fixed inset-0 z-[100] flex bg-black/80"
        onClick={onClose}
      >
        <div
          className="flex flex-col md:flex-row w-full h-full"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Main image area - scrollable, left-aligned, doesn't grow beyond content */}
          <div
            ref={containerRef}
            className="relative overflow-auto bg-gray-900 select-none flex-shrink-0 cursor-crosshair"
            style={{ maxWidth: '50vw' }}
            onClick={handleContainerClick}
          >
            <div className="min-h-full flex items-start justify-start p-4">
              <img
                ref={imageRef}
                src={document.storage_url}
                alt={document.title}
                className="w-auto h-auto"
                crossOrigin="anonymous"
                draggable={false}
                onLoad={() => setImageLoaded(true)}
              />
            </div>

            {/* Draggable magnifier lens */}
            {magnifierEnabled && lensPosition && imageLoaded && (
              <Magnifier
                imageRef={imageRef}
                containerRef={containerRef}
                position={lensPosition}
                onPositionChange={handleLensPositionChange}
                zoom={zoom}
                lensSize={lensSize}
                filters={FILTER_PRESETS.original}
                mode="lens"
              />
            )}
          </div>

          {/* Filter preview column - 6 presets in 2x3 grid, flex-grow to fill space */}
          {magnifierEnabled && lensPosition && imageLoaded && (
            <div
              ref={previewColumnRef}
              className="hidden md:flex flex-col bg-gray-800 p-3 pb-6 flex-1 min-w-0 overflow-hidden"
            >
              <div className="grid grid-cols-2 gap-2 h-full overflow-hidden">
                {ALL_PRESETS.map((preset) => (
                  <div key={preset} className="flex flex-col items-center justify-center">
                    <div className="text-xs text-gray-400 text-center mb-1">
                      {PRESET_LABELS[preset]}
                    </div>
                    <Magnifier
                      imageRef={imageRef}
                      containerRef={containerRef}
                      position={lensPosition}
                      zoom={zoom}
                      lensSize={lensSize}
                      filters={FILTER_PRESETS[preset]}
                      mode="fixed"
                      fixedSize={previewSize}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Side panel */}
          <div className="w-full md:w-80 bg-white flex flex-col max-h-[40vh] md:max-h-full overflow-hidden flex-shrink-0">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50">
              <h2 className="font-semibold text-gray-800 truncate pr-4">
                {document.title}
              </h2>
              <button
                onClick={onClose}
                className="p-1 text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-6">
              {/* Metadata section */}
              {isEditing ? (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs uppercase tracking-wider text-gray-500 mb-1">
                      {t("documentTitle")}
                    </label>
                    <input
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-amber-400"
                    />
                  </div>

                  <div>
                    <label className="block text-xs uppercase tracking-wider text-gray-500 mb-1">
                      {t("documentDate")}
                    </label>
                    <input
                      type="date"
                      value={editDate}
                      onChange={(e) => setEditDate(e.target.value)}
                      className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-amber-400"
                    />
                  </div>

                  <div>
                    <label className="block text-xs uppercase tracking-wider text-gray-500 mb-1">
                      {t("sourceLocation")}
                    </label>
                    <input
                      type="text"
                      value={editLocation}
                      onChange={(e) => setEditLocation(e.target.value)}
                      className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-amber-400"
                    />
                  </div>

                  <div>
                    <label className="block text-xs uppercase tracking-wider text-gray-500 mb-1">
                      {t("sourceNotes")}
                    </label>
                    <textarea
                      value={editNotes}
                      onChange={(e) => setEditNotes(e.target.value)}
                      rows={4}
                      className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none"
                    />
                  </div>

                  {saveError && (
                    <p className="text-sm text-red-600 bg-red-50 px-2 py-1 rounded">
                      {saveError}
                    </p>
                  )}

                  <div className="flex gap-2">
                    <button
                      onClick={handleSave}
                      disabled={saving || !editTitle.trim()}
                      className="flex-1 px-3 py-1.5 bg-amber-500 text-white text-sm font-medium rounded hover:bg-amber-600 disabled:opacity-50"
                    >
                      {saving ? t("saving") : t("saveChanges")}
                    </button>
                    <button
                      onClick={() => {
                        setIsEditing(false);
                        setSaveError(null);
                        setEditTitle(document.title);
                        setEditDate(document.document_date || "");
                        setEditNotes(document.source_notes || "");
                        setEditLocation(document.source_location || "");
                      }}
                      className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800"
                    >
                      {t("cancel")}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs uppercase tracking-wider text-gray-500">
                      Document Info
                    </span>
                    <button
                      onClick={() => setIsEditing(true)}
                      className="text-xs text-amber-600 hover:text-amber-700"
                    >
                      {t("edit")}
                    </button>
                  </div>

                  {document.document_date && (
                    <div>
                      <span className="text-xs text-gray-500">{t("documentDate")}</span>
                      <p className="text-sm text-gray-800">
                        {formatDate(document.document_date)}
                      </p>
                    </div>
                  )}

                  {document.source_location && (
                    <div>
                      <span className="text-xs text-gray-500">{t("sourceLocation")}</span>
                      <p className="text-sm text-gray-800">{document.source_location}</p>
                    </div>
                  )}

                  {document.source_notes && (
                    <div>
                      <span className="text-xs text-gray-500">{t("sourceNotes")}</span>
                      <p className="text-sm text-gray-800 whitespace-pre-wrap">
                        {document.source_notes}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Divider */}
              <hr className="border-gray-200" />

              {/* Magnifier controls */}
              <div className="space-y-3">
                <span className="text-xs uppercase tracking-wider text-gray-500">
                  {t("magnifier")}
                </span>
                <p className="text-xs text-gray-500">
                  Click or drag the lens to inspect different areas.
                </p>

                {/* Zoom control */}
                <div>
                  <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                    <span>{t("zoom")}</span>
                    <span>{zoom.toFixed(1)}x</span>
                  </div>
                  <input
                    type="range"
                    min="1.5"
                    max="6"
                    step="0.5"
                    value={zoom}
                    onChange={(e) => setZoom(parseFloat(e.target.value))}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-amber-500"
                  />
                </div>
              </div>

              {/* Upload info */}
              <div className="text-xs text-gray-400 pt-4 border-t border-gray-200">
                <p>Uploaded: {new Date(document.uploaded_at).toLocaleDateString()}</p>
                {document.file_size && (
                  <p>Size: {(document.file_size / 1024 / 1024).toFixed(2)} MB</p>
                )}
              </div>
            </div>

            {/* Footer with delete - pushed to bottom */}
            {!isEditing && (
              <div className="px-4 py-3 border-t border-gray-200 bg-gray-50 mt-auto">
                {showDeleteConfirm ? (
                  <div className="flex gap-2">
                    <button
                      onClick={handleDelete}
                      disabled={deleting}
                      className="flex-1 px-3 py-1.5 bg-red-500 text-white text-sm font-medium rounded hover:bg-red-600 disabled:opacity-50"
                    >
                      {deleting ? t("deleting") : t("confirmDelete")}
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
                    className="text-xs text-gray-400 hover:text-red-500 transition-colors"
                  >
                    {t("deleteDocument")}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </Portal>
  );
}
