"use client";

import { Attributes } from "@/types/family";
import { useI18n } from "@/lib/i18n";

interface AttributesEditorProps {
  value: Attributes;
  onChange: (value: Attributes) => void;
}

export default function AttributesEditor({
  value,
  onChange,
}: AttributesEditorProps) {
  const { t } = useI18n();

  const handleNoteChange = (note: string) => {
    onChange({ ...value, note: note || undefined });
  };

  const handleDescriptionChange = (description: string) => {
    onChange({ ...value, description: description || undefined });
  };

  const handleLinkChange = (link: string) => {
    onChange({ ...value, link: link || undefined });
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700">
          {t("link")} <span className="text-gray-400">{t("optional")}</span>
        </label>
        <div className="mt-1 flex items-center gap-2">
          <input
            type="url"
            value={(value.link as string) || ""}
            onChange={(e) => handleLinkChange(e.target.value)}
            placeholder={t("linkPlaceholder")}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent"
          />
          {value.link && (
            <a
              href={value.link as string}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 text-gray-500 hover:text-amber-600 transition-colors"
              title={t("viewLink")}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          )}
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">
          {t("notes")} <span className="text-gray-400">{t("optional")}</span>
        </label>
        <input
          type="text"
          value={(value.note as string) || ""}
          onChange={(e) => handleNoteChange(e.target.value)}
          placeholder={t("notesPlaceholder")}
          className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">
          {t("description")} <span className="text-gray-400">{t("optional")}</span>
        </label>
        <textarea
          value={(value.description as string) || ""}
          onChange={(e) => handleDescriptionChange(e.target.value)}
          rows={4}
          placeholder={t("descriptionPlaceholder")}
          className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent resize-none"
        />
      </div>
    </div>
  );
}
