import React, { useMemo } from "react";
import type { GameData } from "../store/dataLoader";
import type { SaveDataV1 } from "../save/saveAdapter";
import { TRAINING_STEP, trainingSpentToBonus } from "../save/saveUtils";

type StatKey = "hp" | "atk" | "def" | "spd";

export default function Training(props: {
  data: GameData;
  save: SaveDataV1;
  onUpdateSave: (fn: (prev: SaveDataV1) => SaveDataV1) => void;
  onDone: () => void;
}) {
  const unitById = useMemo(() => new Map(props.data.units.map((u) => [u.id, u] as const)), [props.data.units]);
  const points = props.save.resources.trainingPoints ?? 0;

  function adjust(unitId: string, stat: StatKey, delta: 1 | -1) {
    props.onUpdateSave((prev) => {
      const cur = prev.resources.trainingPoints ?? 0;
      const roster = prev.roster.map((r) => {
        if (r.unitId !== unitId) return r;
        const spent = {
          hp: r.trainingPointsSpent?.hp ?? 0,
          atk: r.trainingPointsSpent?.atk ?? 0,
          def: r.trainingPointsSpent?.def ?? 0,
          spd: r.trainingPointsSpent?.spd ?? 0,
        };

        if (delta === 1) {
          if (cur <= 0) return r;
          spent[stat] += 1;
          return { ...r, trainingPointsSpent: spent };
        }

        // refund
        if (spent[stat] <= 0) return r;
        spent[stat] -= 1;
        return { ...r, trainingPointsSpent: spent };
      });

      // delta on resources
      let nextPoints = cur;
      if (delta === 1) {
        if (cur <= 0) return prev;
        nextPoints = cur - 1;
      } else {
        // refund only if we actually reduced something
        // We detect it by comparing spent sum before/after for the unit.
        const before = prev.roster.find((r) => r.unitId === unitId)?.trainingPointsSpent?.[stat] ?? 0;
        const after = roster.find((r) => r.unitId === unitId)?.trainingPointsSpent?.[stat] ?? 0;
        if (after < before) nextPoints = cur + 1;
      }

      return { ...prev, roster, resources: { trainingPoints: nextPoints } };
    });
  }

  return (
    <div className="container">
      <div className="card">
        <div className="h1">育成（ポイント振り）</div>
        <div className="muted">余りポイント: {points}</div>
        <div className="small muted">
          増加量: HP +{TRAINING_STEP.hp} / 攻撃+{TRAINING_STEP.atk} / 防御+{TRAINING_STEP.def} / 素早さ+{TRAINING_STEP.spd}
        </div>

        <div className="hr" />

        <div className="list">
          {props.save.roster.map((r) => {
            const u = unitById.get(r.unitId);
            if (!u) return null;
            const spent = {
              hp: r.trainingPointsSpent?.hp ?? 0,
              atk: r.trainingPointsSpent?.atk ?? 0,
              def: r.trainingPointsSpent?.def ?? 0,
              spd: r.trainingPointsSpent?.spd ?? 0,
            };
            const bonus = trainingSpentToBonus(spent);

            const base = u.baseStats;
            const lvl = r.level ?? 1;
            const growth = u.growth;
            const baseAt = {
              hp: base.hp + growth.hp * (lvl - 1),
              atk: base.atk + growth.atk * (lvl - 1),
              def: base.def + growth.def * (lvl - 1),
              spd: base.spd + growth.spd * (lvl - 1),
            };
            const after = {
              hp: baseAt.hp + bonus.hp,
              atk: baseAt.atk + bonus.atk,
              def: baseAt.def + bonus.def,
              spd: baseAt.spd + bonus.spd,
            };

            return (
              <div key={r.unitId} className="card">
                <div className="kv">
                  <div>
                    <div className="h2" style={{ margin: 0 }}>
                      {u.name}
                    </div>
                    <div className="small muted">Lv {lvl}</div>
                  </div>
                  <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                    <span className="pill">HP {after.hp}</span>
                    <span className="pill">攻 {after.atk}</span>
                    <span className="pill">防 {after.def}</span>
                    <span className="pill">素 {after.spd}</span>
                  </div>
                </div>

                <div className="hr" />

                <StatRow
                  label="HP"
                  value={spent.hp}
                  onPlus={() => adjust(r.unitId, "hp", 1)}
                  onMinus={() => adjust(r.unitId, "hp", -1)}
                />
                <StatRow
                  label="攻撃"
                  value={spent.atk}
                  onPlus={() => adjust(r.unitId, "atk", 1)}
                  onMinus={() => adjust(r.unitId, "atk", -1)}
                />
                <StatRow
                  label="防御"
                  value={spent.def}
                  onPlus={() => adjust(r.unitId, "def", 1)}
                  onMinus={() => adjust(r.unitId, "def", -1)}
                />
                <StatRow
                  label="素早さ"
                  value={spent.spd}
                  onPlus={() => adjust(r.unitId, "spd", 1)}
                  onMinus={() => adjust(r.unitId, "spd", -1)}
                />

                <div className="hr" />
                <div className="small muted">
                  現在: {baseAt.hp}→{after.hp} / {baseAt.atk}→{after.atk} / {baseAt.def}→{after.def} / {baseAt.spd}→{after.spd}
                </div>
              </div>
            );
          })}
        </div>

        <div className="hr" />
        <button className="btn primary" onClick={props.onDone}>
          戻る
        </button>
        <div className="small muted" style={{ marginTop: 8 }}>
          ※自動でlocalStorageに保存されます
        </div>
      </div>
    </div>
  );
}

function StatRow(props: {
  label: string;
  value: number;
  onPlus: () => void;
  onMinus: () => void;
}) {
  return (
    <div className="kv" style={{ gap: 12 }}>
      <div className="row" style={{ gap: 10, alignItems: "center" }}>
        <span className="badge">{props.label}</span>
        <span className="pill">{props.value}</span>
      </div>
      <div className="row" style={{ gap: 8 }}>
        <button className="btn" onClick={props.onMinus}>
          -
        </button>
        <button className="btn" onClick={props.onPlus}>
          +
        </button>
      </div>
    </div>
  );
}
