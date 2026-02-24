"use client";

import { useMemo } from "react";
import { pinyin } from "pinyin-pro";

interface PinyinTextProps {
  text: string;
  className?: string;
  rubyClassName?: string;
  charClassName?: string;
  charStyle?: React.CSSProperties;
}

/**
 * Displays Chinese text with pinyin floating above each character.
 * Uses HTML ruby annotations for proper semantic markup.
 */
export default function PinyinText({
  text,
  className = "",
  rubyClassName = "",
  charClassName = "",
  charStyle,
}: PinyinTextProps) {
  const characters = useMemo(() => {
    if (!text) return [];

    // Get pinyin for each character
    const pinyinResult = pinyin(text, {
      type: "array",
      toneType: "symbol",
    });

    // Split text into individual characters and pair with pinyin
    return text.split("").map((char, index) => ({
      char,
      pinyin: pinyinResult[index] || "",
    }));
  }, [text]);

  if (!text) return null;

  return (
    <span className={className} style={{ display: "inline-flex" }}>
      {characters.map((item, index) => (
        <span
          key={index}
          style={{
            display: "inline-flex",
            flexDirection: "column",
            alignItems: "center",
            lineHeight: 1,
          }}
        >
          <span className={rubyClassName} style={{ marginBottom: 2 }}>{item.pinyin}</span>
          <span className={charClassName} style={charStyle}>{item.char}</span>
        </span>
      ))}
    </span>
  );
}
