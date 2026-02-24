"use client";

import { useMemo } from "react";
import { FamilyNode } from "@/types/family";
import { useI18n } from "@/lib/i18n";

interface UpcomingDatesBannerProps {
  nodes: FamilyNode[];
  onNavigateToNode?: (nodeId: string) => void;
}

interface UpcomingDate {
  node: FamilyNode;
  date: Date;
  type: "birthday" | "memorial";
  age?: number;
}

function getUpcomingDates(nodes: FamilyNode[], daysAhead: number = 30): UpcomingDate[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const upcoming: UpcomingDate[] = [];
  const currentYear = today.getFullYear();

  const nodesWithAvatars = nodes.filter((node) => node.avatar?.croppedUrl || node.avatar?.imageId);

  for (const node of nodesWithAvatars) {
    const birthDate = node.vital_stats?.birth?.date_iso;
    const deathDate = node.vital_stats?.death?.date_iso;
    const isAlive = !deathDate;

    if (birthDate && birthDate.length >= 10 && isAlive) {
      const [birthYear, birthMonth, birthDay] = birthDate.split("-").map(Number);
      let birthdayThisYear = new Date(currentYear, birthMonth - 1, birthDay);

      if (birthdayThisYear < today) {
        birthdayThisYear = new Date(currentYear + 1, birthMonth - 1, birthDay);
      }

      const daysUntil = Math.ceil((birthdayThisYear.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

      if (daysUntil >= 0 && daysUntil <= daysAhead) {
        upcoming.push({
          node,
          date: birthdayThisYear,
          type: "birthday",
          age: birthdayThisYear.getFullYear() - birthYear,
        });
      }
    }

    if (deathDate && deathDate.length >= 10) {
      const [deathYear, deathMonth, deathDay] = deathDate.split("-").map(Number);
      let memorialThisYear = new Date(currentYear, deathMonth - 1, deathDay);

      if (memorialThisYear < today) {
        memorialThisYear = new Date(currentYear + 1, deathMonth - 1, deathDay);
      }

      const daysUntil = Math.ceil((memorialThisYear.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

      if (daysUntil >= 0 && daysUntil <= daysAhead) {
        upcoming.push({
          node,
          date: memorialThisYear,
          type: "memorial",
          age: memorialThisYear.getFullYear() - deathYear,
        });
      }
    }
  }

  return upcoming.sort((a, b) => a.date.getTime() - b.date.getTime());
}

function formatDate(date: Date, lang: string): string {
  return date.toLocaleDateString(lang === "zh" ? "zh-CN" : "en-US", {
    month: "short",
    day: "numeric",
  });
}

export default function UpcomingDatesBanner({ nodes, onNavigateToNode }: UpcomingDatesBannerProps) {
  const { t, lang } = useI18n();

  const upcomingDates = useMemo(() => getUpcomingDates(nodes, 30), [nodes]);

  if (upcomingDates.length === 0) {
    return null;
  }

  return (
    <div className="bg-gray-50 border-b border-gray-200 px-4 py-1 sm:py-2 flex-shrink-0">
      <div className="max-w-7xl mx-auto flex items-center gap-6 flex-wrap">
        {upcomingDates.map((item) => (
          <button
            key={`${item.node.id}-${item.type}`}
            onClick={() => onNavigateToNode?.(item.node.id)}
            className="flex items-center gap-2 hover:opacity-70 transition-opacity"
          >
            <span className="text-base">
              {item.type === "birthday" ? "🎂" : "🕯️"}
            </span>
            {item.node.avatar?.croppedUrl && (
              <img
                src={item.node.avatar.croppedUrl}
                alt={item.node.names.primary_zh}
                className="w-6 h-6 rounded-full object-cover"
              />
            )}
            <span className="font-medium text-gray-700">
              {item.node.names.primary_zh}
            </span>
            <span className="text-gray-500 text-sm">
              {formatDate(item.date, lang)}
              {item.age && (
                <span className="ml-1 text-gray-500">
                  ({item.type === "birthday" ? `${t("turningAge")} ${item.age}` : `${item.age} ${t("yearsAgo")}`})
                </span>
              )}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
