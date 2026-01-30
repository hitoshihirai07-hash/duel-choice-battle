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

  const bg = node?.bg || "/assets/bg/forest.svg";
  const speakerName = node?.speaker?.name || "ナレーション";
  const speakerPortrait = node?.speaker?.portrait || "/assets/portraits/narrator.svg";

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

        <div className="scene" style={{ backgroundImage: `url(${bg})` }}>
          <div className="sceneOverlay fadeIn" key={node.id}>
            <div className="sceneHeader">
              <img className="portrait" src={speakerPortrait} alt={speakerName} />
              <div>
                <div className="h2" style={{ margin: 0 }}>
                  {speakerName}
                </div>
                <div className="small muted">育成ポイント: {props.save.resources.trainingPoints ?? 0}</div>
              </div>
            </div>

            <div className="hr" />

            <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.7 }}>{node.text}</div>

            <div className="hr" />

            <div className="list">
              {node.choices.map((c, idx) => {
                const b = c.battleId ? battlesById[c.battleId] : null;
                return (
                  <button
                    key={idx}
                    className="btn"
                    onClick={() => {
                      // バトル
                      if (c.battleId && b) {
                        props.onBattle(c.battleId, b.format, c.nextNodeId);
                        return;
                      }
                      // イベント報酬（今の実装だと、戦闘外の選択は“移動だけ”になりがちなので、
                      // ここで trainingPoints を少し付与できるようにしておく）
                      const tp = c.reward?.trainingPoints ?? 0;
                      const unlock = (c.reward?.unlockSkillIds ?? []).filter((x) => typeof x === "string");
                      props.onUpdateSave((prev) => ({
                        ...prev,
                        resources: { ...prev.resources, trainingPoints: (prev.resources.trainingPoints ?? 0) + tp },
                        roster:
                          unlock.length === 0
                            ? prev.roster
                            : prev.roster.map((r) => {
                                const u = props.data.units.find((x) => x.id === r.unitId);
                                if (!u) return r;
                                const learnable = new Set(u.learnableSkillIds);
                                const current = new Set(r.unlockedSkillIds ?? []);
                                for (const sid of unlock) {
                                  if (learnable.has(sid)) current.add(sid);
                                }
                                return { ...r, unlockedSkillIds: Array.from(current) };
                              }),
                        story: { ...prev.story, currentNodeId: c.nextNodeId },
                      }));
                    }}
                  >
                    {c.label}
                    {c.reward?.trainingPoints ? (
                      <span className="pill" style={{ marginLeft: 8 }}>
                        +{c.reward.trainingPoints}pt
                      </span>
                    ) : null}
                    {c.reward?.unlockSkillIds?.length ? (
                      <span className="pill" style={{ marginLeft: 8 }}>
                        +技 {c.reward.unlockSkillIds.length}
                      </span>
                    ) : null}
                    {c.battleId && b ? (
                      <span className="pill" style={{ marginLeft: 8 }}>
                        battle: {b.format}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>

            {node.choices.some((c) => c.reward?.unlockSkillIds?.length) ? (
              <div className="small muted" style={{ marginTop: 10 }}>
                ※「+技」は、その選択で習得できる技が増えることを意味します（習得済みは重複しません）
              </div>
            ) : null}
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
