"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { FamilyNode, PartnerLink, PartnershipType, DateInfo } from "@/types/family";
import { ImageMetadata } from "@/types/image";
import { useI18n } from "@/lib/i18n";
import PinyinText from "./PinyinText";
import { ImageGallery, ImageUploader, ImageUploadModal, AvatarCropper, AvatarDisplay } from "./images";

interface HistoricalEvent {
  name: string;
  name_zh: string;
  start_year: number;
  end_year: number;
}
import {
  DateInput,
  NameInputGroup,
  GenderSelector,
  AttributesEditor,
  PersonSelector,
} from "@/components/forms";
import { computeGenerations } from "@/lib/validation";

function getParentId(ref: string | { id: string }): string {
  return typeof ref === "string" ? ref : ref.id;
}

function getPartnerId(ref: string | PartnerLink): string {
  return typeof ref === "string" ? ref : ref.id;
}

function toPartnerLink(ref: string | PartnerLink): PartnerLink {
  return typeof ref === "string" ? { id: ref } : ref;
}

// Chinese zodiac calculation
function getChineseZodiac(year: number): string {
  const zodiacEmojis = ["🐀", "🐂", "🐅", "🐇", "🐉", "🐍", "🐴", "🐐", "🐒", "🐓", "🐕", "🐖"];
  // Rat is index 0, corresponds to years like 2020, 2008, 1996...
  // Formula: (year - 4) % 12 gives the correct index
  const index = (year - 4) % 12;
  return zodiacEmojis[index];
}

// Accurate age calculation that accounts for month/day
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

interface NodeDetailPanelProps {
  person: FamilyNode;
  existingNodes: FamilyNode[];
  isEditing: boolean;
  onEditStart: () => void;
  onEditCancel: () => void;
  onSave: (params: {
    node: FamilyNode;
    childrenToLink?: string[];
    childrenToUnlink?: string[];
  }) => { success: boolean; error?: string };
  onDelete?: (nodeId: string) => Promise<{ success: boolean; error?: string }>;
  onAddChild?: (parent: FamilyNode) => void;
  onAddSpouse?: (partner: FamilyNode) => void;
  onRefresh?: () => Promise<void>;
  contentIndent?: number;
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return "?";
  return dateStr.replace(/-/g, ".");
}

export default function NodeDetailPanel({
  person,
  existingNodes,
  isEditing,
  onEditStart,
  onEditCancel,
  onSave,
  onDelete,
  onAddChild,
  onAddSpouse,
  onRefresh,
  contentIndent = 0,
}: NodeDetailPanelProps) {
  const { t, lang } = useI18n();
  const [editedNode, setEditedNode] = useState<FamilyNode>(person);
  const [parentIds, setParentIds] = useState<string[]>([]);
  const [partnerLinks, setPartnerLinks] = useState<PartnerLink[]>([]);
  const [childIds, setChildIds] = useState<string[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nameErrors, setNameErrors] = useState<{
    primary_zh?: string;
    pinyin?: string;
  }>({});
  const [historicalEvents, setHistoricalEvents] = useState<HistoricalEvent[]>([]);
  const [showAvatarCropper, setShowAvatarCropper] = useState(false);
  const [avatarImageUrl, setAvatarImageUrl] = useState<string | null>(null);
  const [avatarImageId, setAvatarImageId] = useState<string | null>(null);
  const [imagesKey, setImagesKey] = useState(0); // For refreshing gallery
  const [showUploadModal, setShowUploadModal] = useState(false);

  // Load historical events
  useEffect(() => {
    fetch("/events.json")
      .then((res) => res.json())
      .then((data) => setHistoricalEvents(data.events || []))
      .catch(() => setHistoricalEvents([]));
  }, []);

  // Calculate which events the person lived through and their age during each
  const livedThroughEvents = useMemo(() => {
    const birthDate = person.vital_stats?.birth?.date_iso;
    if (!birthDate) return [];

    const birthYear = parseInt(birthDate.substring(0, 4), 10);
    if (isNaN(birthYear)) return [];

    const deathDate = person.vital_stats?.death?.date_iso;
    const deathYear = deathDate
      ? parseInt(deathDate.substring(0, 4), 10)
      : new Date().getFullYear();

    return historicalEvents
      .filter((event) => {
        // Person was alive during the event if:
        // - They were born before or during the event
        // - They died after or during the event (or are still alive)
        return birthYear <= event.end_year && deathYear >= event.start_year;
      })
      .map((event) => {
        // Calculate age at start of event
        const ageAtStart = event.start_year - birthYear;
        return {
          ...event,
          ageAtStart: Math.max(0, ageAtStart),
        };
      })
      .sort((a, b) => a.start_year - b.start_year);
  }, [person.vital_stats?.birth?.date_iso, person.vital_stats?.death?.date_iso, historicalEvents]);

  // Calculate original children (nodes that have this person as a parent)
  const originalChildIds = useMemo(() => {
    return existingNodes
      .filter((n) =>
        n.parent_ids?.some((ref) => getParentId(ref) === person.id)
      )
      .map((n) => n.id);
  }, [person.id, existingNodes]);

  // Reset edited node when person changes or editing starts
  useEffect(() => {
    setEditedNode(person);
    setParentIds(person.parent_ids?.map(getParentId) || []);
    setPartnerLinks(person.partner_ids?.map(toPartnerLink) || []);
    setChildIds(originalChildIds);
    setError(null);
    setNameErrors({});
  }, [person, isEditing, originalChildIds]);

  const handleSave = () => {
    // Validate
    const newNameErrors: typeof nameErrors = {};
    if (!editedNode.names.primary_zh.trim()) {
      newNameErrors.primary_zh = t("chineseNameRequired");
    }

    if (Object.keys(newNameErrors).length > 0) {
      setNameErrors(newNameErrors);
      return;
    }

    setError(null);

    // Build updated node with relationships
    const updatedNode: FamilyNode = {
      ...editedNode,
      parent_ids: parentIds.length > 0 ? parentIds : undefined,
      partner_ids: partnerLinks.length > 0 ? partnerLinks : undefined,
    };

    // Calculate children to link/unlink
    const childrenToLink = childIds.filter((id) => !originalChildIds.includes(id));
    const childrenToUnlink = originalChildIds.filter((id) => !childIds.includes(id));

    const result = onSave({
      node: updatedNode,
      childrenToLink: childrenToLink.length > 0 ? childrenToLink : undefined,
      childrenToUnlink: childrenToUnlink.length > 0 ? childrenToUnlink : undefined,
    });

    if (!result.success) {
      setError(result.error || t("failedToSave"));
    }
  };

  const handleCancel = () => {
    setEditedNode(person);
    setParentIds(person.parent_ids?.map(getParentId) || []);
    setPartnerLinks(person.partner_ids?.map(toPartnerLink) || []);
    setChildIds(originalChildIds);
    setError(null);
    setNameErrors({});
    setShowDeleteConfirm(false);
    onEditCancel();
  };

  // Handle setting avatar from an image
  const handleSetAvatar = useCallback(async (imageId: string) => {
    // Fetch the image to get its URL
    try {
      const response = await fetch(`/api/images/${imageId}`);
      const data = await response.json();
      if (data.success && data.image) {
        setAvatarImageId(imageId);
        setAvatarImageUrl(data.image.storage_url);
        setShowAvatarCropper(true);
      }
    } catch (error) {
      console.error("Error fetching image for avatar:", error);
    }
  }, []);

  // Handle avatar crop save
  const handleAvatarCropSave = useCallback(async () => {
    setShowAvatarCropper(false);
    setAvatarImageId(null);
    setAvatarImageUrl(null);
    // Refresh the data to show updated avatar
    if (onRefresh) {
      await onRefresh();
    }
  }, [onRefresh]);

  // Handle avatar crop cancel
  const handleAvatarCropCancel = useCallback(() => {
    setShowAvatarCropper(false);
    setAvatarImageId(null);
    setAvatarImageUrl(null);
  }, []);

  // Handle image upload complete
  const handleImageUploadComplete = useCallback((image: ImageMetadata) => {
    // Refresh the gallery by changing the key
    setImagesKey(prev => prev + 1);
  }, []);

  const handleDelete = async () => {
    if (!onDelete) return;

    setIsDeleting(true);
    setError(null);

    try {
      const result = await onDelete(person.id);
      if (!result.success) {
        setError(result.error || t("failedToSave"));
        setShowDeleteConfirm(false);
      }
      // If successful, the node will be removed and this panel will unmount
    } catch (err) {
      setError(err instanceof Error ? err.message : t("failedToSave"));
      setShowDeleteConfirm(false);
    } finally {
      setIsDeleting(false);
    }
  };

  // Nodes available for selection (exclude self and placeholders)
  const selectableNodes = existingNodes.filter(
    (n) => n.id !== person.id && !n.id.includes("_placeholder")
  );

  // Compute generations for all nodes
  const generations = useMemo(() => {
    return computeGenerations(existingNodes);
  }, [existingNodes]);

  // Get parents
  const parents = (person.parent_ids || []).map((ref) => {
    const id = getParentId(ref);
    return existingNodes.find((n) => n.id === id);
  }).filter(Boolean) as FamilyNode[];

  const father = parents.find((p) => p.gender === "male");
  const mother = parents.find((p) => p.gender === "female");

  // Get children
  const children = existingNodes.filter((n) =>
    n.parent_ids?.some((ref) => getParentId(ref) === person.id)
  ).sort((a, b) => {
    const ad = a.vital_stats?.birth?.date_iso || "";
    const bd = b.vital_stats?.birth?.date_iso || "";
    return ad.localeCompare(bd);
  });

  // Get spouses with their relationship info
  const spousesWithInfo = (person.partner_ids || []).map((ref) => {
    const link = toPartnerLink(ref);
    const node = existingNodes.find((n) => n.id === link.id);
    return node ? { node, link } : null;
  }).filter(Boolean) as { node: FamilyNode; link: PartnerLink }[];

  const spouses = spousesWithInfo.map(s => s.node);

  // Age threshold above which someone with unknown death date is presumed deceased
  const PRESUMED_DEAD_AGE = 100;

  // Calculate status
  const getStatus = () => {
    const birthDate = person.vital_stats?.birth?.date_iso;
    const deathDate = person.vital_stats?.death?.date_iso;

    if (!birthDate) {
      return { text: t("statusUnknown"), color: "text-gray-500" };
    }

    const birthYear = parseInt(birthDate.substring(0, 4), 10);
    const currentYear = new Date().getFullYear();

    if (deathDate) {
      const deathYear = parseInt(deathDate.substring(0, 4), 10);
      const age = deathYear - birthYear;
      return { text: `${t("statusPassed")} ${age} ${t("years")}`, color: "text-gray-600" };
    } else {
      const age = currentYear - birthYear;
      // If age exceeds threshold, presume deceased with unknown age
      if (age > PRESUMED_DEAD_AGE) {
        return { text: t("statusPassedUnknownAge"), color: "text-gray-600" };
      }
      return { text: `${t("statusLiving")} ${age} ${t("years")}`, color: "text-emerald-600" };
    }
  };

  const status = getStatus();

  // View mode - minimum width ensures controls always have space
  const panelMinWidth = 700;

  // Calculate birth/death years for timeline
  const birthYear = person.vital_stats?.birth?.date_iso
    ? parseInt(person.vital_stats.birth.date_iso.substring(0, 4), 10)
    : null;
  const deathYear = person.vital_stats?.death?.date_iso
    ? parseInt(person.vital_stats.death.date_iso.substring(0, 4), 10)
    : null;
  const currentYear = new Date().getFullYear();

  // Build vital line: "b. 1954 · living · 72 years old" or "1954–2020 · 66 years old"
  const buildVitalLine = () => {
    const parts: string[] = [];
    const birthDateIso = person.vital_stats?.birth?.date_iso;
    const deathDateIso = person.vital_stats?.death?.date_iso;

    if (birthYear) {
      const birthPrefix = person.vital_stats?.birth?.is_approximate ? "c. " : "";
      const zodiac = getChineseZodiac(birthYear);

      if (deathYear) {
        // Deceased: "🐴 · 1954–2020"
        const deathSuffix = person.vital_stats?.death?.is_approximate ? "?" : "";
        parts.push(`${zodiac}`);
        parts.push(`${birthPrefix}${birthYear}–${deathYear}${deathSuffix}`);
        const age = calculateAge(birthDateIso, deathDateIso);
        if (age !== null) {
          parts.push(`${age} ${t("yearsOld")}`);
        }
      } else {
        // Living or presumed deceased
        const age = calculateAge(birthDateIso);
        if (age !== null && age > PRESUMED_DEAD_AGE) {
          parts.push(`${zodiac}`);
          parts.push(`${birthPrefix}${birthYear}`);
          parts.push(t("statusPassedUnknownAge"));
        } else if (age !== null) {
          parts.push(`${zodiac}`);
          parts.push(`${birthPrefix}${birthYear}`);
          parts.push(t("statusLivingShort"));
          parts.push(`${age} ${t("yearsOld")}`);
        }
      }
    }

    return parts;
  };

  const vitalParts = buildVitalLine();

  // Determine if person is deceased
  const isDeceased = deathYear || (birthYear && (currentYear - birthYear) > PRESUMED_DEAD_AGE);

  if (!isEditing) {
    return (
      <div
        className="bg-white py-8 pr-8 shadow-[inset_0_4px_8px_-4px_rgba(0,0,0,0.1),inset_0_-4px_8px_-4px_rgba(0,0,0,0.1)] my-1 relative overflow-hidden"
        style={{
          paddingLeft: 32 + contentIndent,
          minWidth: panelMinWidth + contentIndent
        }}
      >
        {/* Chrysanthemum watermark for deceased */}
        {isDeceased && (
          <img
            src="/chrysanthemum.png"
            alt=""
            className="absolute pointer-events-none grayscale"
            style={{ left: 32 + contentIndent, top: '10%', opacity: 0.2, scale: 1.3 }}
          />
        )}
        <div className="max-w-3xl relative">
          {/* Header: Name + Actions */}
          <div className="flex items-start justify-between mb-6">
            <div className="flex items-start gap-4" style={{ marginTop: -14 }}>
              {/* Avatar */}
              {person.avatar && (
                <AvatarDisplay person={person} size="xl" className="flex-shrink-0" style={{ marginTop: 20 }} />
              )}
              <div>
                {/* Name - large Chinese characters with pinyin above */}
                <div className="flex items-end gap-4 mb-1">
                  <div className="text-5xl text-gray-900 tracking-wide" style={{ lineHeight: 0 }}>
                    <PinyinText
                      text={person.names.primary_zh}
                      rubyClassName="text-xs font-normal text-gray-400"
                      charClassName="font-chinese"
                      charStyle={{ textShadow: "-5px 5px 4px #ababab" }}
                    />
                  </div>
                  {person.names.pinyin && (
                    <span className="text-xl text-gray-400 font-light pb-1">
                      {person.names.pinyin}
                    </span>
                  )}
                </div>
                {/* Vital line */}
                {vitalParts.length > 0 && (
                  <div className="flex items-center gap-4 mt-3">
                    <span className="text-sm text-gray-400 font-light tracking-wider flex items-center">
                      {vitalParts.map((part, i) => (
                        <span key={i} className="flex items-center">
                          {i > 0 && <span className="mx-2">·</span>}
                          <span className={`${i === 0 ? "text-lg" : ""} ${i === 2 && !deathYear && birthYear && (currentYear - birthYear) <= PRESUMED_DEAD_AGE ? "text-emerald-600" : ""}`}>
                            {part}
                          </span>
                        </span>
                      ))}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Action buttons - kept obvious */}
            <div className="flex gap-1">
              {onAddChild && (
                <button
                  onClick={() => onAddChild(person)}
                  className="px-3 py-1.5 text-sm font-medium text-amber-700 hover:text-amber-800 bg-amber-50 hover:bg-amber-100 rounded transition-colors cursor-pointer"
                >
                  + {t("addChild")}
                </button>
              )}
              {onAddSpouse && (
                <button
                  onClick={() => onAddSpouse(person)}
                  className="px-3 py-1.5 text-sm font-medium text-amber-700 hover:text-amber-800 bg-amber-50 hover:bg-amber-100 rounded transition-colors cursor-pointer"
                >
                  + {t("addSpouse")}
                </button>
              )}
              <button
                onClick={onEditStart}
                className="px-3 py-1.5 text-sm font-medium text-amber-700 hover:text-amber-800 bg-amber-50 hover:bg-amber-100 rounded transition-colors cursor-pointer"
              >
                {t("edit")}
              </button>
            </div>
          </div>

          {/* Family relationships - structured layout */}
          <div className="space-y-4 mb-6">
            {/* Parents row */}
            {(father || mother) && (
              <div className="flex items-center gap-8">
                {father && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs uppercase tracking-wider text-gray-400 leading-none">{t("father")}</span>
                    <span className="font-chinese text-lg text-gray-800 leading-none">{father.names.primary_zh}</span>
                  </div>
                )}
                {mother && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs uppercase tracking-wider text-gray-400 leading-none">{t("mother")}</span>
                    <span className="font-chinese text-lg text-gray-800 leading-none">{mother.names.primary_zh}</span>
                  </div>
                )}
              </div>
            )}

            {/* Spouse */}
            {spousesWithInfo.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-xs uppercase tracking-wider text-gray-400 leading-none">
                  {spousesWithInfo.some(s => s.link.type === "divorced") ? t("spouse") : t("spouse")}
                </span>
                <div className="flex items-center gap-4">
                  {spousesWithInfo.map(({ node: spouse, link }) => {
                    const isDivorced = link.type === "divorced";
                    return (
                      <span key={spouse.id} className="flex items-center gap-1.5">
                        <span className={`font-chinese text-lg leading-none ${isDivorced ? "text-gray-500" : "text-gray-800"}`}>
                          {spouse.names.primary_zh}
                        </span>
                        {isDivorced && (
                          <span className="text-xs text-gray-400 italic">
                            ({t("divorced")})
                          </span>
                        )}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Children */}
            {children.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-xs uppercase tracking-wider text-gray-400 leading-none">{t("children")}</span>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                  {children.map((child) => (
                    <span key={child.id} className="font-chinese text-lg text-gray-800 leading-none">
                      {child.names.primary_zh}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Timeline visualization for historical events - allowed to overflow right */}
        {livedThroughEvents.length > 0 && birthYear && (
          <div className="mb-6 -mr-8 pr-8">
            <div className="relative">
              {/* Timeline axis */}
              <div className="h-px bg-amber-300 absolute top-3 left-0 right-0" />

              {/* Events (including birth) */}
              <div className="flex items-start pt-10 gap-6 overflow-x-auto pb-2">
                {/* Birth marker */}
                <div className="flex flex-col items-center min-w-fit relative">
                  <div className="absolute -top-8 w-2 h-2 rounded-full bg-amber-400 border border-amber-500" />
                  <div className="px-2.5 py-1 rounded text-xs font-medium bg-amber-600 text-white">
                    {birthYear}
                  </div>
                  <div className="text-xs text-amber-600 mt-2">
                    {t("born")}
                  </div>
                </div>
                {livedThroughEvents.map((event) => {
                  const eventName = lang === "zh" ? event.name_zh : event.name;
                  // Color intensity based on age during event (younger = more formative)
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
                      <div className="absolute -top-8 w-2 h-2 rounded-full bg-amber-400 border border-amber-500" />
                      <div className={`px-2.5 py-1 rounded text-xs font-medium ${intensity}`}>
                        {eventName}
                      </div>
                      <div className="text-xs text-amber-600 mt-2">
                        {event.ageAtStart} {t("yearsOld")}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Description, Notes & links - back to contained width */}
        <div className="max-w-3xl">
          {/* Description - biographical overview */}
          {Boolean(person.attributes?.description) && (
            <div className="mt-6 p-4 pl-4 bg-amber-50/50 border-l-2 border-amber-300 rounded-r-lg max-w-xl">
              <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                {String(person.attributes!.description)}
              </p>
            </div>
          )}

          {/* Notes - short inline note */}
          {Boolean(person.attributes?.note) && (
            <p className="mt-4 text-sm text-gray-500 italic max-w-xl">
              {String(person.attributes!.note)}
            </p>
          )}

          {/* External link */}
          {Boolean(person.attributes?.link) && (
            <div className="mt-4">
              <a
                href={String(person.attributes!.link)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 underline underline-offset-2 decoration-gray-300 hover:decoration-gray-500 transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                {t("viewLink")}
              </a>
            </div>
          )}

          {/* Photos section */}
          <div className="mt-6">
            <div className="flex items-center gap-2 mb-3">
              <h4 className="text-xs uppercase tracking-wider text-gray-400">{t("photos")}</h4>
              <button
                onClick={() => setShowUploadModal(true)}
                className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 active:bg-amber-200 border border-amber-200 hover:border-amber-300 rounded-full transition-all cursor-pointer hover:shadow-sm active:scale-95"
                title={t("addPhoto")}
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                </svg>
                <span>{t("addPhoto")}</span>
              </button>
            </div>
            <ImageGallery
              key={imagesKey}
              nodeId={person.id}
              allNodes={existingNodes}
              isEditing={false}
              hasAvatar={!!person.avatar}
              onSetAvatar={handleSetAvatar}
            />
          </div>

          {/* Upload modal */}
          {showUploadModal && (
            <ImageUploadModal
              nodeId={person.id}
              allNodes={existingNodes}
              onClose={() => setShowUploadModal(false)}
              onUploadComplete={() => {
                setImagesKey((k) => k + 1);
              }}
            />
          )}

          {/* Avatar cropper modal */}
          {showAvatarCropper && avatarImageUrl && avatarImageId && (
            <AvatarCropper
              imageUrl={avatarImageUrl}
              imageId={avatarImageId}
              nodeId={person.id}
              onSave={handleAvatarCropSave}
              onCancel={handleAvatarCropCancel}
            />
          )}
        </div>
      </div>
    );
  }

  // Edit mode
  return (
    <div
      className="bg-white py-5 pr-8 shadow-[inset_0_4px_8px_-4px_rgba(0,0,0,0.15),inset_0_-4px_8px_-4px_rgba(0,0,0,0.15)] my-1"
      style={{
        paddingLeft: 32 + contentIndent,
        minWidth: panelMinWidth + contentIndent
      }}
    >
      {/* Error message */}
      {error && (
        <div className="p-3 mb-4 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Two-column layout for personal info and relationships */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-4xl">
        {/* Left column: Personal info */}
        <div className="space-y-4">
          <NameInputGroup
            value={editedNode.names}
            onChange={(names) =>
              setEditedNode((n) => ({ ...n, names }))
            }
            errors={nameErrors}
          />

          <GenderSelector
            value={editedNode.gender}
            onChange={(gender) =>
              setEditedNode((n) => ({ ...n, gender }))
            }
          />

          <div className="grid grid-cols-2 gap-4">
            <DateInput
              label={t("birthDate")}
              value={editedNode.vital_stats?.birth}
              onChange={(birth) =>
                setEditedNode((n) => ({
                  ...n,
                  vital_stats: { ...n.vital_stats, birth },
                }))
              }
            />
            <DateInput
              label={t("deathDate")}
              value={editedNode.vital_stats?.death}
              onChange={(death) =>
                setEditedNode((n) => ({
                  ...n,
                  vital_stats: { ...n.vital_stats, death },
                }))
              }
            />
          </div>

          <AttributesEditor
            value={editedNode.attributes || {}}
            onChange={(attributes) =>
              setEditedNode((n) => ({ ...n, attributes }))
            }
          />
        </div>

        {/* Right column: Relationships */}
        <div className="space-y-4 lg:border-l lg:border-gray-200 lg:pl-8">
          <h4 className="text-sm font-medium text-gray-700">{t("relationships")}</h4>

          <PersonSelector
            label={t("parentsMax2")}
            nodes={selectableNodes}
            selectedIds={parentIds}
            onChange={setParentIds}
            excludeIds={[...childIds]}
            multiple
            maxSelections={2}
            placeholder={t("searchParents")}
            generations={generations}
            selectorField="parents"
          />

          {/* Partner/Spouse section with divorce support */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">{t("partnerSpouse")}</label>

            {/* Existing partners with edit options */}
            {partnerLinks.length > 0 && (
              <div className="space-y-3">
                {partnerLinks.map((link) => {
                  const partnerNode = selectableNodes.find(n => n.id === link.id);
                  if (!partnerNode) return null;

                  const isMale = partnerNode.gender === "male";
                  const isFemale = partnerNode.gender === "female";
                  const bgColor = isMale
                    ? "bg-blue-50 border-blue-200"
                    : isFemale
                    ? "bg-pink-50 border-pink-200"
                    : "bg-gray-50 border-gray-200";

                  return (
                    <div key={link.id} className={`p-3 rounded-lg border ${bgColor}`}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-chinese text-lg">{partnerNode.names.primary_zh}</span>
                        <button
                          type="button"
                          onClick={() => setPartnerLinks(partnerLinks.filter(p => p.id !== link.id))}
                          className="text-gray-400 hover:text-red-500 transition-colors"
                        >
                          ✕
                        </button>
                      </div>

                      <div className="flex flex-wrap gap-3">
                        {/* Partnership status selector */}
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-500">{t("partnershipStatus")}:</span>
                          <select
                            value={link.type || "married"}
                            onChange={(e) => {
                              const newType = e.target.value as PartnershipType;
                              setPartnerLinks(partnerLinks.map(p =>
                                p.id === link.id
                                  ? { ...p, type: newType, divorce_date: newType === "divorced" ? p.divorce_date : undefined }
                                  : p
                              ));
                            }}
                            className="text-sm border border-gray-300 rounded px-2 py-1 focus:ring-amber-400 focus:border-amber-400"
                          >
                            <option value="married">{t("married")}</option>
                            <option value="divorced">{t("divorced")}</option>
                            <option value="widowed">{t("widowed")}</option>
                            <option value="partner">{t("partner")}</option>
                          </select>
                        </div>

                        {/* Divorce date (only shown if divorced) */}
                        {link.type === "divorced" && (
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-500">{t("divorceDate")}:</span>
                            <input
                              type="text"
                              placeholder="YYYY-MM-DD"
                              value={link.divorce_date?.date_iso || ""}
                              onChange={(e) => {
                                const value = e.target.value;
                                setPartnerLinks(partnerLinks.map(p =>
                                  p.id === link.id
                                    ? { ...p, divorce_date: value ? { date_iso: value } : undefined }
                                    : p
                                ));
                              }}
                              className="text-sm border border-gray-300 rounded px-2 py-1 w-32 focus:ring-amber-400 focus:border-amber-400"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Add new partner */}
            <PersonSelector
              label=""
              nodes={selectableNodes}
              selectedIds={[]}
              onChange={(ids) => {
                if (ids.length > 0) {
                  const newId = ids[0];
                  if (!partnerLinks.some(p => p.id === newId)) {
                    setPartnerLinks([...partnerLinks, { id: newId, type: "married" }]);
                  }
                }
              }}
              excludeIds={[...parentIds, ...childIds, ...partnerLinks.map(p => p.id)]}
              placeholder={t("searchPartner")}
              generations={generations}
              selectorField="partners"
            />
          </div>

          <PersonSelector
            label={t("children")}
            nodes={selectableNodes}
            selectedIds={childIds}
            onChange={setChildIds}
            excludeIds={[...parentIds]}
            multiple
            placeholder={t("searchChildren")}
            generations={generations}
            selectorField="children"
          />
        </div>
      </div>

      {/* Photos section in edit mode */}
      <div className="mt-6 pt-6 border-t border-gray-200 max-w-4xl">
        <h4 className="text-sm font-medium text-gray-700 mb-3">{t("photos")}</h4>

        {/* Image gallery with edit capabilities */}
        <div className="mb-4">
          <ImageGallery
            key={imagesKey}
            nodeId={person.id}
            allNodes={existingNodes}
            isEditing={true}
            hasAvatar={!!person.avatar}
            onSetAvatar={handleSetAvatar}
          />
        </div>

        {/* Image uploader */}
        <div className="mt-4">
          <ImageUploader
            nodeId={person.id}
            allNodes={existingNodes}
            onUploadComplete={handleImageUploadComplete}
          />
        </div>
      </div>

      {/* Avatar cropper modal */}
      {showAvatarCropper && avatarImageUrl && avatarImageId && (
        <AvatarCropper
          imageUrl={avatarImageUrl}
          imageId={avatarImageId}
          nodeId={person.id}
          initialCrop={person.avatar ? {
            cropX: person.avatar.cropX,
            cropY: person.avatar.cropY,
            cropWidth: person.avatar.cropWidth,
            cropHeight: person.avatar.cropHeight,
          } : undefined}
          onSave={handleAvatarCropSave}
          onCancel={handleAvatarCropCancel}
        />
      )}

      {/* Action buttons */}
      <div className="flex gap-3 pt-6 mt-6 border-t border-gray-200 max-w-4xl">
        <button
          onClick={handleSave}
          disabled={isDeleting}
          className="px-4 py-2 bg-amber-500 text-white rounded-md text-sm font-medium hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {t("saveChanges")}
        </button>
        <button
          onClick={handleCancel}
          disabled={isDeleting}
          className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
        >
          {t("cancel")}
        </button>

        {/* Delete button - pushed to the right */}
        {onDelete && (
          <div className="ml-auto">
            {showDeleteConfirm ? (
              <div className="flex items-center gap-2">
                <span className="text-sm text-red-600">{t("confirmDelete")}</span>
                <button
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="px-3 py-1.5 bg-red-500 text-white rounded-md text-sm font-medium hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isDeleting && (
                    <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  )}
                  {isDeleting ? t("deleting") : t("delete")}
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={isDeleting}
                  className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800"
                >
                  {t("cancel")}
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="px-4 py-2 text-sm text-red-600 hover:text-red-700 hover:bg-red-50 rounded-md transition-colors"
              >
                {t("delete")}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
