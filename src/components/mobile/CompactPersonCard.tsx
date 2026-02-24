"use client";

import { FamilyNode } from "@/types/family";
import PersonAvatar from "./PersonAvatar";
import { useI18n } from "@/lib/i18n";

interface CompactPersonCardProps {
  person: FamilyNode;
  onSelect?: () => void;
  showChevron?: boolean;
}

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

export default function CompactPersonCard({ person, onSelect, showChevron = true }: CompactPersonCardProps) {
  const { t } = useI18n();
  const birthDate = person.vital_stats?.birth?.date_iso;
  const deathDate = person.vital_stats?.death?.date_iso;
  const isDeceased = isPersonDeceased(birthDate, deathDate);
  const age = calculateAge(birthDate, deathDate);
  const living = isPersonLiving(birthDate, deathDate);

  const content = (
    <div
      className={`
        relative overflow-hidden flex items-center gap-3 px-3 py-3 rounded-xl
        bg-white/70 backdrop-blur-sm
        border border-amber-200/60
        shadow-sm
        ${onSelect ? "active:scale-[0.98] active:bg-amber-50" : ""}
        transition-all duration-150
      `}
    >
      {isDeceased && (
        <img
          src="/chrysanthemum.png"
          alt=""
          className="absolute right-6 -bottom-[52px] scale-[0.8] grayscale opacity-30 pointer-events-none"
        />
      )}
      <PersonAvatar person={person} size="sm" />

      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <span className={`font-semibold text-gray-800 truncate ${person.names.primary_zh ? "font-chinese" : ""}`}>
            {person.names.primary_zh || person.names.pinyin}
          </span>
          {age !== null && (
            <span className={`text-xs flex-shrink-0 ${living ? "text-emerald-600" : "text-gray-400"}`}>
              {living ? `${age}${t("years")}` : deathDate ? `${t("statusPassed")}${age}${t("years")}` : t("statusPassedUnknownAge")}
            </span>
          )}
        </div>
        {person.names.pinyin && person.names.primary_zh && (
          <div className="text-xs text-gray-500 truncate">{person.names.pinyin}</div>
        )}
      </div>

      {showChevron && onSelect && (
        <svg className="w-5 h-5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      )}
    </div>
  );

  if (onSelect) {
    return (
      <button onClick={onSelect} className="w-full text-left">
        {content}
      </button>
    );
  }

  return content;
}
