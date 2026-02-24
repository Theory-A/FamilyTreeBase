"use client";

import { useEffect } from "react";
import { FamilyNode } from "@/types/family";
import { ImageMetadata } from "@/types/image";
import { useI18n } from "@/lib/i18n";
import Portal from "@/components/Portal";
import ImageUploader from "./ImageUploader";

interface ImageUploadModalProps {
  nodeId: string;
  allNodes: FamilyNode[];
  onClose: () => void;
  onUploadComplete: (image: ImageMetadata) => void;
}

export default function ImageUploadModal({
  nodeId,
  allNodes,
  onClose,
  onUploadComplete,
}: ImageUploadModalProps) {
  const { t } = useI18n();

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const handleUploadComplete = (image: ImageMetadata) => {
    onUploadComplete(image);
    onClose();
  };

  return (
    <Portal>
      <div className="fixed inset-0 z-[100] flex items-center justify-center">
        {/* Backdrop */}
        <div
          className="absolute inset-0 bg-black/50"
          onClick={onClose}
        />

        {/* Modal */}
        <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">
              {t("addPhoto")}
            </h3>
            <button
              onClick={onClose}
              className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Content */}
          <div className="p-5">
            <ImageUploader
              nodeId={nodeId}
              allNodes={allNodes}
              onUploadComplete={handleUploadComplete}
            />
          </div>
        </div>
      </div>
    </Portal>
  );
}
