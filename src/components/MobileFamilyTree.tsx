"use client";

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { FamilyTreeData, FamilyNode, PartnerLink } from "@/types/family";
import { ImageMetadata } from "@/types/image";
import { pinyin } from "pinyin-pro";
import { motion, AnimatePresence } from "framer-motion";
import { I18nProvider, useI18n, MobileLanguageToggle } from "@/lib/i18n";
import {
  PersonAvatar,
  CompactPersonCard,
  SearchBar,
  MiniDiagram,
  MobileImageUploadModal,
} from "./mobile";

interface MobileFamilyTreeProps {
  nodes: FamilyTreeData;
}

function getParentId(ref: string | { id: string }): string {
  return typeof ref === "string" ? ref : ref.id;
}

function toPartnerLink(ref: string | PartnerLink): PartnerLink {
  return typeof ref === "string" ? { id: ref } : ref;
}

interface HistoricalEvent {
  name: string;
  name_zh: string;
  start_year: number;
  end_year: number;
}

interface LivedThroughEvent extends HistoricalEvent {
  ageAtStart: number;
}

// Calculate which events a person lived through
function calculateLivedThroughEvents(
  birthDateIso: string | undefined,
  deathDateIso: string | undefined,
  historicalEvents: HistoricalEvent[]
): LivedThroughEvent[] {
  if (!birthDateIso) return [];

  const birthYear = parseInt(birthDateIso.substring(0, 4), 10);
  if (isNaN(birthYear)) return [];

  const deathYear = deathDateIso
    ? parseInt(deathDateIso.substring(0, 4), 10)
    : new Date().getFullYear();

  return historicalEvents
    .filter((event) => {
      return birthYear <= event.end_year && deathYear >= event.start_year;
    })
    .map((event) => {
      const ageAtStart = event.start_year - birthYear;
      return {
        ...event,
        ageAtStart: Math.max(0, ageAtStart),
      };
    })
    .sort((a, b) => a.start_year - b.start_year);
}

// Chinese zodiac calculation
function getChineseZodiac(year: number): string {
  const zodiacEmojis = ["🐀", "🐂", "🐅", "🐇", "🐉", "🐍", "🐴", "🐐", "🐒", "🐓", "🐕", "🐖"];
  const index = (year - 4) % 12;
  return zodiacEmojis[index];
}

// Age calculation helpers
function calculateAge(birthDateStr?: string, deathDateStr?: string): number | null {
  if (!birthDateStr) return null;
  const birthYear = parseInt(birthDateStr.substring(0, 4), 10);
  if (isNaN(birthYear)) return null;

  const birthMonth = birthDateStr.length >= 7 ? parseInt(birthDateStr.substring(5, 7), 10) - 1 : 0;
  const birthDay = birthDateStr.length >= 10 ? parseInt(birthDateStr.substring(8, 10), 10) : 1;

  let endDate: Date;
  if (deathDateStr) {
    const deathYear = parseInt(deathDateStr.substring(0, 4), 10);
    const deathMonth = deathDateStr.length >= 7 ? parseInt(deathDateStr.substring(5, 7), 10) - 1 : 11;
    const deathDay = deathDateStr.length >= 10 ? parseInt(deathDateStr.substring(8, 10), 10) : 31;
    endDate = new Date(deathYear, deathMonth, deathDay);
  } else {
    endDate = new Date();
  }

  const birthDate = new Date(birthYear, birthMonth, birthDay);
  let age = endDate.getFullYear() - birthDate.getFullYear();
  const monthDiff = endDate.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && endDate.getDate() < birthDate.getDate())) {
    age--;
  }
  return age >= 0 ? age : null;
}

function isPersonLiving(birthDateStr?: string, deathDateStr?: string): boolean {
  if (!birthDateStr || deathDateStr) return false;
  const age = calculateAge(birthDateStr);
  return age !== null && age <= 100;
}

function isPersonDeceased(birthDateStr?: string, deathDateStr?: string): boolean {
  if (deathDateStr) return true;
  if (!birthDateStr) return false;
  return !isPersonLiving(birthDateStr, deathDateStr);
}

// Mobile image gallery that fetches from API
function MobileImageGallery({
  nodeId,
  onImageClick,
  onAddPhoto,
  refreshKey,
}: {
  nodeId: string;
  onImageClick?: (images: ImageMetadata[], index: number) => void;
  onAddPhoto?: () => void;
  refreshKey?: number;
}) {
  const { t } = useI18n();
  const [images, setImages] = useState<ImageMetadata[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchImages = async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/images?node_id=${nodeId}`);
        const data = await response.json();
        if (data.success) {
          setImages(data.images || []);
        }
      } catch (err) {
        console.error("Error fetching images:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchImages();
  }, [nodeId, refreshKey]);

  if (loading) {
    return (
      <div className="mt-3 pt-3 border-t border-amber-100">
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <div className="w-4 h-4 border-2 border-amber-300 border-t-transparent rounded-full animate-spin" />
          <span>{t("loading")}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-3 pt-3 border-t border-amber-100">
      <div className="flex gap-2 overflow-x-auto pb-1">
        {/* Add Photo button */}
        {onAddPhoto && (
          <button
            onClick={onAddPhoto}
            className="flex-shrink-0 w-20 h-20 rounded-lg border-2 border-dashed border-amber-300 bg-amber-50/50 flex flex-col items-center justify-center gap-1 active:bg-amber-100 transition-colors"
          >
            <svg className="w-6 h-6 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span className="text-xs text-amber-600 font-medium">{t("add")}</span>
          </button>
        )}
        {images.map((img, idx) => (
          <button
            key={img.id}
            onClick={() => onImageClick?.(images, idx)}
            className="flex-shrink-0 focus:outline-none focus:ring-2 focus:ring-amber-400 rounded-lg"
          >
            <img
              src={img.storage_url}
              alt={img.caption || "Photo"}
              className="w-20 h-20 rounded-lg object-cover"
              loading="lazy"
            />
          </button>
        ))}
      </div>
    </div>
  );
}

// Hovering image modal with backdrop
function ImageModal({
  images,
  initialIndex,
  onClose,
  nodeMap,
}: {
  images: ImageMetadata[];
  initialIndex: number;
  onClose: () => void;
  nodeMap: Map<string, FamilyNode>;
}) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const currentImage = images[currentIndex];

  const goNext = () => setCurrentIndex((i) => (i + 1) % images.length);
  const goPrev = () => setCurrentIndex((i) => (i - 1 + images.length) % images.length);

  // Get tagged people for current image
  const taggedPeople = (currentImage.tagged_node_ids || [])
    .map(id => nodeMap.get(id))
    .filter((p): p is FamilyNode => p !== undefined);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      {/* Modal container */}
      <div
        className="relative bg-white rounded-2xl shadow-2xl overflow-hidden max-w-[90vw] max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Tagged people avatars - above the image */}
        {taggedPeople.length > 0 && (
          <div className="flex items-center justify-center gap-2 px-3 py-2 bg-gradient-to-b from-gray-100 to-white border-b border-gray-100">
            {taggedPeople.map(person => (
              <div key={person.id} className="flex flex-col items-center">
                <PersonAvatar person={person} size="sm" />
                <span className="text-[10px] text-gray-500 mt-0.5 max-w-[48px] truncate">
                  {person.names.primary_zh || person.names.pinyin}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-2 right-2 z-10 w-11 h-11 flex items-center justify-center bg-black/40 text-white rounded-full hover:bg-black/60 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Image counter */}
        {images.length > 1 && (
          <div className="absolute top-2 left-2 z-10 px-2 py-1 bg-black/40 text-white text-sm rounded-full">
            {currentIndex + 1} / {images.length}
          </div>
        )}

        {/* Image */}
        <img
          src={currentImage.storage_url}
          alt={currentImage.caption || "Photo"}
          className="max-w-[90vw] max-h-[75vh] object-contain"
        />

        {/* Navigation arrows */}
        {images.length > 1 && (
          <>
            <button
              onClick={goPrev}
              className="absolute left-2 top-1/2 -translate-y-1/2 p-2 bg-black/40 text-white rounded-full hover:bg-black/60 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              onClick={goNext}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-black/40 text-white rounded-full hover:bg-black/60 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// Full person card for detail view
function PersonCard({
  person,
  isCurrentPerson = false,
  onImageClick,
  onAddPhoto,
  imageRefreshKey,
  historicalEvents = [],
}: {
  person: FamilyNode;
  isCurrentPerson?: boolean;
  onImageClick?: (images: ImageMetadata[], index: number) => void;
  onAddPhoto?: () => void;
  imageRefreshKey?: number;
  historicalEvents?: HistoricalEvent[];
}) {
  const { t, lang } = useI18n();
  const birthDate = person.vital_stats?.birth?.date_iso;
  const deathDate = person.vital_stats?.death?.date_iso;
  const isDeceased = isPersonDeceased(birthDate, deathDate);
  const age = calculateAge(birthDate, deathDate);
  const living = isPersonLiving(birthDate, deathDate);

  // Calculate events this person lived through
  const livedThroughEvents = useMemo(() => {
    return calculateLivedThroughEvents(birthDate, deathDate, historicalEvents);
  }, [birthDate, deathDate, historicalEvents]);

  const birthYear = birthDate ? parseInt(birthDate.substring(0, 4), 10) : null;

  return (
    <div
      className="relative overflow-hidden p-4 rounded-2xl border-2 border-amber-200/70 bg-white/80 backdrop-blur-sm shadow-md shadow-amber-100/40"
    >
      {isDeceased && (
        <img
          src="/chrysanthemum.png"
          alt=""
          className="absolute z-0 scale-[0.8] grayscale opacity-30 pointer-events-none"
          style={{ top: '-9px', left: '166px' }}
        />
      )}
      <div className="relative z-10 flex items-start gap-4">
        <PersonAvatar person={person} size="xl" />

        <div className="flex-1 min-w-0">
          {person.names.primary_zh ? (
            <div className="flex items-end gap-0.5 flex-wrap">
              {person.names.primary_zh.split("").map((char, i) => (
                <div key={i} className="flex flex-col items-center">
                  <span className="text-xs text-gray-400 leading-tight">
                    {pinyin(char)}
                  </span>
                  <span className="text-3xl font-bold text-gray-800 font-chinese">
                    {char}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <span className="text-3xl font-bold text-gray-800">
              {person.names.pinyin}
            </span>
          )}

          {person.names.display_en && (
            <div className="text-base text-gray-400">{person.names.display_en}</div>
          )}

          <div className="mt-3 space-y-0.5">
            {age !== null && (
              <div className={`text-sm font-medium ${living ? "text-emerald-600" : "text-gray-500"}`}>
                {living ? `${age}${t("years")}` : deathDate ? `${t("statusPassed")}${age}${t("years")}` : t("statusPassedUnknownAge")}
              </div>
            )}
            <div className="text-xs text-gray-400 flex items-center">
              {birthYear && <span className="text-base">{getChineseZodiac(birthYear)}</span>}
              {birthYear && <span className="mx-1">·</span>}
              <span>
                {birthDate?.replace(/-/g, ".") || t("birthYearUnknown")}
                {deathDate && ` — ${deathDate.replace(/-/g, ".")}`}
              </span>
            </div>
          </div>
        </div>
      </div>

      {person.attributes?.note && (
        <div className="relative z-10 mt-3 pt-3 border-t border-amber-100">
          <p className="text-sm text-gray-600 italic leading-relaxed">
            {String(person.attributes.note)}
          </p>
        </div>
      )}

      {person.attributes?.description && (
        <div className={`relative z-10 mt-3 pt-3 ${!person.attributes?.note ? "border-t border-amber-100" : ""}`}>
          <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">
            {String(person.attributes.description)}
          </p>
        </div>
      )}

      {/* Timeline visualization for historical events */}
      {livedThroughEvents.length > 0 && birthYear && (
        <div className="relative z-10 mt-4 pt-3 border-t border-amber-100">
          <div className="relative">
            {/* Timeline axis */}
            <div className="h-px bg-amber-300 absolute top-3 left-0 right-0" />

            {/* Events */}
            <div className="flex items-start pt-8 gap-4 overflow-x-auto pb-2 -mx-4 px-4">
              {/* Birth marker */}
              <div className="flex flex-col items-center min-w-fit relative">
                <div className="absolute -top-6 w-2 h-2 rounded-full bg-amber-400 border border-amber-500" />
                <div className="px-2 py-0.5 rounded text-xs font-medium bg-amber-600 text-white">
                  {birthYear}
                </div>
                <div className="text-[10px] text-amber-600 mt-1">
                  {t("born")}
                </div>
              </div>
              {livedThroughEvents.map((event) => {
                const eventName = lang === "zh" ? event.name_zh : event.name;
                // Color intensity based on age during event
                const intensity = event.ageAtStart < 18
                  ? "bg-amber-600 text-white"
                  : event.ageAtStart < 35
                  ? "bg-amber-500 text-white"
                  : "bg-amber-100 text-amber-800";

                return (
                  <div
                    key={event.name}
                    className="flex flex-col items-center min-w-fit relative"
                    title={event.start_year === event.end_year ? `${event.start_year}` : `${event.start_year}-${event.end_year}`}
                  >
                    {/* Dot on timeline */}
                    <div className="absolute -top-6 w-2 h-2 rounded-full bg-amber-400 border border-amber-500" />
                    <div className={`px-2 py-0.5 rounded text-xs font-medium ${intensity}`}>
                      {eventName}
                    </div>
                    <div className="text-[10px] text-amber-600 mt-1">
                      {event.ageAtStart} {t("yearsOld")}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <div className="relative z-10">
        <MobileImageGallery
          nodeId={person.id}
          onImageClick={onImageClick}
          onAddPhoto={onAddPhoto}
          refreshKey={imageRefreshKey}
        />
      </div>
    </div>
  );
}

// Section divider
function SectionDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 my-1">
      <div className="h-px flex-1 bg-gradient-to-r from-transparent via-amber-300/50 to-transparent" />
      <span className="text-xs text-amber-600/70 font-medium uppercase tracking-wider">{label}</span>
      <div className="h-px flex-1 bg-gradient-to-r from-transparent via-amber-300/50 to-transparent" />
    </div>
  );
}

// Inner component that uses the i18n context
function MobileFamilyTreeInner({ nodes }: MobileFamilyTreeProps) {
  const { t, lang } = useI18n();

  // Navigation state
  const [history, setHistory] = useState<string[]>([]);
  const [currentPersonId, setCurrentPersonId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const contentRef = useRef<HTMLDivElement>(null);

  // Image modal state
  const [modalImages, setModalImages] = useState<ImageMetadata[] | null>(null);
  const [modalInitialIndex, setModalInitialIndex] = useState(0);

  // Upload modal state
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadNodeId, setUploadNodeId] = useState<string | null>(null);
  const [imageRefreshKey, setImageRefreshKey] = useState(0);

  // Historical events for timeline
  const [historicalEvents, setHistoricalEvents] = useState<HistoricalEvent[]>([]);

  // Load historical events once
  useEffect(() => {
    fetch("/events.json")
      .then((res) => res.json())
      .then((data) => setHistoricalEvents(data.events || []))
      .catch(() => setHistoricalEvents([]));
  }, []);

  const openImageModal = useCallback((images: ImageMetadata[], index: number) => {
    setModalImages(images);
    setModalInitialIndex(index);
  }, []);

  const closeImageModal = useCallback(() => {
    setModalImages(null);
  }, []);

  const openUploadModal = useCallback((nodeId: string) => {
    setUploadNodeId(nodeId);
    setShowUploadModal(true);
  }, []);

  const closeUploadModal = useCallback(() => {
    setShowUploadModal(false);
    setUploadNodeId(null);
  }, []);

  const handleUploadComplete = useCallback(() => {
    setImageRefreshKey(k => k + 1);
  }, []);

  // Build node map
  const nodeMap = useMemo(() => {
    const map = new Map<string, FamilyNode>();
    nodes.forEach((node) => map.set(node.id, node));
    return map;
  }, [nodes]);

  // Current person
  const currentPerson = currentPersonId ? nodeMap.get(currentPersonId) : null;

  // Search filtering - converts Chinese names to pinyin for roman alphabet search
  const filteredNodes = useMemo(() => {
    if (!searchQuery.trim()) return [];

    const query = searchQuery.trim().toLowerCase();

    return nodes
      .filter((node) => {
        // Chinese name match (exact)
        const zhMatch = node.names.primary_zh?.toLowerCase().includes(query);

        // Convert Chinese name to pinyin and match
        const zhPinyin = node.names.primary_zh
          ? pinyin(node.names.primary_zh, { toneType: "none", type: "array" }).join("").toLowerCase()
          : "";
        const pinyinMatch = zhPinyin.includes(query);

        // Also try matching with spaces (e.g., "qi jin" for 戚锦)
        const zhPinyinSpaced = node.names.primary_zh
          ? pinyin(node.names.primary_zh, { toneType: "none", type: "array" }).join(" ").toLowerCase()
          : "";
        const pinyinSpacedMatch = zhPinyinSpaced.includes(query);

        // English name match
        const enName = node.names.display_en?.toLowerCase() || "";
        const enMatch = enName.includes(query);

        // Match individual words in English name
        const enWords = enName.split(/\s+/);
        const enWordMatch = enWords.some(word => word.startsWith(query));

        return zhMatch || pinyinMatch || pinyinSpacedMatch || enMatch || enWordMatch;
      })
      .sort((a, b) => {
        // Prioritize starts-with matches (pinyin or English)
        const aPinyin = a.names.primary_zh ? pinyin(a.names.primary_zh, { toneType: "none", type: "array" }).join("").toLowerCase() : "";
        const bPinyin = b.names.primary_zh ? pinyin(b.names.primary_zh, { toneType: "none", type: "array" }).join("").toLowerCase() : "";
        const aEn = (a.names.display_en || "").toLowerCase();
        const bEn = (b.names.display_en || "").toLowerCase();

        const aStartsWith = aPinyin.startsWith(query) || aEn.split(/\s+/).some(w => w.startsWith(query));
        const bStartsWith = bPinyin.startsWith(query) || bEn.split(/\s+/).some(w => w.startsWith(query));

        if (aStartsWith && !bStartsWith) return -1;
        if (!aStartsWith && bStartsWith) return 1;
        return aPinyin.localeCompare(bPinyin);
      });
  }, [nodes, searchQuery]);
  // Get relationships for current person
  const relationships = useMemo(() => {
    if (!currentPerson) return { parents: [], spouses: [], spousesWithInfo: [], children: [], siblings: [] };

    const parents = (currentPerson.parent_ids || [])
      .map((ref) => nodeMap.get(getParentId(ref)))
      .filter((p): p is FamilyNode => p !== undefined);

    const spousesWithInfo = (currentPerson.partner_ids || [])
      .map((ref) => {
        const link = toPartnerLink(ref);
        const node = nodeMap.get(link.id);
        return node ? { node, link } : null;
      })
      .filter((s): s is { node: FamilyNode; link: PartnerLink } => s !== null);

    const spouses = spousesWithInfo.map(s => s.node);

    const children = nodes
      .filter((n) => n.parent_ids?.some((ref) => getParentId(ref) === currentPerson.id))
      .sort((a, b) => {
        const aIsMale = a.gender === "male" ? 0 : 1;
        const bIsMale = b.gender === "male" ? 0 : 1;
        if (aIsMale !== bIsMale) return aIsMale - bIsMale;
        const ad = a.vital_stats?.birth?.date_iso || "";
        const bd = b.vital_stats?.birth?.date_iso || "";
        if (!ad && bd) return -1;
        if (ad && !bd) return 1;
        return ad.localeCompare(bd);
      });

    const parentIds = new Set((currentPerson.parent_ids || []).map(getParentId));
    const siblings = parentIds.size > 0
      ? nodes
          .filter((n) => {
            if (n.id === currentPerson.id) return false;
            return n.parent_ids?.some((ref) => parentIds.has(getParentId(ref)));
          })
          .sort((a, b) => {
            const ad = a.vital_stats?.birth?.date_iso || "";
            const bd = b.vital_stats?.birth?.date_iso || "";
            return ad.localeCompare(bd);
          })
      : [];

    return { parents, spouses, spousesWithInfo, children, siblings };
  }, [currentPerson, nodes, nodeMap]);

  // Navigation functions
  const navigateTo = useCallback((personId: string) => {
    setHistory((prev) => (currentPersonId ? [...prev, currentPersonId] : prev));
    setCurrentPersonId(personId);
    setSearchQuery("");
    contentRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, [currentPersonId]);

  const goBack = useCallback(() => {
    if (history.length > 0) {
      const newHistory = [...history];
      const previousId = newHistory.pop();
      setHistory(newHistory);
      setCurrentPersonId(previousId || null);
    } else {
      setCurrentPersonId(null);
    }
  }, [history]);

  const goHome = useCallback(() => {
    setCurrentPersonId(null);
    setHistory([]);
    setSearchQuery("");
    contentRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  // Swipe-back gesture state
  const [isDragging, setIsDragging] = useState(false);
  const [dragX, setDragX] = useState(0);
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const EDGE_THRESHOLD = 40; // Only start drag from left edge (px)
  const COMPLETE_THRESHOLD = 0.35; // Complete if dragged past 35% of screen
  const VELOCITY_THRESHOLD = 0.5; // Complete on fast flick (px/ms)

  // Handle touch start - detect edge swipe initiation
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    if (touch.clientX <= EDGE_THRESHOLD && currentPersonId) {
      touchStartRef.current = {
        x: touch.clientX,
        y: touch.clientY,
        time: Date.now(),
      };
      setIsDragging(true);
    }
  }, [currentPersonId]);

  // Handle touch move - update drag position
  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging || !touchStartRef.current) return;

    const touch = e.touches[0];
    const deltaX = touch.clientX - touchStartRef.current.x;
    const deltaY = Math.abs(touch.clientY - touchStartRef.current.y);

    // Cancel if vertical movement is too large (user is scrolling)
    if (deltaY > 50 && deltaY > Math.abs(deltaX)) {
      setIsDragging(false);
      setDragX(0);
      touchStartRef.current = null;
      return;
    }

    // Only allow positive (rightward) drag
    setDragX(Math.max(0, deltaX));
  }, [isDragging]);

  // Handle touch end - complete or cancel based on position/velocity
  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!isDragging || !touchStartRef.current) {
      setIsDragging(false);
      setDragX(0);
      touchStartRef.current = null;
      return;
    }

    const touch = e.changedTouches[0];
    const deltaX = touch.clientX - touchStartRef.current.x;
    const deltaTime = Date.now() - touchStartRef.current.time;
    const velocity = deltaX / deltaTime; // px/ms

    const screenWidth = window.innerWidth;
    const draggedPastThreshold = deltaX > screenWidth * COMPLETE_THRESHOLD;
    const fastFlick = velocity > VELOCITY_THRESHOLD && deltaX > 50;

    if (draggedPastThreshold || fastFlick) {
      goBack();
    }

    setIsDragging(false);
    setDragX(0);
    touchStartRef.current = null;
  }, [isDragging, goBack]);

  // Home / Selection screen
  const renderHomeScreen = () => (
    <div className="min-h-screen pb-6">
      {/* Hero Header */}
      <header className="relative overflow-hidden pt-safe-8 pb-6 px-4">
        <div className="absolute inset-0 bg-gradient-to-b from-amber-100/80 to-transparent" />
        <div className="relative flex items-start justify-between">
          {/* Spacer for balance */}
          <div className="w-10" />
          <h1 className="text-4xl font-bold text-amber-800 font-chinese">
            {t("qiFamilyTree")}
          </h1>
          {/* Language toggle */}
          <MobileLanguageToggle />
        </div>
      </header>

      <div className="px-4 space-y-6">
        {/* Search Bar */}
        <SearchBar
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder={t("searchByName")}
        />

        {/* Search Results */}
        {searchQuery && (
          <section>
            <SectionDivider label={`${t("searchResults")} (${filteredNodes.length})`} />
            <div className="space-y-2 mt-3">
              {filteredNodes.length > 0 ? (
                filteredNodes.map((node) => (
                  <button
                    key={node.id}
                    onClick={() => navigateTo(node.id)}
                    className="w-full text-left"
                  >
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-white/70 border border-amber-200/40 active:scale-[0.98] transition-transform">
                      <PersonAvatar person={node} size="sm" />
                      <div className="flex-1 min-w-0">
                        <span className={`font-semibold text-gray-800 ${node.names.primary_zh ? "font-sans" : ""}`}>
                          {node.names.primary_zh || node.names.pinyin}
                        </span>
                        {node.names.pinyin && node.names.primary_zh && (
                          <div className="text-xs text-gray-500">{node.names.pinyin}</div>
                        )}
                      </div>
                      <svg className="w-4 h-4 text-amber-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </button>
                ))
              ) : (
                <div className="text-center py-8 text-gray-400">
                  <p>{t("noMatches")}</p>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Show content only when not searching */}
        {!searchQuery && (
          <>
            {/* Featured Members - all those with avatars */}
            {nodes.filter(n => n.avatar).length > 0 && (
            <section>
              <SectionDivider label={t("familyMembers")} />
              <div className="space-y-3 mt-3">
                {nodes.filter(n => n.avatar).map((node) => {
                  const nodeIsDeceased = isPersonDeceased(
                    node.vital_stats?.birth?.date_iso,
                    node.vital_stats?.death?.date_iso
                  );
                  return (
                    <button
                      key={node.id}
                      onClick={() => navigateTo(node.id)}
                      className="w-full text-left"
                    >
                      <div className="relative overflow-hidden flex items-center gap-4 p-4 rounded-2xl bg-white/70 backdrop-blur-sm border border-amber-200/60 shadow-md shadow-amber-100/30 active:scale-[0.98] transition-transform">
                        {nodeIsDeceased && (
                          <img
                            src="/chrysanthemum.png"
                            alt=""
                            className="absolute right-4 -bottom-[52px] scale-[0.8] grayscale opacity-30 pointer-events-none"
                          />
                        )}
                        <PersonAvatar person={node} size="lg" />
                        <div className="flex-1 min-w-0">
                          <span className={`text-xl font-bold text-gray-800 ${node.names.primary_zh ? "font-chinese" : ""}`}>
                            {node.names.primary_zh || node.names.pinyin}
                          </span>
                          {node.names.pinyin && node.names.primary_zh && (
                            <div className="text-base text-gray-500">{node.names.pinyin}</div>
                          )}
                          {node.vital_stats?.birth?.date_iso && (
                            <div className="text-sm text-gray-400 mt-1">
                              {node.vital_stats.birth.date_iso.replace(/-/g, ".")}
                            </div>
                          )}
                        </div>
                        <svg className="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>
            )}
          </>
        )}
      </div>
    </div>
  );

  // Person Detail View
  const renderPersonDetail = () => {
    if (!currentPerson) return null;

    return (
      <div className="min-h-screen pb-6">
        {/* Header */}
        <header className="sticky top-0 z-10 bg-amber-50/95 backdrop-blur-md border-b border-amber-200/60 px-4 pt-safe-3 pb-3 shadow-sm">
          <div className="flex items-center gap-3">
            <button
              onClick={goBack}
              className="p-2 -ml-2 rounded-xl hover:bg-amber-100 active:bg-amber-200 transition-colors"
            >
              <svg className="w-6 h-6 text-amber-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              onClick={goBack}
              className="flex-1 min-w-0 text-left active:opacity-70 transition-opacity"
            >
              <h1 className={`text-lg font-bold text-gray-800 truncate ${currentPerson.names.primary_zh ? "font-sans" : ""}`}>
                {currentPerson.names.primary_zh || currentPerson.names.pinyin}
              </h1>
              {currentPerson.names.display_en && (
                <p className="text-xs text-gray-500 truncate">
                  {currentPerson.names.display_en}
                </p>
              )}
            </button>
            {/* Language toggle to the left of home icon */}
            <MobileLanguageToggle />
            <button
              onClick={goHome}
              className="p-2 -mr-2 rounded-xl hover:bg-amber-100 active:bg-amber-200 transition-colors"
            >
              <svg className="w-5 h-5 text-amber-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
            </button>
          </div>
        </header>

        <div ref={contentRef} className="p-4 space-y-6">
          {/* Mini Family Diagram */}
          {(relationships.parents.length > 0 || relationships.children.length > 0 || relationships.spouses.length > 0) && (
            <section className="bg-white/60 backdrop-blur-sm rounded-2xl border border-amber-200/40 p-3">
              <MiniDiagram
                currentPerson={currentPerson}
                parents={relationships.parents}
                children={relationships.children}
                spouse={relationships.spouses[0]}
                onSelectPerson={navigateTo}
              />
            </section>
          )}

          {/* Current Person Card */}
          <section>
            <PersonCard
              person={currentPerson}
              isCurrentPerson
              onImageClick={openImageModal}
              onAddPhoto={() => openUploadModal(currentPerson.id)}
              imageRefreshKey={imageRefreshKey}
              historicalEvents={historicalEvents}
            />
          </section>

          {/* Parents - Full cards */}
          {relationships.parents.length > 0 && (
            <section>
              <SectionDivider label={t("parentsMax2").replace(" (max 2)", "").replace(" (最多2位)", "")} />
              <div className="grid grid-cols-2 gap-3 mt-3">
                {relationships.parents.map((parent) => (
                  <button
                    key={parent.id}
                    onClick={() => navigateTo(parent.id)}
                    className="text-left w-full"
                  >
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-white/70 border border-amber-200/40 active:scale-[0.98] transition-transform">
                      <PersonAvatar person={parent} size="lg" />
                      <div className="flex-1 min-w-0">
                        <span className={`text-lg font-semibold text-gray-800 block truncate ${parent.names.primary_zh ? "font-chinese" : ""}`}>
                          {parent.names.primary_zh || parent.names.pinyin}
                        </span>
                        <span className="text-sm text-gray-400">
                          {parent.gender === "male" ? t("fatherShort") : parent.gender === "female" ? t("motherShort") : t("parentShort")}
                        </span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* Spouse - Full card */}
          {relationships.spousesWithInfo.length > 0 && (
            <section>
              <SectionDivider label={t("spouse")} />
              <div className="space-y-2 mt-3">
                {relationships.spousesWithInfo.map(({ node: spouse, link }) => {
                  const isDivorced = link.type === "divorced";
                  return (
                    <button
                      key={spouse.id}
                      onClick={() => navigateTo(spouse.id)}
                      className="w-full text-left"
                    >
                      <div className={`flex items-center gap-4 p-4 rounded-xl bg-white/70 active:scale-[0.98] transition-transform ${isDivorced ? "border-2 border-dashed border-gray-300/60" : "border border-pink-200/60"}`}>
                        <PersonAvatar person={spouse} size="lg" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className={`text-xl font-semibold ${spouse.names.primary_zh ? "font-chinese" : ""} ${isDivorced ? "text-gray-500" : "text-gray-800"}`}>
                              {spouse.names.primary_zh || spouse.names.pinyin}
                            </span>
                            {isDivorced && (
                              <span className="text-xs text-gray-400 italic">({t("divorced")})</span>
                            )}
                          </div>
                          {spouse.names.pinyin && spouse.names.primary_zh && (
                            <div className="text-sm text-gray-500">{spouse.names.pinyin}</div>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {/* Siblings - Compact cards */}
          {relationships.siblings.length > 0 && (
            <section>
              <SectionDivider label={`${t("siblings")} (${relationships.siblings.length})`} />
              <div className="space-y-2 mt-3">
                {relationships.siblings.map((sibling) => (
                  <CompactPersonCard
                    key={sibling.id}
                    person={sibling}
                    onSelect={() => navigateTo(sibling.id)}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Children - Compact cards */}
          {relationships.children.length > 0 && (
            <section>
              <SectionDivider label={`${t("children")} (${relationships.children.length})`} />
              <div className="space-y-2 mt-3">
                {relationships.children.map((child) => (
                  <CompactPersonCard
                    key={child.id}
                    person={child}
                    onSelect={() => navigateTo(child.id)}
                  />
                ))}
              </div>
            </section>
          )}

          {/* No relationships */}
          {relationships.parents.length === 0 &&
            relationships.spouses.length === 0 &&
            relationships.children.length === 0 &&
            relationships.siblings.length === 0 && (
              <div className="text-center text-gray-400 py-8">
                <p>{t("noConnectedFamily")}</p>
              </div>
            )}
        </div>
      </div>
    );
  };

  // Calculate background parallax offset (moves slower than foreground)
  const bgOffset = isDragging ? dragX * 0.3 : 0;
  // Calculate screen width safely (SSR-safe)
  const screenWidth = typeof window !== 'undefined' ? window.innerWidth : 400;

  return (
    <div
      className="relative min-h-screen bg-[url('/paper-texture.png')] bg-repeat overflow-x-hidden"
      onTouchStart={currentPersonId ? handleTouchStart : undefined}
      onTouchMove={currentPersonId ? handleTouchMove : undefined}
      onTouchEnd={currentPersonId ? handleTouchEnd : undefined}
    >
      {/* Paper texture overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-amber-50/90 to-amber-50/95 pointer-events-none" />

      {/* Background layer - shows "previous" view peeking through during swipe */}
      <AnimatePresence>
        {currentPerson && isDragging && (
          <motion.div
            className="absolute inset-0 z-0"
            initial={{ opacity: 0, x: -50 }}
            animate={{
              opacity: Math.min(dragX / (screenWidth * 0.4), 1) * 0.7,
              x: -50 + bgOffset,
            }}
            exit={{ opacity: 0 }}
          >
            {/* Dimmed background representing "back" destination */}
            <div className="absolute inset-0 bg-amber-50" />
            <div className="flex items-center justify-center h-full">
              <div className="text-center text-amber-600/50">
                <svg className="w-12 h-12 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
                <span className="text-sm font-medium">
                  {history.length > 0 ? t("back") : t("home")}
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main content - layered for iOS-style push navigation */}
      <div className="relative z-10 min-h-screen">
        {/* Home screen - always rendered underneath, hidden when detail view is active */}
        <motion.div
          animate={{
            x: currentPerson ? -100 : 0,
            opacity: currentPerson ? 0 : 1,
          }}
          transition={{
            type: "spring",
            stiffness: 300,
            damping: 30,
          }}
          style={{
            pointerEvents: currentPerson ? "none" : "auto",
          }}
        >
          {renderHomeScreen()}
        </motion.div>

        {/* Detail view - slides over home screen */}
        <AnimatePresence>
          {currentPerson && (
            <motion.div
              key={currentPersonId}
              initial={{ x: "100%" }}
              animate={{
                x: isDragging ? dragX : 0,
                boxShadow: `-10px 0 30px rgba(0,0,0,${isDragging ? 0.1 + (dragX / screenWidth) * 0.1 : 0.15})`,
              }}
              exit={{ x: "100%" }}
              transition={isDragging ? {
                type: "tween",
                duration: 0,
              } : {
                type: "spring",
                stiffness: 300,
                damping: 30,
              }}
              className="fixed inset-0 bg-amber-50"
            >
              <div className="absolute inset-0 bg-[url('/paper-texture.png')] bg-repeat opacity-30 pointer-events-none" />
              <div className="absolute inset-0 bg-gradient-to-b from-amber-50/90 to-amber-50/95 pointer-events-none" />
              <div
                className="absolute inset-0 overflow-y-auto overscroll-contain z-10"
                style={{ WebkitOverflowScrolling: "touch", touchAction: "pan-y" }}
              >
                {renderPersonDetail()}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Swipe indicator - shows when dragging from edge */}
      <AnimatePresence>
        {isDragging && (
          <motion.div
            className="fixed left-0 top-1/2 -translate-y-1/2 z-20 pointer-events-none"
            initial={{ opacity: 0, x: -20 }}
            animate={{
              opacity: Math.min(dragX / 100, 1),
              x: Math.min(dragX * 0.3, 30),
            }}
            exit={{ opacity: 0, x: -20 }}
          >
            <div className="bg-amber-500/80 text-white rounded-r-full py-3 px-4 shadow-lg">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Image Modal */}
      {modalImages && (
        <ImageModal
          images={modalImages}
          initialIndex={modalInitialIndex}
          onClose={closeImageModal}
          nodeMap={nodeMap}
        />
      )}

      {/* Upload Modal */}
      {showUploadModal && uploadNodeId && (
        <MobileImageUploadModal
          nodeId={uploadNodeId}
          allNodes={nodes}
          onClose={closeUploadModal}
          onUploadComplete={handleUploadComplete}
        />
      )}
    </div>
  );
}

// Main export wraps with I18nProvider
export default function MobileFamilyTree({ nodes }: MobileFamilyTreeProps) {
  return (
    <I18nProvider>
      <MobileFamilyTreeInner nodes={nodes} />
    </I18nProvider>
  );
}
