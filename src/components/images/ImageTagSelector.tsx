"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { FamilyNode } from "@/types/family";
import { useI18n } from "@/lib/i18n";
import {
  getTagRecommendations,
  getUntaggedPeople,
  TagRecommendation,
} from "@/lib/imageRecommendations";
import { PersonAvatar } from "@/components/mobile";

interface ImageTagSelectorProps {
  allNodes: FamilyNode[];
  selectedIds: string[];
  currentNodeId: string;
  onChange: (ids: string[]) => void;
}

// Normalize text by removing diacritics/accents for search
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export default function ImageTagSelector({
  allNodes,
  selectedIds,
  currentNodeId,
  onChange,
}: ImageTagSelectorProps) {
  const { t, lang } = useI18n();
  const [searchQuery, setSearchQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Get selected people
  const selectedPeople = useMemo(() => {
    return selectedIds
      .map(id => allNodes.find(n => n.id === id))
      .filter(Boolean) as FamilyNode[];
  }, [selectedIds, allNodes]);

  // Get recommendations based on currently selected people
  const recommendations = useMemo(() => {
    if (selectedIds.length === 0) {
      return getTagRecommendations(currentNodeId, allNodes, []);
    }
    const allRecs = new Map<string, TagRecommendation>();
    for (const id of selectedIds) {
      const recs = getTagRecommendations(id, allNodes, selectedIds);
      for (const rec of recs) {
        if (!allRecs.has(rec.person.id)) {
          allRecs.set(rec.person.id, rec);
        }
      }
    }
    return Array.from(allRecs.values());
  }, [selectedIds, currentNodeId, allNodes]);

  // Get all untagged people
  const untaggedPeople = useMemo(() => {
    return getUntaggedPeople(allNodes, selectedIds);
  }, [allNodes, selectedIds]);

  // Combine and filter results
  const filteredResults = useMemo(() => {
    const query = normalizeText(searchQuery);

    // If searching, filter all untagged people
    if (query) {
      return untaggedPeople
        .filter(person => {
          const name = normalizeText(person.names.primary_zh + " " + person.names.pinyin);
          return name.includes(query);
        })
        .slice(0, 15)
        .map(person => {
          // Check if this person is in recommendations
          const rec = recommendations.find(r => r.person.id === person.id);
          return {
            person,
            relationship: rec?.relationship,
            priority: rec?.priority,
          };
        });
    }

    // Otherwise show recommendations
    return recommendations.slice(0, 10).map(rec => ({
      person: rec.person,
      relationship: rec.relationship,
      priority: rec.priority,
    }));
  }, [searchQuery, recommendations, untaggedPeople]);

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

  // Reset highlighted index when results change
  useEffect(() => {
    setHighlightedIndex(0);
  }, [searchQuery, isOpen]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (isOpen && listRef.current) {
      const highlightedEl = listRef.current.querySelector(`[data-index="${highlightedIndex}"]`);
      if (highlightedEl) {
        highlightedEl.scrollIntoView({ block: "nearest" });
      }
    }
  }, [highlightedIndex, isOpen]);

  const handleAddPerson = (personId: string) => {
    if (!selectedIds.includes(personId)) {
      onChange([...selectedIds, personId]);
    }
    setSearchQuery("");
    setIsOpen(false);
    inputRef.current?.focus();
  };

  const handleRemovePerson = (personId: string) => {
    onChange(selectedIds.filter(id => id !== personId));
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
        setHighlightedIndex(prev =>
          prev < filteredResults.length - 1 ? prev + 1 : prev
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlightedIndex(prev => (prev > 0 ? prev - 1 : 0));
        break;
      case "Enter":
        e.preventDefault();
        if (filteredResults[highlightedIndex]) {
          handleAddPerson(filteredResults[highlightedIndex].person.id);
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

  // Relationship labels
  const getRelationshipLabel = (relationship?: string): string => {
    if (!relationship) return "";
    if (lang === "en") return relationship;
    const translations: Record<string, string> = {
      "Spouse": "配偶",
      "Father": "父亲",
      "Mother": "母亲",
      "Parent": "父母",
      "Son": "儿子",
      "Daughter": "女儿",
      "Child": "子女",
      "Brother": "兄弟",
      "Sister": "姐妹",
      "Sibling": "兄弟姐妹",
      "Grandfather": "祖父",
      "Grandmother": "祖母",
      "Grandparent": "祖父母",
      "Grandson": "孙子",
      "Granddaughter": "孙女",
      "Grandchild": "孙辈",
      "Father-in-law": "岳父/公公",
      "Mother-in-law": "岳母/婆婆",
      "Parent-in-law": "岳父母/公婆",
      "Brother-in-law": "姐夫/妹夫/大伯/小叔",
      "Sister-in-law": "嫂子/弟媳/大姑/小姑",
      "Sibling-in-law": "姻亲",
      "Uncle": "叔伯/舅舅",
      "Aunt": "姑姑/阿姨",
      "Aunt/Uncle": "叔伯姑姨",
      "Cousin": "堂/表兄弟姐妹",
    };
    return translations[relationship] || relationship;
  };

  return (
    <div className="space-y-2" ref={containerRef}>
      {/* Selected people */}
      {selectedPeople.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedPeople.map(person => (
            <div
              key={person.id}
              className="relative flex flex-col items-center group"
            >
              <PersonAvatar person={person} size="sm" />
              <span className="text-[10px] text-gray-500 mt-0.5 max-w-[48px] truncate text-center">
                {person.names.primary_zh || person.names.pinyin}
              </span>
              <button
                onClick={() => handleRemovePerson(person.id)}
                className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Search input with dropdown */}
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={t("searchPerson")}
          className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent"
        />

        {/* Dropdown */}
        {isOpen && (
          <div
            ref={listRef}
            className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-48 overflow-auto"
          >
            {filteredResults.length === 0 ? (
              <div className="px-3 py-2 text-sm text-gray-500">
                {searchQuery ? t("noMatches") : t("noPhotos")}
              </div>
            ) : (
              <>
                {!searchQuery && (
                  <div className="px-2 py-1 text-xs uppercase tracking-wider text-gray-400 bg-gray-50 border-b">
                    {t("suggested")}
                  </div>
                )}
                {filteredResults.map((result, index) => {
                  const { person, relationship, priority } = result;
                  const isHighlighted = index === highlightedIndex;
                  const isMale = person.gender === "male";
                  const isFemale = person.gender === "female";
                  const textColor = isMale
                    ? "text-blue-700"
                    : isFemale
                    ? "text-pink-700"
                    : "text-gray-700";

                  return (
                    <button
                      key={person.id}
                      type="button"
                      data-index={index}
                      onClick={() => handleAddPerson(person.id)}
                      onMouseEnter={() => setHighlightedIndex(index)}
                      className={`w-full px-2 py-1.5 text-left text-sm flex items-center gap-2 hover:bg-amber-50 ${
                        isHighlighted ? "bg-amber-100" : ""
                      }`}
                    >
                      <PersonAvatar person={person} size="sm" className="flex-shrink-0" />
                      <div className="flex-1 min-w-0 flex items-center justify-between">
                        <span className={`truncate ${textColor}`}>
                          {person.names.primary_zh || person.names.pinyin}
                          {person.names.primary_zh && person.names.pinyin && (
                            <span className="text-gray-400 text-xs ml-1">
                              {person.names.pinyin}
                            </span>
                          )}
                        </span>
                        {relationship && (
                          <span className={`text-xs flex-shrink-0 ml-2 ${
                            priority === "high" ? "text-amber-600" :
                            priority === "medium" ? "text-gray-500" : "text-gray-400"
                          }`}>
                            {getRelationshipLabel(relationship)}
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
