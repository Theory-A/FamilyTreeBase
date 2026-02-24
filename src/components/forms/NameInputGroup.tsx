"use client";

import { Names } from "@/types/family";
import { useI18n } from "@/lib/i18n";

interface NameInputGroupProps {
  value: Names;
  onChange: (value: Names) => void;
  errors?: {
    primary_zh?: string;
    pinyin?: string;
  };
}

export default function NameInputGroup({
  value,
  onChange,
  errors,
}: NameInputGroupProps) {
  const { t } = useI18n();

  const handleChange = (field: keyof Names, fieldValue: string) => {
    onChange({
      ...value,
      [field]: fieldValue,
    });
  };

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-sm font-medium text-gray-700">
          {t("chineseName")} <span className="text-red-500">{t("required")}</span>
        </label>
        <input
          type="text"
          value={value.primary_zh || ""}
          onChange={(e) => handleChange("primary_zh", e.target.value)}
          placeholder={t("chineseNamePlaceholder")}
          className={`mt-1 w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent ${
            errors?.primary_zh ? "border-red-500" : "border-gray-300"
          }`}
        />
        {errors?.primary_zh && (
          <p className="mt-1 text-xs text-red-500">{errors.primary_zh}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">
          {t("pinyinEnglishName")}
        </label>
        <input
          type="text"
          value={value.pinyin || ""}
          onChange={(e) => handleChange("pinyin", e.target.value)}
          placeholder={t("pinyinPlaceholder")}
          className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent"
        />
      </div>
    </div>
  );
}
