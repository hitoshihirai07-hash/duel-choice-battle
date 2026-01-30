import React, { useMemo } from "react";
import type { GameData } from "../store/dataLoader";
import type { SaveDataV1 } from "../save/saveAdapter";
import type { BattleFormat } from "../../engine/types";
import { dailyBattleId, dailyRewardPoints, getJstDateKey } from "../daily/daily";

export default function Daily(props: {
  data: GameData;
  save: SaveDataV1;
  onStart: (format: BattleFormat, battleId: string) => void;
  onBack: () => void;
}) {
  const dateKey = useMemo(() => getJstDateKey(), []);
  const claimed = props.save.daily?.claimed ?? {};
  const today = claimed[dateKey] ?? {};
  const streak = props.save.daily?.streak ?? 0;

  const row = (format: BattleFormat) => {
    const key = format === "1v1" ? "v1" : "v3";
    const done = !!(today as any)[key];
    const reward = dailyRewardPoints(format);
    const title = format === "1v1" ? "デイリー（1vs1）" : "デイリー（3vs3）";
    const desc = format === "1v1" ? "サクッと1戦。" : "しっかり3体勝負。";
    return (
      <div className="card" key={format}>
        <div className="h2">{title}</div>
        <div className="muted small">{desc}</div>
        <div className="hr" />
        <div className="kv">
          <span className="pill">報酬 +{reward}pt</span>
          {done ? <span className="pill">受け取り済み</span> : <span className="pill">未クリア</span>}
        </div>
        <div style={{ height: 10 }} />
        <button
          className="btn primary"
          onClick={() => props.onStart(format, dailyBattleId(format))}
        >
          挑戦する
        </button>
      </div>
    );
  };

  return (
    <div className="container">
      <div className="card">
        <div className="h1">デイリーチャレンジ</div>
        <div className="muted">{dateKey}（JST）</div>
        <div className="small muted">連続クリア: {streak} 日</div>
        <div className="hr" />
        <div className="row">
          <div className="col">{row("1v1")}</div>
          <div className="col">{row("3v3")}</div>
        </div>
        <div className="hr" />
        <button className="btn" onClick={props.onBack}>
          戻る
        </button>
      </div>
    </div>
  );
}
