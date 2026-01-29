import React from "react";
import type { BattleFormat } from "../../engine/types";

export default function ModeSelect(props: {
  onStory: () => void;
  onFreeBattle: (format: BattleFormat) => void;
  onBack: () => void;
}) {
  return (
    <div className="container">
      <div className="card">
        <div className="h1">モード選択</div>
        <div className="row">
          <div className="col card">
            <div className="h2">ストーリー（選択＋対戦）</div>
            <div className="muted">会話ノード→選択→バトル。移動なし。</div>
            <div className="hr" />
            <button className="btn primary" onClick={props.onStory}>
              ストーリー開始
            </button>
          </div>
          <div className="col card">
            <div className="h2">フリーバトル</div>
            <div className="muted">編成と技セットだけ試せます。</div>
            <div className="hr" />
            <div className="grid2">
              <button className="btn" onClick={() => props.onFreeBattle("1v1")}>
                1vs1
              </button>
              <button className="btn" onClick={() => props.onFreeBattle("3v3")}>
                3vs3（交代）
              </button>
            </div>
          </div>
        </div>

        <div className="hr" />
        <button className="btn" onClick={props.onBack}>
          戻る
        </button>
      </div>
    </div>
  );
}
