"use client";

import { DateInfo } from "@/types/family";
import { useI18n } from "@/lib/i18n";

interface DateInputProps {
  label: string;
  value?: DateInfo;
  onChange: (value: DateInfo | undefined) => void;
  required?: boolean;
}

// Format date string: convert dots to dashes, pad single digits with zeros
function formatDateString(input: string): string {
  if (!input) return input;

  // Replace dots with dashes
  let formatted = input.replace(/\./g, "-");

  // Match date patterns and pad single digits
  // Handles: YYYY, YYYY-M, YYYY-MM, YYYY-M-D, YYYY-MM-D, YYYY-M-DD, YYYY-MM-DD
  const match = formatted.match(/^(\d{4})(?:-(\d{1,2})(?:-(\d{1,2}))?)?$/);
  if (match) {
    const [, year, month, day] = match;
    let result = year;
    if (month) {
      result += `-${month.padStart(2, "0")}`;
      if (day) {
        result += `-${day.padStart(2, "0")}`;
      }
    }
    return result;
  }

  return formatted;
}

export default function DateInput({
  label,
  value,
  onChange,
  required = false,
}: DateInputProps) {
  const { t } = useI18n();

  const handleDateChange = (dateStr: string) => {
    if (!dateStr) {
      onChange(undefined);
      return;
    }
    onChange({
      date_iso: dateStr,
      is_approximate: value?.is_approximate || false,
    });
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const formatted = formatDateString(e.target.value);
    if (formatted !== e.target.value) {
      handleDateChange(formatted);
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pastedText = e.clipboardData.getData("text");
    const formatted = formatDateString(pastedText);
    if (formatted !== pastedText) {
      e.preventDefault();
      handleDateChange(formatted);
    }
  };

  const handleApproximateChange = (checked: boolean) => {
    if (!value?.date_iso) return;
    onChange({
      ...value,
      is_approximate: checked,
    });
  };

  const handleClear = () => {
    onChange(undefined);
  };

  return (
    <div className="space-y-1">
      <label className="block text-sm font-medium text-gray-700">
        {label}
        {required && <span className="text-red-500 ml-1">{t("required")}</span>}
      </label>
      <div className="flex items-center gap-2">
        <input
          type="text"
          placeholder={t("datePlaceholder")}
          value={value?.date_iso || ""}
          onChange={(e) => handleDateChange(e.target.value)}
          onBlur={handleBlur}
          onPaste={handlePaste}
          className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent"
          pattern="\d{4}(-\d{2}(-\d{2})?)?"
        />
        {value?.date_iso && (
          <button
            type="button"
            onClick={handleClear}
            className="px-2 py-2 text-gray-400 hover:text-gray-600"
            title={t("cancel")}
          >
            ✕
          </button>
        )}
      </div>
      {value?.date_iso && (
        <label className="flex items-center gap-2 text-sm text-gray-600">
          <input
            type="checkbox"
            checked={value.is_approximate || false}
            onChange={(e) => handleApproximateChange(e.target.checked)}
            className="rounded border-gray-300 text-amber-500 focus:ring-amber-400"
          />
          {t("approximateDate")}
        </label>
      )}
    </div>
  );
}
