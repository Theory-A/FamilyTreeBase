"use client";

import { FamilyNode } from "@/types/family";
import { useI18n } from "@/lib/i18n";
import { AvatarDisplay } from "./images";

interface FavoritesBarProps {
  nodes: FamilyNode[];
  favorites: Set<string>;
  onNavigateToNode: (nodeId: string) => void;
  onRemoveFavorite: (nodeId: string) => void;
}

export default function FavoritesBar({
  nodes,
  favorites,
  onNavigateToNode,
  onRemoveFavorite,
}: FavoritesBarProps) {
  const { t } = useI18n();

  // Get the favorite nodes in order
  const favoriteNodes = nodes.filter((node) => favorites.has(node.id));

  if (favoriteNodes.length === 0) {
    return null;
  }

  return (
    <div className="border-b border-amber-200 bg-amber-50/50 px-4 py-1 sm:py-2 flex-shrink-0">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center gap-3">
          <span className="text-xs font-medium text-amber-700 flex items-center gap-1.5">
            <svg
              className="w-4 h-4"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
            {t("favorites")}
          </span>
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {favoriteNodes.map((node) => {
              const isMale = node.gender === "male";
              const isFemale = node.gender === "female";
              const borderColor = isMale
                ? "border-blue-300"
                : isFemale
                ? "border-pink-300"
                : "border-gray-300";
              const bgColor = isMale
                ? "bg-blue-50 hover:bg-blue-100"
                : isFemale
                ? "bg-pink-50 hover:bg-pink-100"
                : "bg-gray-50 hover:bg-gray-100";

              return (
                <div
                  key={node.id}
                  className={`
                    group relative flex items-center gap-1.5 px-2 py-1 rounded-full border
                    ${borderColor} ${bgColor} transition-colors cursor-pointer
                  `}
                  onClick={() => onNavigateToNode(node.id)}
                >
                  {node.avatar && (
                    <AvatarDisplay person={node} size="sm" className="flex-shrink-0 w-5 h-5" />
                  )}
                  <span className={`text-xs font-medium text-gray-700 whitespace-nowrap ${node.names.primary_zh ? "font-chinese" : ""}`}>
                    {node.names.primary_zh || node.names.pinyin}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveFavorite(node.id);
                    }}
                    className="ml-0.5 p-0.5 rounded-full text-gray-400 hover:text-red-500 hover:bg-white/50 opacity-0 group-hover:opacity-100 transition-opacity"
                    title={t("removeFromFavorites")}
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
