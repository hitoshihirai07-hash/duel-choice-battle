import React from "react";

export type FxKind = "slash" | "impact" | "glow" | "buff" | "debuff" | "shield" | "charge";

export default function FxOverlay(props: { kind: FxKind }) {
  const { kind } = props;

  // Inline SVG（外部画像不要 & 超軽量）
  // 見た目は CSS でアニメーション。
  if (kind === "slash") {
    return (
      <svg className={`fxSvg fx-${kind}`} viewBox="0 0 100 100" aria-hidden="true">
        <path d="M18 78 L82 22" stroke="currentColor" strokeWidth="10" strokeLinecap="round" fill="none" />
        <path d="M28 86 L92 30" stroke="currentColor" strokeWidth="4" strokeLinecap="round" fill="none" opacity="0.5" />
      </svg>
    );
  }

  if (kind === "impact") {
    return (
      <svg className={`fxSvg fx-${kind}`} viewBox="0 0 100 100" aria-hidden="true">
        <circle cx="50" cy="50" r="18" fill="none" stroke="currentColor" strokeWidth="8" />
        <path d="M50 8 L50 24" stroke="currentColor" strokeWidth="6" strokeLinecap="round" />
        <path d="M50 76 L50 92" stroke="currentColor" strokeWidth="6" strokeLinecap="round" />
        <path d="M8 50 L24 50" stroke="currentColor" strokeWidth="6" strokeLinecap="round" />
        <path d="M76 50 L92 50" stroke="currentColor" strokeWidth="6" strokeLinecap="round" />
      </svg>
    );
  }

  if (kind === "glow") {
    return (
      <svg className={`fxSvg fx-${kind}`} viewBox="0 0 100 100" aria-hidden="true">
        <circle cx="50" cy="50" r="30" fill="currentColor" opacity="0.18" />
        <circle cx="50" cy="50" r="18" fill="currentColor" opacity="0.22" />
        <path d="M32 52 L46 66 L72 36" fill="none" stroke="currentColor" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  if (kind === "buff") {
    return (
      <svg className={`fxSvg fx-${kind}`} viewBox="0 0 100 100" aria-hidden="true">
        <path d="M50 18 L50 78" stroke="currentColor" strokeWidth="8" strokeLinecap="round" />
        <path d="M28 38 L50 18 L72 38" fill="none" stroke="currentColor" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M24 78 H76" stroke="currentColor" strokeWidth="6" strokeLinecap="round" opacity="0.65" />
      </svg>
    );
  }

  if (kind === "debuff") {
    return (
      <svg className={`fxSvg fx-${kind}`} viewBox="0 0 100 100" aria-hidden="true">
        <path d="M50 22 L50 82" stroke="currentColor" strokeWidth="8" strokeLinecap="round" />
        <path d="M28 62 L50 82 L72 62" fill="none" stroke="currentColor" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M24 22 H76" stroke="currentColor" strokeWidth="6" strokeLinecap="round" opacity="0.65" />
      </svg>
    );
  }

  if (kind === "shield") {
    return (
      <svg className={`fxSvg fx-${kind}`} viewBox="0 0 100 100" aria-hidden="true">
        <path
          d="M50 10 C65 18 78 18 88 22 V50 C88 70 74 84 50 92 C26 84 12 70 12 50 V22 C22 18 35 18 50 10 Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="6"
          strokeLinejoin="round"
        />
        <path d="M30 52 L46 68 L72 36" fill="none" stroke="currentColor" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  // charge
  return (
    <svg className={`fxSvg fx-${kind}`} viewBox="0 0 100 100" aria-hidden="true">
      <path
        d="M58 8 L42 44 H62 L38 92 L46 56 H30 Z"
        fill="currentColor"
        opacity="0.85"
      />
      <circle cx="50" cy="50" r="34" fill="none" stroke="currentColor" strokeWidth="6" opacity="0.35" />
    </svg>
  );
}
