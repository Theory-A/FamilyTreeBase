"use client";

import { FamilyNode } from "@/types/family";
import PersonAvatar from "./PersonAvatar";
import { useRef, useState, useLayoutEffect, useEffect } from "react";
import { useI18n } from "@/lib/i18n";

interface MiniDiagramProps {
  currentPerson: FamilyNode;
  parents: FamilyNode[];
  children: FamilyNode[];
  spouse?: FamilyNode;
  onSelectPerson: (id: string) => void;
}

interface Position {
  x: number;
  y: number;
}

export default function MiniDiagram({
  currentPerson,
  parents,
  children,
  spouse,
  onSelectPerson,
}: MiniDiagramProps) {
  const { t } = useI18n();
  const father = parents.find(p => p.gender === "male");
  const mother = parents.find(p => p.gender === "female");

  // Limit children displayed to 5 for space
  const displayedChildren = children.slice(0, 5);
  const hasMoreChildren = children.length > 5;

  // Refs for measuring element positions
  const containerRef = useRef<HTMLDivElement>(null);
  const fatherRef = useRef<HTMLButtonElement>(null);
  const motherRef = useRef<HTMLButtonElement>(null);
  const singleParentRef = useRef<HTMLButtonElement>(null);
  const currentRef = useRef<HTMLDivElement>(null);
  const spouseRef = useRef<HTMLButtonElement>(null);
  const childrenRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Store calculated positions (center of each avatar)
  const [positions, setPositions] = useState<{
    father?: Position;
    mother?: Position;
    singleParent?: Position;
    current?: Position;
    spouse?: Position;
    children: Position[];
  }>({ children: [] });

  // Measure positions after render
  useLayoutEffect(() => {
    const measure = () => {
      if (!containerRef.current) return;

      const containerRect = containerRef.current.getBoundingClientRect();

      // Get center of an element's first child (the avatar)
      const getAvatarCenter = (el: HTMLElement | null): Position | undefined => {
        if (!el) return undefined;
        // Find the avatar element (first child or element with rounded-full class)
        const avatar = el.querySelector('[class*="rounded-full"]') || el.firstElementChild;
        if (!avatar) return undefined;
        const rect = avatar.getBoundingClientRect();
        return {
          x: rect.left - containerRect.left + rect.width / 2,
          y: rect.top - containerRect.top + rect.height / 2,
        };
      };

      // For current person, the avatar is inside the ring div
      const getCurrentCenter = (): Position | undefined => {
        if (!currentRef.current) return undefined;
        const ringDiv = currentRef.current.querySelector('.ring-2');
        if (!ringDiv) return undefined;
        const rect = ringDiv.getBoundingClientRect();
        return {
          x: rect.left - containerRect.left + rect.width / 2,
          y: rect.top - containerRect.top + rect.height / 2,
        };
      };

      setPositions({
        father: getAvatarCenter(fatherRef.current),
        mother: getAvatarCenter(motherRef.current),
        singleParent: getAvatarCenter(singleParentRef.current),
        current: getCurrentCenter(),
        spouse: getAvatarCenter(spouseRef.current),
        children: childrenRefs.current.map(ref => getAvatarCenter(ref)).filter((p): p is Position => p !== undefined),
      });
    };

    // Measure after a frame to ensure layout is complete
    requestAnimationFrame(() => {
      measure();
    });

    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [parents.length, displayedChildren.length, spouse]);

  // Also measure on mount after images might load
  useEffect(() => {
    const timer = setTimeout(() => {
      if (containerRef.current) {
        const event = new Event('resize');
        window.dispatchEvent(event);
      }
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  // Calculate key positions for lines
  const parentCenter = positions.father && positions.mother
    ? { x: (positions.father.x + positions.mother.x) / 2, y: positions.father.y }
    : positions.singleParent || positions.father || positions.mother;

  const coupleCenter = positions.current && positions.spouse
    ? { x: (positions.current.x + positions.spouse.x) / 2, y: Math.max(positions.current.y, positions.spouse.y) }
    : positions.current;

  const childrenBounds = positions.children.length > 0
    ? {
        left: Math.min(...positions.children.map(p => p.x)),
        right: Math.max(...positions.children.map(p => p.x)),
        top: Math.min(...positions.children.map(p => p.y)),
      }
    : null;

  return (
    <div ref={containerRef} className="relative w-full py-4">
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none overflow-visible"
        style={{ zIndex: 0 }}
      >
        {/* Lines from parents to current person */}
        {parentCenter && positions.current && (
          <>
            {/* Horizontal line between parents (if both exist) */}
            {positions.father && positions.mother && (
              <line
                x1={positions.father.x}
                y1={positions.father.y}
                x2={positions.mother.x}
                y2={positions.mother.y}
                stroke="#d4a574"
                strokeWidth="2"
                strokeDasharray="4 2"
              />
            )}
            {/* Vertical line from parent(s) center down */}
            <line
              x1={parentCenter.x}
              y1={parentCenter.y}
              x2={parentCenter.x}
              y2={positions.current.y - 24}
              stroke="#d4a574"
              strokeWidth="2"
            />
            {/* Horizontal jog to current person if needed */}
            {Math.abs(parentCenter.x - positions.current.x) > 2 && (
              <line
                x1={parentCenter.x}
                y1={positions.current.y - 24}
                x2={positions.current.x}
                y2={positions.current.y - 24}
                stroke="#d4a574"
                strokeWidth="2"
              />
            )}
            {/* Short vertical line down to current person */}
            <line
              x1={positions.current.x}
              y1={positions.current.y - 24}
              x2={positions.current.x}
              y2={positions.current.y - 20}
              stroke="#d4a574"
              strokeWidth="2"
            />
          </>
        )}

        {/* Marriage line to spouse */}
        {positions.current && positions.spouse && (
          <line
            x1={positions.current.x + 20}
            y1={positions.current.y}
            x2={positions.spouse.x - 20}
            y2={positions.spouse.y}
            stroke="#e88ca7"
            strokeWidth="2"
            strokeDasharray="4 2"
          />
        )}

        {/* Lines from current person to children */}
        {coupleCenter && childrenBounds && positions.children.length > 0 && (
          <>
            {/* Vertical line down from couple center */}
            <line
              x1={coupleCenter.x}
              y1={coupleCenter.y + 20}
              x2={coupleCenter.x}
              y2={childrenBounds.top - 24}
              stroke="#d4a574"
              strokeWidth="2"
            />
            {/* Horizontal bracket above children (if multiple children) */}
            {positions.children.length > 1 && (
              <line
                x1={childrenBounds.left}
                y1={childrenBounds.top - 24}
                x2={childrenBounds.right}
                y2={childrenBounds.top - 24}
                stroke="#d4a574"
                strokeWidth="2"
              />
            )}
            {/* Vertical lines down to each child */}
            {positions.children.map((pos, idx) => (
              <line
                key={idx}
                x1={pos.x}
                y1={childrenBounds.top - 24}
                x2={pos.x}
                y2={pos.y - 18}
                stroke="#d4a574"
                strokeWidth="2"
              />
            ))}
          </>
        )}
      </svg>

      <div className="relative" style={{ zIndex: 1 }}>
        {/* Parents Row */}
        {parents.length > 0 && (
          <div className="flex justify-center gap-8 mb-4">
            {father && (
              <button
                ref={fatherRef}
                onClick={() => onSelectPerson(father.id)}
                className="flex flex-col items-center gap-1 active:scale-95 transition-transform"
              >
                <PersonAvatar person={father} size="sm" />
                <span className="text-[10px] text-gray-600 truncate max-w-[60px]">
                  {father.names.primary_zh || father.names.pinyin || t("fatherShort")}
                </span>
              </button>
            )}
            {mother && (
              <button
                ref={motherRef}
                onClick={() => onSelectPerson(mother.id)}
                className="flex flex-col items-center gap-1 active:scale-95 transition-transform"
              >
                <PersonAvatar person={mother} size="sm" />
                <span className="text-[10px] text-gray-600 truncate max-w-[60px]">
                  {mother.names.primary_zh || mother.names.pinyin || t("motherShort")}
                </span>
              </button>
            )}
            {/* Handle single parent case */}
            {parents.length === 1 && !father && !mother && (
              <button
                ref={singleParentRef}
                onClick={() => onSelectPerson(parents[0].id)}
                className="flex flex-col items-center gap-1 active:scale-95 transition-transform"
              >
                <PersonAvatar person={parents[0]} size="sm" />
                <span className="text-[10px] text-gray-600 truncate max-w-[60px]">
                  {parents[0].names.primary_zh || parents[0].names.pinyin || t("parentShort")}
                </span>
              </button>
            )}
          </div>
        )}

        {/* Current Person + Spouse Row */}
        <div className="flex justify-center items-center gap-6 my-2">
          <div ref={currentRef} className="flex flex-col items-center">
            <div className="ring-2 ring-amber-400 ring-offset-2 rounded-full">
              <PersonAvatar person={currentPerson} size="sm" />
            </div>
            <span className={`text-[10px] font-semibold text-amber-700 mt-1 truncate max-w-[60px]`}>
              {currentPerson.names.primary_zh || currentPerson.names.pinyin}
            </span>
          </div>

          {spouse && (
            <button
              ref={spouseRef}
              onClick={() => onSelectPerson(spouse.id)}
              className="flex flex-col items-center active:scale-95 transition-transform"
            >
              <PersonAvatar person={spouse} size="sm" />
              <span className={`text-[10px] text-gray-600 mt-1 truncate max-w-[60px]`}>
                {spouse.names.primary_zh || spouse.names.pinyin || t("spouseShort")}
              </span>
            </button>
          )}
        </div>

        {/* Children Row */}
        {displayedChildren.length > 0 && (
          <div className="flex justify-center gap-3 mt-4 pt-2">
            {displayedChildren.map((child, idx) => (
              <button
                key={child.id}
                ref={el => { childrenRefs.current[idx] = el; }}
                onClick={() => onSelectPerson(child.id)}
                className="flex flex-col items-center gap-0.5 active:scale-95 transition-transform"
              >
                <PersonAvatar person={child} size="sm" />
                <span className={`text-[10px] text-gray-600 truncate max-w-[50px]`}>
                  {child.names.primary_zh || child.names.pinyin || t("childShort")}
                </span>
              </button>
            ))}
            {hasMoreChildren && (
              <div className="flex flex-col items-center gap-0.5">
                <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs text-gray-500">
                  +{children.length - 5}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
