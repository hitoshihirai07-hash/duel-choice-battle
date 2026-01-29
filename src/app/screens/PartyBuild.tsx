import React, { useMemo, useState } from "react";
import type { BattleFormat, SkillDef, UnitDef } from "../../engine/types";
import UnitCard from "../components/UnitCard";
import SkillSlot from "../components/SkillSlot";
import type { GameData } from "../store/dataLoader";
import type { SaveDataV1 } from "../save/saveAdapter";
import { normalizeSkillSet } from "../save/saveUtils";

function pickN<T>(arr: T[], n: number): T[] {
  return arr.slice(0, n);
}

export default function PartyBuild(props: {
  data: GameData;
  save: SaveDataV1;
  onUpdateSave: (fn: (prev: SaveDataV1) => SaveDataV1) => void;
  format: BattleFormat;
  fromStory: boolean;
  battleId?: string;
  nextStoryNodeId?: string;
  onStartBattle: (battleId: string, nextStoryNodeId?: string) => void;
  onBack: () => void;
}) {
  const { units, skills, battles } = props.data;

  const [selectedUnitIds, setSelectedUnitIds] = useState<string[]>(() => {
    // default: first N units
    const n = props.format === "1v1" ? 1 : 3;
    return pickN(units.map((u) => u.id), n);
  });

  const unitById = useMemo(() => Object.fromEntries(units.map((u) => [u.id, u])), [units]);
  const skillById = useMemo(() => Object.fromEntries(skills.map((s) => [s.id, s])), [skills]);

  const selectedUnits = selectedUnitIds.map((id) => unitById[id]).filter(Boolean) as UnitDef[];

  const [skillSets, setSkillSets] = useState<Record<string, [string, string, string, string]>>(() => {
    const init: Record<string, [string, string, string, string]> = {};
    const rosterById = new Map(props.save.roster.map((r) => [r.unitId, r] as const));
    for (const u of units) {
      const r = rosterById.get(u.id);
      init[u.id] = r ? normalizeSkillSet(r.equippedSkillSet) : normalizeSkillSet(u.defaultSkillSet);
    }
    return init;
  });

  const battleId = useMemo(() => {
    if (props.battleId) return props.battleId;
    return props.format === "1v1" ? "b_demo_1v1" : "b_demo_3v3";
  }, [props.battleId, props.format]);

  const nextStoryNodeId = props.nextStoryNodeId;

  const battle = battles.find((b) => b.id === battleId);

  const teamSize = props.format === "1v1" ? 1 : 3;

  function toggleSelect(id: string) {
    setSelectedUnitIds((prev) => {
      const has = prev.includes(id);
      if (has) {
        // don't allow empty
        const next = prev.filter((x) => x !== id);
        return next.length === 0 ? prev : next;
      }
      if (prev.length >= teamSize) {
        // replace last
        return [...prev.slice(0, teamSize - 1), id];
      }
      return [...prev, id];
    });
  }

  const canStart = selectedUnitIds.length === teamSize && !!battle;

  return (
    <div className="container">
      <div className="card">
        <div className="h1">編成 & 技セット</div>
        <div className="muted">
          {props.format === "1v1" ? "1体" : "3体"}選択 / 技は4枠固定（入れ替えOK）
        </div>

        <div className="hr" />

        <div className="row">
          <div className="col">
            <div className="h2">ユニット選択</div>
            <div className="list">
              {units.map((u) => (
                <UnitCard
                  key={u.id}
                  unit={u}
                  selected={selectedUnitIds.includes(u.id)}
                  onClick={() => toggleSelect(u.id)}
                  footer={
                    selectedUnitIds.includes(u.id) ? (
                      <div className="small muted">このユニットはパーティに入っています</div>
                    ) : (
                      <div className="small muted">クリックで追加（上限超えると最後が入替）</div>
                    )
                  }
                />
              ))}
            </div>
          </div>

          <div className="col">
            <div className="h2">技セット（選択中ユニット）</div>
            {selectedUnits.length === 0 ? (
              <div className="muted">ユニットを選んでください</div>
            ) : (
              selectedUnits.map((u) => {
                const rosterEntry = props.save.roster.find((r) => r.unitId === u.id);
                const unlocked = new Set(rosterEntry?.unlockedSkillIds ?? u.learnableSkillIds);
                const learnables = u.learnableSkillIds
                  .filter((id) => unlocked.has(id))
                  .map((id) => skillById[id])
                  .filter(Boolean) as SkillDef[];
                const set = skillSets[u.id];

                return (
                  <div key={u.id} className="card" style={{ marginBottom: 12 }}>
                    <div className="kv">
                      <div className="h2" style={{ margin: 0 }}>
                        {u.name}
                      </div>
                      <span className="pill">learn {learnables.length}</span>
                    </div>
                    <div className="hr" />
                    <div className="grid2">
                      {[0, 1, 2, 3].map((i) => (
                        <SkillSlot
                          key={i}
                          slotIndex={i}
                          skill={skillById[set[i]] ?? null}
                          options={learnables}
                          onChange={(skillId) => {
                            setSkillSets((prev) => {
                              const nextSet = prev[u.id].map((x, idx) => (idx === i ? skillId : x)) as [string, string, string, string];
                              // セーブにも反映
                              props.onUpdateSave((s) => ({
                                ...s,
                                roster: s.roster.map((r) => (r.unitId === u.id ? { ...r, equippedSkillSet: nextSet } : r)),
                              }));
                              return { ...prev, [u.id]: nextSet };
                            });
                          }}
                        />
                      ))}
                    </div>
                    <div className="hr" />
                    <div className="small muted">
                      ※この画面のセット内容がバトルで反映されます（敵もデータで指定可能）
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="hr" />

        <div className="kv">
          <button className="btn" onClick={props.onBack}>
            戻る
          </button>
          <button
            className="btn primary"
            disabled={!canStart}
            onClick={() => props.onStartBattle(battle!.id, nextStoryNodeId)}
          >
            バトル開始
          </button>
          <span className="pill">battle: {battle?.id ?? "なし"}</span>
        </div>
      </div>

      {/* pass selections through global? for MVP, we stash to window for Battle screen */}
      <SelectionBridge selectedUnitIds={selectedUnitIds} skillSets={skillSets} />
    </div>
  );
}

function SelectionBridge(props: { selectedUnitIds: string[]; skillSets: Record<string, [string, string, string, string]> }) {
  // hacky but simple for MVP. Replace with proper store later.
  (window as any).__DCB_SELECTION__ = props;
  return null;
}
