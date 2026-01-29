import React, { useEffect, useMemo, useState } from "react";
import type { GameData } from "../store/dataLoader";
import type { Action, BattleFormat, BattleState, Side, UnitRef } from "../../engine/types";
import { ENGINE_VERSION } from "../../engine/constants";
import { initBattle, listLegalActions, makeUnitInstance, resolveTurn } from "../../engine/battle";
import { battleLogToText } from "../../engine/serialize";
import { chooseAiAction, type AiProfile } from "../../engine/ai";

function other(side: Side): Side {
  return side === "A" ? "B" : "A";
}

export default function Battle(props: {
  data: GameData;
  format: BattleFormat;
  battleId: string;
  fromStory: boolean;
  onFinish: (result: { winner: Side }) => void;
  onExit: () => void;
}) {
  const defs = useMemo(() => ({ balance: props.data.balance, units: props.data.units, skills: props.data.skills }), [props.data]);

  const battleDef = props.data.battles.find((b) => b.id === props.battleId);
  const aiProfile = props.data.ai.find((x) => x.id === (battleDef?.aiProfileId ?? "ai_normal")) as AiProfile | undefined;

  const [state, setState] = useState<BattleState | null>(null);
  const [selectedAction, setSelectedAction] = useState<Action | null>(null);

  useEffect(() => {
    if (!battleDef) return;

    // read selections from PartyBuild (MVP bridge)
    const sel = (window as any).__DCB_SELECTION__ as { selectedUnitIds: string[]; skillSets: Record<string, [string, string, string, string]> } | undefined;

    const teamSize = props.format === "1v1" ? 1 : 3;
    const myIds = sel?.selectedUnitIds?.slice(0, teamSize) ?? props.data.units.slice(0, teamSize).map((u) => u.id);

    const unitMap = Object.fromEntries(props.data.units.map((u) => [u.id, u]));
    const myMembers = myIds.map((id) => {
      const u = unitMap[id];
      const inst = makeUnitInstance(u, 1);
      const ss = sel?.skillSets?.[id];
      if (ss) inst.skillSet = ss;
      return inst;
    });

    const enemyIds = battleDef.enemyTeam.slice(0, teamSize);
    const enemyMembers = enemyIds.map((e) => {
      const u = unitMap[e.unitId];
      const inst = makeUnitInstance(u, e.level);
      if (e.skillSet && e.skillSet.length === 4) inst.skillSet = e.skillSet as any;
      return inst;
    });

    const seed = Math.floor(Math.random() * 1e9);

    const s = initBattle({
      engineVersion: ENGINE_VERSION,
      format: props.format,
      seed,
      teamA: { members: myMembers, activeSlot: 0 },
      teamB: { members: enemyMembers, activeSlot: 0 },
    });
    setState(s);
    setSelectedAction(null);
  }, [props.battleId, props.format]);

  if (!battleDef || !aiProfile) {
    return (
      <div className="container">
        <div className="card">
          <div className="h1">バトル定義が見つかりません</div>
          <div className="muted">battleId: {props.battleId}</div>
          <div className="hr" />
          <button className="btn" onClick={props.onExit}>
            戻る
          </button>
        </div>
      </div>
    );
  }

  if (!state) {
    return (
      <div className="container">
        <div className="card">
          <div className="h1">バトル準備中…</div>
        </div>
      </div>
    );
  }

  const mySide: Side = "A";
  const enemySide: Side = "B";

  const myTeam = state.teams[mySide];
  const enTeam = state.teams[enemySide];

  const myActive = myTeam.members[myTeam.activeSlot];
  const enActive = enTeam.members[enTeam.activeSlot];

  const skillMap = useMemo(() => Object.fromEntries(props.data.skills.map((s) => [s.id, s])), [props.data.skills]);

  const legal = listLegalActions(state, defs, mySide);

  const canSubmit = !!selectedAction && !state.winner;

  function submitTurn() {
    if (!selectedAction) return;

    // Reactのstate/propsはクロージャ内で型の絞り込みが維持されないため、ここで安全にガードする
    const current = state;
    const profile = aiProfile;
    if (!current || !profile) return;

    const aiAction = chooseAiAction({ state: current, defs, side: enemySide, profile });

    const next = resolveTurn(current, defs, selectedAction, aiAction);
    setState(next);
    setSelectedAction(null);

    if (next.winner) {
      props.onFinish({ winner: next.winner });
    }
  }

  const logLines = battleLogToText(state);

  return (
    <div className="container">
      <div className="card">
        <div className="h1">バトル：{props.format}</div>
        <div className="muted">敵AI: {aiProfile.id} / 状態異常なし</div>

        <div className="hr" />

        <div className="row">
          <div className="col card">
            <div className="h2">あなた（A）</div>
            <UnitPanel unit={myActive} />
            {props.format === "3v3" ? (
              <>
                <div className="hr" />
                <BenchPanel team={myTeam} side={mySide} selectedAction={selectedAction} onPickSwap={(toSlot) => setSelectedAction({ kind: "swap", user: { side: mySide, slot: myTeam.activeSlot }, toSlot })} />
              </>
            ) : null}
          </div>

          <div className="col card">
            <div className="h2">敵（B）</div>
            <UnitPanel unit={enActive} />
            {props.format === "3v3" ? (
              <>
                <div className="hr" />
                <BenchPanel team={enTeam} side={enemySide} selectedAction={null} onPickSwap={() => {}} />
              </>
            ) : null}
          </div>
        </div>

        <div className="hr" />

        <div className="card">
          <div className="h2">行動</div>
          {state.winner ? (
            <div className="kv">
              <span className="pill">勝者: {state.winner}</span>
              <button className="btn" onClick={props.onExit}>
                終了
              </button>
            </div>
          ) : (
            <>
              <div className="grid2">
                {myActive.skillSet.map((id) => {
                  const sk = skillMap[id];
                  const cd = myActive.cooldowns[id] ?? 0;
                  const disabled = cd > 0 || myActive.sp < (sk?.spCost ?? 0);
                  const isSelected = selectedAction?.kind === "useSkill" && selectedAction.skillId === id;
                  return (
                    <button
                      key={id}
                      className={"btn" + (isSelected ? " primary" : "")}
                      disabled={disabled}
                      onClick={() => setSelectedAction({ kind: "useSkill", user: { side: mySide, slot: myTeam.activeSlot }, skillId: id })}
                    >
                      {sk?.name ?? id}
                      <span className="pill" style={{ marginLeft: 8 }}>
                        SP {sk?.spCost ?? 0}
                      </span>
                      <span className="pill" style={{ marginLeft: 6 }}>
                        CD {cd}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="hr" />

              <div className="kv">
                <button className="btn" onClick={props.onExit}>
                  退出
                </button>
                <button className="btn primary" disabled={!canSubmit} onClick={submitTurn}>
                  決定 → ターン進行
                </button>
                <span className="pill">選択: {selectedAction ? actionToLabel(selectedAction, skillMap) : "なし"}</span>
              </div>
            </>
          )}
        </div>

        <div className="hr" />
        <div className="h2">ログ</div>
        <div className="log">
          {logLines.slice(-80).map((l, i) => (
            <div key={i}>{l}</div>
          ))}
        </div>
      </div>
    </div>
  );
}

function actionToLabel(a: Action, skillMap: Record<string, any>): string {
  if (a.kind === "useSkill") return `技: ${skillMap[a.skillId]?.name ?? a.skillId}`;
  if (a.kind === "swap") return `交代: → ${a.toSlot + 1}番`;
  return "なし";
}

function UnitPanel(props: { unit: any }) {
  const u = props.unit;
  return (
    <div>
      <div className="kv">
        <span className="pill">HP {u.hp}/{u.maxHp}</span>
        <span className="pill">SP {u.sp}</span>
      </div>
      <div className="kv" style={{ marginTop: 6 }}>
        <span className="pill">攻 {u.stages.atk}</span>
        <span className="pill">防 {u.stages.def}</span>
        <span className="pill">早 {u.stages.spd}</span>
        {u.guard ? <span className="pill">ガード</span> : null}
        {u.charge ? <span className="pill">チャージ</span> : null}
      </div>
    </div>
  );
}

function BenchPanel(props: {
  team: any;
  side: Side;
  selectedAction: Action | null;
  onPickSwap: (toSlot: number) => void;
}) {
  const { team } = props;
  return (
    <div>
      <div className="h2">控え</div>
      <div className="grid2">
        {team.members.map((m: any, idx: number) => {
          const isActive = idx === team.activeSlot;
          return (
            <button
              key={idx}
              className={"btn" + (isActive ? " primary" : "")}
              disabled={isActive || !m.alive}
              onClick={() => props.onPickSwap(idx)}
            >
              {isActive ? "場" : "控え"} {idx + 1} / HP {m.hp}
              {!m.alive ? <span className="pill" style={{ marginLeft: 6 }}>KO</span> : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
