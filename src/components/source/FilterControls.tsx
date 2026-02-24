"use client";

import { FilterSettings, FilterPreset, ChannelMode } from "@/types/source";
import { useI18n } from "@/lib/i18n";

interface FilterControlsProps {
  filters: FilterSettings;
  activePreset: FilterPreset;
  onPresetChange: (preset: FilterPreset) => void;
  onFilterChange: <K extends keyof FilterSettings>(key: K, value: FilterSettings[K]) => void;
}

// Type for translation keys - using Parameters to extract the key type from t function
type TranslationKey = Parameters<ReturnType<typeof useI18n>["t"]>[0];

interface PresetInfo {
  key: FilterPreset;
  labelKey: TranslationKey;
  icon: React.ReactNode;
}

const presets: PresetInfo[] = [
  {
    key: "original",
    labelKey: "presetOriginal",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    key: "faded-ink",
    labelKey: "presetFadedInk",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
      </svg>
    ),
  },
  {
    key: "yellowed-paper",
    labelKey: "presetYellowedPaper",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  },
  {
    key: "high-contrast",
    labelKey: "presetHighContrast",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
    ),
  },
  {
    key: "photo-negative",
    labelKey: "presetPhotoNegative",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
      </svg>
    ),
  },
  {
    key: "handwriting",
    labelKey: "presetHandwriting",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
      </svg>
    ),
  },
];

// Slider configuration - only numeric filter settings
type NumericFilterKey = {
  [K in keyof FilterSettings]: FilterSettings[K] extends number ? K : never;
}[keyof FilterSettings];

interface SliderInfo {
  key: NumericFilterKey;
  labelKey: TranslationKey;
  min: number;
  max: number;
  step: number;
  defaultValue: number;
  formatValue?: (v: number) => string;
}

// Basic adjustment sliders
const basicSliders: SliderInfo[] = [
  { key: "brightness", labelKey: "brightness", min: 0.5, max: 2.0, step: 0.05, defaultValue: 1 },
  { key: "contrast", labelKey: "contrast", min: 0.5, max: 3.0, step: 0.1, defaultValue: 1 },
  { key: "gamma", labelKey: "gamma", min: 0.3, max: 3.0, step: 0.05, defaultValue: 1, formatValue: (v) => v < 1 ? `${v.toFixed(2)} (darker)` : v > 1 ? `${v.toFixed(2)} (lighter)` : "1.00" },
];

// Color manipulation sliders
const colorSliders: SliderInfo[] = [
  { key: "grayscale", labelKey: "grayscale", min: 0, max: 1, step: 0.1, defaultValue: 0 },
  { key: "invert", labelKey: "invert", min: 0, max: 1, step: 0.1, defaultValue: 0 },
];

// Sharpening sliders
const sharpeningSliders: SliderInfo[] = [
  { key: "unsharpAmount", labelKey: "unsharpAmount", min: 0, max: 3, step: 0.1, defaultValue: 0, formatValue: (v) => v === 0 ? "Off" : v.toFixed(1) },
  { key: "unsharpRadius", labelKey: "unsharpRadius", min: 1, max: 5, step: 1, defaultValue: 2, formatValue: (v) => `${v}px` },
];

// Threshold sliders
const thresholdSliders: SliderInfo[] = [
  { key: "threshold", labelKey: "threshold", min: 0, max: 1, step: 0.05, defaultValue: 0, formatValue: (v) => v === 0 ? "Off" : v.toFixed(2) },
  { key: "adaptiveK", labelKey: "adaptiveK", min: 0.05, max: 0.5, step: 0.05, defaultValue: 0.2 },
  { key: "adaptiveRadius", labelKey: "adaptiveRadius", min: 5, max: 30, step: 1, defaultValue: 15, formatValue: (v) => `${v}px` },
];

// Channel mode options
const channelModes: { value: ChannelMode; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'red', label: 'Red (seals)' },
  { value: 'blue', label: 'Blue (yellowed paper)' },
  { value: 'green', label: 'Green' },
];

// Reusable slider component
function FilterSlider({
  slider,
  value,
  onChange,
  t,
}: {
  slider: SliderInfo;
  value: number;
  onChange: (value: number) => void;
  t: ReturnType<typeof useI18n>["t"];
}) {
  const displayValue = slider.formatValue
    ? slider.formatValue(value)
    : value.toFixed(slider.step < 0.1 ? 2 : 1);

  return (
    <div>
      <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
        <span>{t(slider.labelKey)}</span>
        <span className="font-mono">{displayValue}</span>
      </div>
      <input
        type="range"
        min={slider.min}
        max={slider.max}
        step={slider.step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-amber-500"
      />
    </div>
  );
}

export default function FilterControls({
  filters,
  activePreset,
  onPresetChange,
  onFilterChange,
}: FilterControlsProps) {
  const { t } = useI18n();

  return (
    <div className="space-y-4">
      {/* Presets */}
      <div>
        <span className="text-xs uppercase tracking-wider text-gray-500 block mb-2">
          {t("filterPresets")}
        </span>
        <div className="grid grid-cols-2 gap-2">
          {presets.map((preset) => (
            <button
              key={preset.key}
              onClick={() => onPresetChange(preset.key)}
              className={`flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-colors ${
                activePreset === preset.key
                  ? "bg-amber-100 text-amber-800 border border-amber-300"
                  : "bg-gray-50 text-gray-700 border border-gray-200 hover:bg-gray-100"
              }`}
            >
              {preset.icon}
              <span className="truncate">
                {t(preset.labelKey)}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Basic Adjustments */}
      <div>
        <span className="text-xs uppercase tracking-wider text-gray-500 block mb-3">
          {t("basicAdjustments")}
        </span>
        <div className="space-y-3">
          {basicSliders.map((slider) => (
            <FilterSlider
              key={slider.key}
              slider={slider}
              value={filters[slider.key]}
              onChange={(v) => onFilterChange(slider.key, v)}
              t={t}
            />
          ))}
        </div>
      </div>

      {/* Color Manipulation */}
      <div>
        <span className="text-xs uppercase tracking-wider text-gray-500 block mb-3">
          {t("colorFilters")}
        </span>
        <div className="space-y-3">
          {colorSliders.map((slider) => (
            <FilterSlider
              key={slider.key}
              slider={slider}
              value={filters[slider.key]}
              onChange={(v) => onFilterChange(slider.key, v)}
              t={t}
            />
          ))}

          {/* Channel Mode Dropdown */}
          <div>
            <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
              <span>{t("channelMode")}</span>
            </div>
            <select
              value={filters.channelMode}
              onChange={(e) => onFilterChange("channelMode", e.target.value as ChannelMode)}
              className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-amber-400"
            >
              {channelModes.map((mode) => (
                <option key={mode.value} value={mode.value}>
                  {mode.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Sharpening */}
      <div>
        <span className="text-xs uppercase tracking-wider text-gray-500 block mb-3">
          {t("sharpening")}
        </span>
        <div className="space-y-3">
          {sharpeningSliders.map((slider) => (
            <FilterSlider
              key={slider.key}
              slider={slider}
              value={filters[slider.key]}
              onChange={(v) => onFilterChange(slider.key, v)}
              t={t}
            />
          ))}
        </div>
      </div>

      {/* Threshold / Binarization */}
      <div>
        <span className="text-xs uppercase tracking-wider text-gray-500 block mb-3">
          {t("binarization")}
        </span>
        <div className="space-y-3">
          {/* Main threshold slider */}
          <FilterSlider
            slider={thresholdSliders[0]}
            value={filters.threshold}
            onChange={(v) => onFilterChange("threshold", v)}
            t={t}
          />

          {/* Adaptive threshold toggle - only show when threshold > 0 */}
          {filters.threshold > 0 && (
            <>
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">{t("adaptiveThreshold")}</span>
                <button
                  onClick={() => onFilterChange("adaptiveThreshold", !filters.adaptiveThreshold)}
                  className={`relative w-10 h-5 rounded-full transition-colors ${
                    filters.adaptiveThreshold ? "bg-amber-500" : "bg-gray-300"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                      filters.adaptiveThreshold ? "translate-x-5" : ""
                    }`}
                  />
                </button>
              </div>

              {/* Adaptive parameters - only show when adaptive is enabled */}
              {filters.adaptiveThreshold && (
                <div className="pl-2 border-l-2 border-amber-200 space-y-3">
                  <FilterSlider
                    slider={thresholdSliders[1]}
                    value={filters.adaptiveK}
                    onChange={(v) => onFilterChange("adaptiveK", v)}
                    t={t}
                  />
                  <FilterSlider
                    slider={thresholdSliders[2]}
                    value={filters.adaptiveRadius}
                    onChange={(v) => onFilterChange("adaptiveRadius", v)}
                    t={t}
                  />
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Reset button */}
      <button
        onClick={() => onPresetChange("original")}
        className="w-full mt-2 px-3 py-2 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors border border-gray-200"
      >
        {t("resetToOriginal")}
      </button>
    </div>
  );
}
