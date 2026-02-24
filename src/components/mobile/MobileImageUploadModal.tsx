"use client";

import { useState, useRef, ChangeEvent, useEffect, useMemo } from "react";
import { FamilyNode } from "@/types/family";
import { ImageMetadata } from "@/types/image";
import { compressImage, formatFileSize, CompressionResult } from "@/lib/imageCompression";
import { pinyin } from "pinyin-pro";
import { useI18n } from "@/lib/i18n";
import {
  getTagRecommendations,
  getUntaggedPeople,
  TagRecommendation,
} from "@/lib/imageRecommendations";

interface MobileImageUploadModalProps {
  nodeId: string;
  allNodes: FamilyNode[];
  onClose: () => void;
  onUploadComplete: (image: ImageMetadata) => void;
}

// Normalize text by removing diacritics/accents for search
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

// Map English relationship names to translation keys
const relationshipKeyMap: Record<string, string> = {
  "Spouse": "relationSpouse",
  "Father": "relationFather",
  "Mother": "relationMother",
  "Parent": "relationParent",
  "Son": "relationSon",
  "Daughter": "relationDaughter",
  "Child": "relationChild",
  "Brother": "relationBrother",
  "Sister": "relationSister",
  "Sibling": "relationSibling",
  "Grandfather": "relationGrandfather",
  "Grandmother": "relationGrandmother",
  "Grandparent": "relationGrandparent",
  "Grandson": "relationGrandson",
  "Granddaughter": "relationGranddaughter",
  "Grandchild": "relationGrandchild",
  "Father-in-law": "relationFatherInLaw",
  "Mother-in-law": "relationMotherInLaw",
  "Parent-in-law": "relationParentInLaw",
  "Brother-in-law": "relationBrotherInLaw",
  "Sister-in-law": "relationSisterInLaw",
  "Sibling-in-law": "relationSiblingInLaw",
  "Uncle": "relationUncle",
  "Aunt": "relationAunt",
  "Aunt/Uncle": "relationAuntUncle",
  "Cousin": "relationCousin",
};

export default function MobileImageUploadModal({
  nodeId,
  allNodes,
  onClose,
  onUploadComplete,
}: MobileImageUploadModalProps) {
  const { t } = useI18n();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [compressing, setCompressing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Upload form state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [compressedBlob, setCompressedBlob] = useState<Blob | null>(null);
  const [compressionInfo, setCompressionInfo] = useState<CompressionResult | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [taggedIds, setTaggedIds] = useState<string[]>([nodeId]);

  // Tag search state
  const [tagSearch, setTagSearch] = useState("");
  const [showTagDropdown, setShowTagDropdown] = useState(false);

  // Helper to get localized relationship label using i18n
  const getRelationshipLabel = (relationship?: string): string => {
    if (!relationship) return "";
    const key = relationshipKeyMap[relationship];
    if (key) {
      // Cast to any since these are dynamic keys
      return (t as (key: string) => string)(key);
    }
    return relationship;
  };

  // Get selected people
  const selectedPeople = useMemo(() => {
    return taggedIds
      .map(id => allNodes.find(n => n.id === id))
      .filter(Boolean) as FamilyNode[];
  }, [taggedIds, allNodes]);

  // Get smart recommendations based on currently tagged people
  const recommendations = useMemo(() => {
    if (taggedIds.length === 0) {
      return getTagRecommendations(nodeId, allNodes, []);
    }
    // Aggregate recommendations from all tagged people
    const allRecs = new Map<string, TagRecommendation>();
    for (const id of taggedIds) {
      const recs = getTagRecommendations(id, allNodes, taggedIds);
      for (const rec of recs) {
        if (!allRecs.has(rec.person.id)) {
          allRecs.set(rec.person.id, rec);
        }
      }
    }
    return Array.from(allRecs.values());
  }, [taggedIds, nodeId, allNodes]);

  // Get all untagged people for search
  const untaggedPeople = useMemo(() => {
    return getUntaggedPeople(allNodes, taggedIds);
  }, [allNodes, taggedIds]);

  // Combine and filter results - show recommendations when not searching
  const filteredPeople = useMemo(() => {
    const query = normalizeText(tagSearch);

    // If searching, filter all untagged people
    if (query) {
      return untaggedPeople
        .filter(person => {
          const zhName = person.names.primary_zh || "";
          const pinyinName = person.names.pinyin || "";
          const zhPinyin = zhName ? pinyin(zhName, { toneType: "none", type: "array" }).join("").toLowerCase() : "";
          const normalized = normalizeText(zhName + " " + pinyinName + " " + zhPinyin);
          return normalized.includes(query);
        })
        .slice(0, 15)
        .map(person => {
          // Check if this person is in recommendations to show relationship
          const rec = recommendations.find(r => r.person.id === person.id);
          return {
            person,
            relationship: rec?.relationship,
            priority: rec?.priority,
          };
        });
    }

    // Otherwise show recommendations first
    return recommendations.slice(0, 12).map(rec => ({
      person: rec.person,
      relationship: rec.relationship,
      priority: rec.priority,
    }));
  }, [tagSearch, recommendations, untaggedPeople]);

  // Cleanup preview URL on unmount
  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

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
      // Compress the image
      const result = await compressImage(file, {
        maxWidth: 2000,
        maxHeight: 2000,
        quality: 0.85,
        maxSizeBytes: 1024 * 1024, // 1MB target
      });

      setCompressedBlob(result.blob);
      setCompressionInfo(result);

      // Create preview URL from compressed blob
      const url = URL.createObjectURL(result.blob);
      setPreviewUrl(url);
    } catch (err) {
      console.error("Compression error:", err);
      // Fall back to original file if compression fails
      setCompressedBlob(null);
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
    setCompressionInfo(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    setTaggedIds([nodeId]);
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

      const response = await fetch("/api/images", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (data.success) {
        onUploadComplete(data.image);
        handleClearSelection();
        onClose();
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

  const handleAddTag = (personId: string) => {
    if (!taggedIds.includes(personId)) {
      setTaggedIds([...taggedIds, personId]);
    }
    setTagSearch("");
    setShowTagDropdown(false);
  };

  const handleRemoveTag = (personId: string) => {
    setTaggedIds(taggedIds.filter(id => id !== personId));
  };

  return (
    <div className="fixed inset-0 z-50 bg-amber-50 flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 bg-white border-b border-amber-200 shadow-sm">
        <button
          onClick={onClose}
          className="p-2 -ml-2 text-gray-600 hover:text-gray-800"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        <h1 className="text-lg font-semibold text-gray-800">
          {t("addPhoto")}
        </h1>
        <button
          onClick={handleUpload}
          disabled={uploading || compressing || taggedIds.length === 0 || !selectedFile}
          className="px-4 py-1.5 bg-amber-500 text-white text-sm font-medium rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {uploading ? t("uploading") : t("uploadPhoto")}
        </button>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Photo Selection */}
        {!selectedFile ? (
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full aspect-video bg-white border-2 border-dashed border-amber-300 rounded-2xl flex flex-col items-center justify-center gap-3 active:bg-amber-50 transition-colors"
          >
            <svg className="w-12 h-12 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
            <span className="text-amber-600 font-medium">
              {t("tapToSelectPhoto")}
            </span>
          </button>
        ) : (
          <div className="relative">
            {compressing ? (
              <div className="w-full aspect-video bg-gray-100 rounded-2xl flex items-center justify-center">
                <div className="flex flex-col items-center gap-2">
                  <div className="w-8 h-8 border-3 border-amber-400 border-t-transparent rounded-full animate-spin" />
                  <span className="text-sm text-gray-500">
                    {t("compressing")}
                  </span>
                </div>
              </div>
            ) : (
              <img
                src={previewUrl!}
                alt="Preview"
                className="w-full rounded-2xl object-contain max-h-64 bg-black/5"
              />
            )}
            <button
              onClick={handleClearSelection}
              disabled={compressing}
              className="absolute top-2 right-2 w-8 h-8 bg-black/50 text-white rounded-full flex items-center justify-center active:bg-black/70"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            {/* Compression info badge */}
            {compressionInfo && compressionInfo.wasResized && (
              <div className="absolute bottom-2 left-2 px-2 py-1 bg-green-500/90 text-white text-xs rounded-full">
                {Math.round((1 - compressionInfo.compressedSize / compressionInfo.originalSize) * 100)}% {t("compressed")}
              </div>
            )}
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="hidden"
        />

        {/* Tagged People */}
        <div className="bg-white rounded-xl border border-amber-200 p-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {t("tagPeople")} <span className="text-red-500">*</span>
          </label>

          {/* Selected tags */}
          {selectedPeople.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {selectedPeople.map(person => {
                const isMale = person.gender === "male";
                const isFemale = person.gender === "female";
                const bgColor = isMale ? "bg-blue-100 text-blue-800" : isFemale ? "bg-pink-100 text-pink-800" : "bg-gray-100 text-gray-800";
                return (
                  <span
                    key={person.id}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-sm font-sans ${bgColor}`}
                  >
                    {person.names.primary_zh || person.names.pinyin}
                    <button
                      onClick={() => handleRemoveTag(person.id)}
                      className="hover:opacity-70"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </span>
                );
              })}
            </div>
          )}

          {/* Search input */}
          <div className="relative">
            <input
              type="text"
              value={tagSearch}
              onChange={(e) => {
                setTagSearch(e.target.value);
                setShowTagDropdown(true);
              }}
              onFocus={() => setShowTagDropdown(true)}
              placeholder={t("searchToAddMore")}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent"
            />

            {/* Dropdown */}
            {showTagDropdown && filteredPeople.length > 0 && (
              <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-auto">
                {/* Section header when showing recommendations */}
                {!tagSearch && (
                  <div className="px-3 py-1.5 text-xs uppercase tracking-wider text-gray-400 bg-gray-50 border-b sticky top-0">
                    {t("suggested")}
                  </div>
                )}
                {filteredPeople.map(item => {
                  const { person, relationship, priority } = item;
                  const isMale = person.gender === "male";
                  const isFemale = person.gender === "female";
                  const textColor = isMale ? "text-blue-700" : isFemale ? "text-pink-700" : "text-gray-700";
                  return (
                    <button
                      key={person.id}
                      onClick={() => handleAddTag(person.id)}
                      className="w-full px-3 py-2 text-left text-sm flex items-center justify-between hover:bg-amber-50 active:bg-amber-100"
                    >
                      <span className={`font-sans ${textColor}`}>
                        {person.names.primary_zh || person.names.pinyin}
                        {person.names.primary_zh && person.names.pinyin && (
                          <span className="text-gray-400 text-xs ml-1">
                            {person.names.pinyin}
                          </span>
                        )}
                      </span>
                      {relationship && (
                        <span className={`text-xs ${
                          priority === "high" ? "text-amber-600" :
                          priority === "medium" ? "text-gray-500" : "text-gray-400"
                        }`}>
                          {getRelationshipLabel(relationship)}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Compression info */}
        {compressionInfo && (
          <div className="text-xs text-gray-500 text-center">
            {compressionInfo.width} × {compressionInfo.height}px
            {compressionInfo.wasResized && (
              <span className="text-green-600 ml-2">
                {formatFileSize(compressionInfo.originalSize)} → {formatFileSize(compressionInfo.compressedSize)}
              </span>
            )}
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}
      </div>
    </div>
  );
}
