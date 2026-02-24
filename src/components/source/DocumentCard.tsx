"use client";

import { SourceDocument } from "@/types/source";
import { useI18n } from "@/lib/i18n";

interface DocumentCardProps {
  document: SourceDocument;
  onClick: () => void;
}

export default function DocumentCard({ document, onClick }: DocumentCardProps) {
  const { t } = useI18n();

  const formatDate = (dateStr: string | undefined, isApprox?: boolean) => {
    if (!dateStr) return null;
    const prefix = isApprox ? "~" : "";
    // Handle YYYY, YYYY-MM, or YYYY-MM-DD formats
    if (dateStr.length === 4) return `${prefix}${dateStr}`;
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return `${prefix}${dateStr}`;
    return `${prefix}${date.getFullYear()}`;
  };

  return (
    <button
      onClick={onClick}
      className="group block w-full text-left bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-lg hover:border-amber-300 transition-all duration-200"
    >
      {/* Thumbnail */}
      <div className="aspect-[4/3] relative overflow-hidden bg-gray-100">
        <img
          src={document.thumbnail_url || document.storage_url}
          alt={document.title}
          className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          loading="lazy"
        />
        {/* Overlay gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

        {/* View icon on hover */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center shadow-lg">
            <svg
              className="w-6 h-6 text-amber-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7"
              />
            </svg>
          </div>
        </div>
      </div>

      {/* Info */}
      <div className="p-4">
        <h3 className="font-medium text-gray-900 line-clamp-2 mb-1 group-hover:text-amber-700 transition-colors">
          {document.title}
        </h3>
        {document.document_date && (
          <p className="text-sm text-gray-500">
            {formatDate(document.document_date, document.is_approximate_date)}
          </p>
        )}
        {document.source_location && (
          <p className="text-xs text-gray-400 mt-1 truncate">
            {document.source_location}
          </p>
        )}
      </div>
    </button>
  );
}
