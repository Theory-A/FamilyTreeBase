"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { FamilyNode } from "@/types/family";
import { useI18n } from "@/lib/i18n";
import { usePersonSelection } from "@/lib/PersonSelectionContext";

type SelectorField = "parents" | "partners" | "children";

interface PersonSelectorProps {
  label: string;
  nodes: FamilyNode[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  excludeIds?: string[];
  multiple?: boolean;
  maxSelections?: number;
  placeholder?: string;
  generations?: Map<string, number>;
  selectorField?: SelectorField;
}

// Pastel colors for generation badges (cycles after 10)
const generationColors = [
  "bg-rose-300",
  "bg-orange-300",
  "bg-amber-300",
  "bg-lime-300",
  "bg-emerald-300",
  "bg-teal-300",
  "bg-cyan-300",
  "bg-sky-300",
  "bg-violet-300",
  "bg-pink-300",
];

// Normalize text by removing diacritics/accents for search
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export default function PersonSelector({
  label,
  nodes,
  selectedIds,
  onChange,
  excludeIds = [],
  multiple = false,
  maxSelections,
  placeholder,
  generations,
  selectorField,
}: PersonSelectorProps) {
  const { t } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [isFocused, setIsFocused] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { activeSelector, registerSelector, unregisterSelector } = usePersonSelection();

  // Use ref to store the latest callback to avoid re-registering on every selectedIds change
  const callbackRef = useRef<(personId: string) => void>(() => {});

  // Update the ref whenever dependencies change
  useEffect(() => {
    callbackRef.current = (personId: string) => {
      if (excludeIds.includes(personId)) return;
      if (selectedIds.includes(personId)) return;
      if (maxSelections && selectedIds.length >= maxSelections) return;

      if (multiple) {
        onChange([...selectedIds, personId]);
      } else {
        onChange([personId]);
      }
    };
  }, [excludeIds, selectedIds, maxSelections, multiple, onChange]);

  // Stable callback that delegates to the ref
  const handleExternalSelect = useCallback((personId: string) => {
    callbackRef.current(personId);
  }, []);

  // Register/unregister with context when focused
  useEffect(() => {
    if (isFocused && selectorField) {
      registerSelector(selectorField, handleExternalSelect);
    }
    return () => {
      if (selectorField) {
        unregisterSelector(selectorField);
      }
    };
  }, [isFocused, selectorField, registerSelector, unregisterSelector, handleExternalSelect]);

  const isActive = selectorField && activeSelector === selectorField;

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Reset highlighted index when dropdown opens or filtered results change
  useEffect(() => {
    setHighlightedIndex(0);
  }, [isOpen, search]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (isOpen && listRef.current) {
      const highlightedEl = listRef.current.querySelector(`[data-index="${highlightedIndex}"]`);
      if (highlightedEl) {
        highlightedEl.scrollIntoView({ block: "nearest" });
      }
    }
  }, [highlightedIndex, isOpen]);

  const availableNodes = nodes.filter(
    (node) =>
      !excludeIds.includes(node.id) &&
      !node.id.includes("_placeholder")
  );

  const filteredNodes = availableNodes
    .filter((node) => {
      if (!search) return true;
      const searchNorm = normalizeText(search);
      return (
        normalizeText(node.names.primary_zh).includes(searchNorm) ||
        normalizeText(node.names.pinyin).includes(searchNorm) ||
        (node.names.display_en && normalizeText(node.names.display_en).includes(searchNorm))
      );
    })
    .sort((a, b) => {
      // Sort by generation first (lower generation = earlier ancestor)
      const genA = generations?.get(a.id) ?? 999;
      const genB = generations?.get(b.id) ?? 999;
      if (genA !== genB) return genA - genB;

      // Within same generation, males first
      const genderOrder = { male: 0, female: 1, unknown: 2 };
      const genderA = genderOrder[a.gender] ?? 2;
      const genderB = genderOrder[b.gender] ?? 2;
      return genderA - genderB;
    });

  const selectedNodes = nodes.filter((n) => selectedIds.includes(n.id));

  const handleSelect = (nodeId: string) => {
    if (multiple) {
      if (selectedIds.includes(nodeId)) {
        onChange(selectedIds.filter((id) => id !== nodeId));
      } else {
        if (maxSelections && selectedIds.length >= maxSelections) return;
        onChange([...selectedIds, nodeId]);
      }
    } else {
      onChange([nodeId]);
      setIsOpen(false);
    }
    setSearch("");
  };

  const handleRemove = (nodeId: string) => {
    onChange(selectedIds.filter((id) => id !== nodeId));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        setIsOpen(true);
        e.preventDefault();
      }
      return;
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev < filteredNodes.length - 1 ? prev + 1 : prev
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : 0));
        break;
      case "Enter":
        e.preventDefault();
        if (filteredNodes[highlightedIndex]) {
          handleSelect(filteredNodes[highlightedIndex].id);
        }
        break;
      case "Escape":
        e.preventDefault();
        setIsOpen(false);
        break;
      case "Tab":
        setIsOpen(false);
        break;
    }
  };

  const canAddMore = !maxSelections || selectedIds.length < maxSelections;
  const defaultPlaceholder = placeholder || t("searchPerson");

  return (
    <div className="space-y-1" ref={containerRef}>
      <label className="block text-sm font-medium text-gray-700">{label}</label>

      {/* Selected items */}
      {selectedNodes.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {selectedNodes.map((node) => {
            const isMale = node.gender === "male";
            const isFemale = node.gender === "female";
            const bgColor = isMale
              ? "bg-blue-100 text-blue-800"
              : isFemale
              ? "bg-pink-100 text-pink-800"
              : "bg-gray-100 text-gray-800";
            const gen = generations?.get(node.id);
            const genColor = gen !== undefined && gen >= 0
              ? generationColors[gen % generationColors.length]
              : "bg-gray-400";

            const hoverColor = isMale
              ? "hover:bg-blue-200"
              : isFemale
              ? "hover:bg-pink-200"
              : "hover:bg-gray-200";

            return (
              <button
                key={node.id}
                type="button"
                onClick={() => handleRemove(node.id)}
                className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-sm ${bgColor} ${hoverColor} transition-colors cursor-pointer`}
              >
                {generations && (
                  <span className={`${genColor} text-gray-700 text-xs font-medium px-1.5 py-0.5 rounded`}>
                    {gen !== undefined && gen >= 0 ? gen + 1 : "?"}
                  </span>
                )}
                <span className="font-chinese">{node.names.primary_zh}</span>
                <span className="text-xs opacity-70">({node.names.pinyin})</span>
                <span className="ml-0.5 opacity-60">✕</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Search input */}
      {(multiple ? canAddMore : selectedIds.length === 0) && (
        <div className="relative">
          <input
            ref={inputRef}
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setIsOpen(true);
            }}
            onFocus={() => {
              setIsOpen(true);
              setIsFocused(true);
            }}
            onBlur={() => {
              // Delay to allow click events to fire first
              setTimeout(() => setIsFocused(false), 200);
            }}
            onKeyDown={handleKeyDown}
            placeholder={isActive ? t("clickPersonInTree") : defaultPlaceholder}
            className={`w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:border-transparent transition-colors ${
              isActive
                ? "border-amber-400 ring-2 ring-amber-400 bg-amber-50"
                : "border-gray-300 focus:ring-amber-400"
            }`}
          />

          {/* Dropdown */}
          {isOpen && (
            <div
              ref={listRef}
              className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-auto"
            >
              {filteredNodes.length === 0 ? (
                <div className="px-3 py-2 text-sm text-gray-500">{t("noMatches")}</div>
              ) : (
                filteredNodes.map((node, index) => {
                  const isSelected = selectedIds.includes(node.id);
                  const isHighlighted = index === highlightedIndex;
                  const isMale = node.gender === "male";
                  const isFemale = node.gender === "female";
                  const textColor = isMale
                    ? "text-blue-700"
                    : isFemale
                    ? "text-pink-700"
                    : "text-gray-700";
                  const hoverBg = isMale
                    ? "hover:bg-blue-50"
                    : isFemale
                    ? "hover:bg-pink-50"
                    : "hover:bg-gray-50";
                  const selectedBg = isMale
                    ? "bg-blue-50"
                    : isFemale
                    ? "bg-pink-50"
                    : "bg-gray-50";
                  const highlightBg = isMale
                    ? "bg-blue-100"
                    : isFemale
                    ? "bg-pink-100"
                    : "bg-gray-100";
                  const gen = generations?.get(node.id);
                  const genColor = gen !== undefined && gen >= 0
                    ? generationColors[gen % generationColors.length]
                    : "bg-gray-400";

                  return (
                    <button
                      key={node.id}
                      type="button"
                      data-index={index}
                      onClick={() => handleSelect(node.id)}
                      onMouseEnter={() => setHighlightedIndex(index)}
                      className={`w-full px-3 py-2 text-left text-sm ${hoverBg} flex items-center justify-between ${
                        isHighlighted ? highlightBg : isSelected ? selectedBg : ""
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {generations && (
                          <span className={`${genColor} text-gray-700 text-xs font-medium px-1.5 py-0.5 rounded min-w-[1.5rem] text-center`}>
                            {gen !== undefined && gen >= 0 ? gen + 1 : "?"}
                          </span>
                        )}
                        <span className={`font-medium font-chinese ${textColor}`}>{node.names.primary_zh}</span>
                        <span className="text-gray-500">{node.names.pinyin}</span>
                      </div>
                      {isSelected && <span className="text-amber-600">✓</span>}
                    </button>
                  );
                })
              )}
            </div>
          )}
        </div>
      )}

      {maxSelections && (
        <p className="text-xs text-gray-500">
          {selectedIds.length}/{maxSelections} {t("selected")}
        </p>
      )}
    </div>
  );
}
