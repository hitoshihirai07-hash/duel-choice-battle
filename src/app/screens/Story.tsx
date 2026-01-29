import React, { useMemo } from "react";
import type { GameData } from "../store/dataLoader";
import type { SaveDataV1 } from "../save/saveAdapter";

export default function Story(props: {
  data: GameData;
  save: SaveDataV1;
  onUpdateSave: (fn: (prev: SaveDataV1) => SaveDataV1) => void;
  onBattle: (battleId: string, format: "1v1" | "3v3", nextStoryNodeId: string) => void;
  onBack: () => void;
}) {
  const story = props.data.story;
  const nodesById = useMemo(() => Object.fromEntries(story.nodes.map((n) => [n.id, n])), [story.nodes]);
  const battlesById = useMemo(() => Object.fromEntries(props.data.battles.map((b) => [b.id, b])), [props.data.battles]);

  const nodeId = props.save.story.currentNodeId || story.startNodeId;
  const node = nodesById[nodeId];

  if (!node) {
    return (
      <div className="container">
        <div className="card">
          <div className="h1">ストーリーエラー</div>
          <div className="muted">nodeIdが見つかりません: {nodeId}</div>
          <div className="hr" />
          <button className="btn" onClick={props.onBack}>
            戻る
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="card">
        <div className="h1">ストーリー</div>
        <div className="card">
          <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.7 }}>{node.text}</div>
          <div className="hr" />
          <div className="small muted">育成ポイント: {props.save.resources.trainingPoints ?? 0}</div>
          <div className="hr" />
          <div className="list">
            {node.choices.map((c, idx) => {
              const b = c.battleId ? battlesById[c.battleId] : null;
              return (
                <button
                  key={idx}
                  className="btn"
                  onClick={() => {
                    if (c.battleId && b) {
                      props.onBattle(c.battleId, b.format, c.nextNodeId);
                      return;
                    }
                    props.onUpdateSave((prev) => ({ ...prev, story: { ...prev.story, currentNodeId: c.nextNodeId } }));
                  }}
                >
                  {c.label}
                  {c.battleId && b ? (
                    <span className="pill" style={{ marginLeft: 8 }}>
                      battle: {b.format}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>

        <div className="hr" />
        <button className="btn" onClick={props.onBack}>
          モードへ戻る
        </button>
      </div>
    </div>
  );
}
