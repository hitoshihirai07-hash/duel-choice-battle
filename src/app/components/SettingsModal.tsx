import React, { useEffect } from "react";
import type { SoundSettings } from "../sound/sound";

export default function SettingsModal(props: {
  open: boolean;
  settings: SoundSettings;
  onChange: (patch: Partial<SoundSettings>) => void;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!props.open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") props.onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [props.open]);

  if (!props.open) return null;

  const sfxOn = (props.settings.sfx ?? 1) > 0.001;
  const bgmOn = (props.settings.bgm ?? 1) > 0.001;

  return (
    <div
      className="modalBackdrop"
      role="dialog"
      aria-modal="true"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) props.onClose();
      }}
    >
      <div className="modalCard card">
        <div className="h1" style={{ marginBottom: 6 }}>
          設定
        </div>
        <div className="muted small">音はON/OFFだけ（容量を増やさないため、音源は内蔵WebAudio）。</div>

        <div className="hr" />

        <div className="list">
          <div className="row" style={{ alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div style={{ fontWeight: 800 }}>BGM</div>
              <div className="small muted">背景音</div>
            </div>
            <button className={bgmOn ? "btn primary" : "btn"} onClick={() => props.onChange({ bgm: bgmOn ? 0 : 1 })}>
              {bgmOn ? "ON" : "OFF"}
            </button>
          </div>

          <div className="row" style={{ alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div style={{ fontWeight: 800 }}>効果音</div>
              <div className="small muted">クリック/技/ダメージ等</div>
            </div>
            <button className={sfxOn ? "btn primary" : "btn"} onClick={() => props.onChange({ sfx: sfxOn ? 0 : 1 })}>
              {sfxOn ? "ON" : "OFF"}
            </button>
          </div>
        </div>

        <div className="hr" />
        <div className="row" style={{ justifyContent: "flex-end" }}>
          <button className="btn" onClick={props.onClose}>
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
}
