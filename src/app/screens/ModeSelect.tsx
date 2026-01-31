import React, { useState } from "react";
import type { BattleFormat } from "../../engine/types";
import SettingsModal from "../components/SettingsModal";
import type { SoundSettings } from "../sound/sound";
import { ensureAudio, playSfx, startBgm } from "../sound/sound";

export default function ModeSelect(props: {
  settings: SoundSettings;
  onUpdateSettings: (patch: Partial<SoundSettings>) => void;
  onStory: () => void;
  onFreeBattle: (format: BattleFormat) => void;
  onDaily: () => void;
  onTraining: () => void;
  onBack: () => void;
}) {
  const [openSettings, setOpenSettings] = useState(false);

  const act = async (kind: "click" | "select" | "confirm", fn: () => void) => {
    await ensureAudio();
    if ((props.settings.bgm ?? 1) > 0.001) startBgm();
    playSfx(kind);
    fn();
  };

  return (
    <div className="container">
      <div className="card">
        <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
          <div className="h1" style={{ margin: 0 }}>
            モード選択
          </div>
          <button className="btn" onClick={() => setOpenSettings(true)}>
            設定
          </button>
        </div>

        <div className="hr" />

        <div className="row">
          <div className="col card">
            <div className="h2">ストーリー（選択＋対戦）</div>
            <div className="muted">会話ノード→選択→バトル。移動なし。</div>
            <div className="hr" />
            <button className="btn primary" onClick={() => void act("confirm", props.onStory)}>
              ストーリー開始
            </button>
          </div>
          <div className="col card">
            <div className="h2">フリーバトル</div>
            <div className="muted">編成と技セットだけ試せます。</div>
            <div className="hr" />
            <div className="grid2">
              <button className="btn" onClick={() => void act("select", () => props.onFreeBattle("1v1"))}>
                1vs1
              </button>
              <button className="btn" onClick={() => void act("select", () => props.onFreeBattle("3v3"))}>
                3vs3（交代）
              </button>
              <button className="btn" onClick={() => void act("click", props.onTraining)}>
                育成（ポイント振り）
              </button>
            </div>
          </div>

          <div className="col card">
            <div className="h2">デイリーチャレンジ</div>
            <div className="muted">1日1回の報酬つきバトル（1vs1 / 3vs3）。</div>
            <div className="hr" />
            <button className="btn primary" onClick={() => void act("confirm", props.onDaily)}>
              デイリーへ
            </button>
          </div>
        </div>

        <div className="hr" />
        <button className="btn" onClick={() => void act("click", props.onBack)}>
          戻る
        </button>
      </div>

      <SettingsModal
        open={openSettings}
        settings={props.settings}
        onClose={() => setOpenSettings(false)}
        onChange={(patch) => {
          // 設定を変えた時も音を出せるように（OFFの場合は鳴らない）
          void ensureAudio().then(() => {
            if ((patch.bgm ?? props.settings.bgm) > 0.001) startBgm();
            playSfx("click");
          });
          props.onUpdateSettings(patch);
        }}
      />
    </div>
  );
}
