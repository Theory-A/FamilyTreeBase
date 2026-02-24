"use client";

import { FamilyNode, AvatarCrop } from "@/types/family";

interface AvatarDisplayProps {
  person: FamilyNode;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  style?: React.CSSProperties;
}

const sizeClasses = {
  sm: "w-8 h-8 text-sm",
  md: "w-10 h-10 text-base",
  lg: "w-12 h-12 text-lg",
  xl: "w-16 h-16 text-xl",
};

/**
 * Generate CSS styles for applying avatar crop
 * The crop coordinates are percentages (0-100)
 */
function getAvatarCropStyles(crop: AvatarCrop): React.CSSProperties {
  // Calculate scale factor to ensure crop area fills container
  const scaleX = 100 / crop.cropWidth;
  const scaleY = 100 / crop.cropHeight;
  const scale = Math.max(scaleX, scaleY);

  // Calculate position to center the crop area
  const offsetX = -(crop.cropX / 100) * scale * 100;
  const offsetY = -(crop.cropY / 100) * scale * 100;

  return {
    objectFit: "none" as const,
    objectPosition: `${-crop.cropX}% ${-crop.cropY}%`,
    transform: `scale(${scale})`,
    transformOrigin: "top left",
    width: "100%",
    height: "100%",
  };
}

export default function AvatarDisplay({
  person,
  size = "md",
  className = "",
  style,
}: AvatarDisplayProps) {
  const isMale = person.gender === "male";
  const isFemale = person.gender === "female";

  // Get initials from Chinese name or pinyin
  const initials = person.names.primary_zh
    ? person.names.primary_zh.charAt(0)
    : person.names.pinyin?.charAt(0).toUpperCase() || "?";

  const gradientClasses = isMale
    ? "from-blue-400 to-blue-600"
    : isFemale
    ? "from-pink-400 to-pink-500"
    : "from-gray-400 to-gray-500";

  const hasAvatar = person.avatar?.croppedUrl;

  return (
    <div
      className={`
        ${sizeClasses[size]}
        rounded-full flex items-center justify-center
        shadow-sm ring-2 ring-white/80
        ${className}
        ${hasAvatar ? "" : `bg-gradient-to-br ${gradientClasses}`}
        overflow-hidden flex-shrink-0
      `}
      style={style}
    >
      {hasAvatar ? (
        <div
          className="w-full h-full"
          style={{
            backgroundImage: `url(${person.avatar!.croppedUrl})`,
            backgroundSize: `${100 / person.avatar!.cropWidth * 100}% ${100 / person.avatar!.cropHeight * 100}%`,
            backgroundPosition: `${person.avatar!.cropX / (100 - person.avatar!.cropWidth) * 100}% ${person.avatar!.cropY / (100 - person.avatar!.cropHeight) * 100}%`,
            backgroundRepeat: "no-repeat",
          }}
          role="img"
          aria-label={person.names.primary_zh || person.names.pinyin}
        />
      ) : (
        <span className={`font-semibold text-white ${person.names.primary_zh ? "font-chinese" : ""}`}>
          {initials}
        </span>
      )}
    </div>
  );
}
