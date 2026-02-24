"use client";

import { useState, useEffect } from "react";
import { ImageMetadata } from "@/types/image";
import { FamilyNode } from "@/types/family";
import { useI18n } from "@/lib/i18n";
import ImageModal from "./ImageModal";

interface ImageGalleryProps {
  nodeId: string;
  allNodes: FamilyNode[];
  isEditing?: boolean;
  hasAvatar?: boolean;
  onSetAvatar?: (imageId: string) => void;
}

export default function ImageGallery({
  nodeId,
  allNodes,
  isEditing = false,
  hasAvatar = false,
  onSetAvatar,
}: ImageGalleryProps) {
  const { t } = useI18n();
  const [images, setImages] = useState<ImageMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const selectedImage = selectedIndex !== null ? images[selectedIndex] : null;

  // Fetch images for this node
  useEffect(() => {
    const fetchImages = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/images?node_id=${nodeId}`);
        const data = await response.json();

        if (data.success) {
          setImages(data.images || []);
        } else {
          setError(data.error || "Failed to load images");
        }
      } catch (err) {
        setError("Failed to load images");
        console.error("Error fetching images:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchImages();
  }, [nodeId]);

  const handleImageUpdate = (updatedImage: ImageMetadata) => {
    setImages(prev =>
      prev.map(img => (img.id === updatedImage.id ? updatedImage : img))
    );
  };

  const handleImageDelete = (imageId: string) => {
    setImages(prev => prev.filter(img => img.id !== imageId));
    setSelectedIndex(null);
  };

  const handleNavigate = (index: number) => {
    setSelectedIndex(index);
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <div className="w-4 h-4 border-2 border-amber-300 border-t-transparent rounded-full animate-spin" />
        <span>{t("loading")}</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-sm text-red-500">{error}</div>
    );
  }

  if (images.length === 0) {
    return (
      <div className="text-sm text-gray-400 italic">{t("noPhotos")}</div>
    );
  }

  return (
    <>
      <div className="flex gap-2 flex-wrap">
        {images.map((image, index) => (
          <button
            key={image.id}
            onClick={() => setSelectedIndex(index)}
            className="relative w-16 h-16 rounded-lg overflow-hidden border-2 border-gray-200 hover:border-amber-400 transition-colors cursor-pointer group"
          >
            <img
              src={image.thumbnail_url || image.storage_url}
              alt={image.caption || "Family photo"}
              className="w-full h-full object-cover"
              loading="lazy"
            />
            {/* Overlay on hover */}
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
            {/* Tag count badge */}
            {image.tagged_node_ids.length > 1 && (
              <span className="absolute bottom-0.5 right-0.5 bg-black/60 text-white text-[10px] px-1 rounded">
                +{image.tagged_node_ids.length - 1}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Image Modal with Carousel */}
      {selectedImage && selectedIndex !== null && (
        <ImageModal
          image={selectedImage}
          images={images}
          currentIndex={selectedIndex}
          allNodes={allNodes}
          currentNodeId={nodeId}
          isEditing={isEditing}
          onClose={() => setSelectedIndex(null)}
          onUpdate={handleImageUpdate}
          onDelete={handleImageDelete}
          onSetAvatar={onSetAvatar}
          onNavigate={handleNavigate}
          hasAvatar={hasAvatar}
        />
      )}
    </>
  );
}
