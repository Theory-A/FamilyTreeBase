"use client";

import { Gender } from "@/types/family";
import { useI18n } from "@/lib/i18n";

interface GenderSelectorProps {
  value: Gender;
  onChange: (value: Gender) => void;
}

export default function GenderSelector({
  value,
  onChange,
}: GenderSelectorProps) {
  const { t } = useI18n();

  const options: { value: Gender; labelKey: "male" | "female" }[] = [
    { value: "male", labelKey: "male" },
    { value: "female", labelKey: "female" },
  ];

  return (
    <div className="space-y-1">
      <label className="block text-sm font-medium text-gray-700">
        {t("gender")} <span className="text-red-500">{t("required")}</span>
      </label>
      <div className="flex gap-3">
        {options.map((option) => {
          const isSelected = value === option.value;
          const baseStyles = "px-4 py-2 rounded-md text-sm font-medium border-2 transition-all cursor-pointer";
          const selectedStyles = {
            male: "border-blue-400 bg-blue-50 text-blue-700",
            female: "border-pink-400 bg-pink-50 text-pink-700",
            unknown: "border-gray-400 bg-gray-50 text-gray-700",
          };
          const unselectedStyles = "border-gray-200 bg-white text-gray-500 hover:border-gray-300";

          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              className={`${baseStyles} ${
                isSelected ? selectedStyles[option.value] : unselectedStyles
              }`}
            >
              {t(option.labelKey)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
