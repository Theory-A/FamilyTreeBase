"use client";

import { FamilyNode } from "@/types/family";

interface PersonAvatarProps {
  person: FamilyNode;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}

export default function PersonAvatar({ person, size = "md", className = "" }: PersonAvatarProps) {
  const isMale = person.gender === "male";
  const isFemale = person.gender === "female";

  // Get initials from Chinese name or pinyin
  const initials = person.names.primary_zh
    ? person.names.primary_zh.charAt(0)
    : person.names.pinyin?.charAt(0).toUpperCase() || "?";

  const sizeClasses = {
    sm: "w-8 h-8 text-sm",
    md: "w-12 h-12 text-lg",
    lg: "w-16 h-16 text-2xl",
    xl: "w-24 h-24 text-3xl",
  };

  const gradientClasses = isMale
    ? "from-blue-400 to-blue-600"
    : isFemale
    ? "from-pink-400 to-pink-500"
    : "from-gray-400 to-gray-500";

  // Check if person has an avatar (new system) or legacy image
  const avatarUrl = person.avatar?.croppedUrl;
  const legacyImageUrl = person.biography?.images?.[0]?.url;
  const imageUrl = avatarUrl || legacyImageUrl;

  return (
    <div
      className={`
        ${sizeClasses[size]}
        rounded-full flex items-center justify-center
        shadow-md ring-2 ring-white/80
        ${className}
        ${imageUrl ? "" : `bg-gradient-to-br ${gradientClasses}`}
        overflow-hidden flex-shrink-0
      `}
    >
      {imageUrl ? (
        person.avatar ? (
          // New avatar system with crop parameters - use background-image for precise positioning
          <div
            className="w-full h-full"
            style={{
              backgroundImage: `url(${imageUrl})`,
              backgroundSize: `${100 / person.avatar.cropWidth * 100}% ${100 / person.avatar.cropHeight * 100}%`,
              backgroundPosition: `${person.avatar.cropX / (100 - person.avatar.cropWidth) * 100}% ${person.avatar.cropY / (100 - person.avatar.cropHeight) * 100}%`,
              backgroundRepeat: "no-repeat",
            }}
            role="img"
            aria-label={person.names.primary_zh || person.names.pinyin}
          />
        ) : (
          // Legacy image without crop - simple object-cover
          <img
            src={imageUrl}
            alt={person.names.primary_zh || person.names.pinyin}
            className="w-full h-full object-cover"
          />
        )
      ) : (
        <span className={`font-semibold text-white ${person.names.primary_zh ? "font-chinese" : ""}`}>
          {initials}
        </span>
      )}
    </div>
  );
}
