import React, { useEffect, useMemo, useRef, useState } from "react";
import type { GameData } from "../store/dataLoader";
import type { Action, BattleFormat, BattleState, Side, UnitRef } from "../../engine/types";
import { ENGINE_VERSION } from "../../engine/constants";
import { initBattle, listLegalActions, makeUnitInstance, resolveTurn } from "../../engine/battle";
import { battleLogToText } from "../../engine/serialize";
import { chooseAiAction, type AiProfile } from "../../engine/ai";
import type { SaveDataV1 } from "../save/saveAdapter";
import { trainingSpentToBonus } from "../save/saveUtils";
import FxOverlay, { type FxKind } from "../components/FxOverlay";
import { getDailyEnemyTeam, getJstDateKey, isDailyBattleId } from "../daily/daily";

function other(side: Side): Side {
  return side === "A" ? "B" : "A";
}

export default function Battle(props: {
  data: GameData;
  save: SaveDataV1;
  format: BattleFormat;
  battleId: string;
  fromStory: boolean;
  onFinish: (result: { winner: Side; state: BattleState }) => void;
  onExit: () => void;
}) {
  const defs = useMemo(() => ({ balance: props.data.balance, units: props.data.units, skills: props.data.skills }), [props.data]);
  // Hooks must be called unconditionally in the same order on every render.
  // Keep memoized maps above any early returns.
  const skillMap = useMemo(() => Object.fromEntries(props.data.skills.map((s) => [s.id, s])), [props.data.skills]);

  const battleDef = props.data.battles.find((b) => b.id === props.battleId);
  const aiProfile = props.data.ai.find((x) => x.id === (battleDef?.aiProfileId ?? "ai_normal")) as AiProfile | undefined;

  const unitDefMap = useMemo(() => Object.fromEntries(props.data.units.map((u) => [u.id, u])), [props.data.units]);

  const isDaily = isDailyBattleId(props.battleId) || !!battleDef?.daily;
  const todayKey = useMemo(() => (isDaily ? getJstDateKey() : ""), [isDaily]);
  const dailyEnemy = useMemo(() => (isDaily ? getDailyEnemyTeam(props.data, props.format, todayKey) : null), [isDaily, props.data, props.format, todayKey]);
  const battleBg = (isDaily ? dailyEnemy?.bg : battleDef?.bg) || "/assets/bg/arena.svg";

  const [state, setState] = useState<BattleState | null>(null);
  const [selectedAction, setSelectedAction] = useState<Action | null>(null);

  type Floater = { id: string; side: Side; slot: number; amount: number; kind: "dmg" | "heal" };
  type Burst = { id: string; side: Side; slot: number; kind: FxKind };
  const [fx, setFx] = useState<{ floaters: Floater[]; bursts: Burst[]; flashKey: number; flashTarget: UnitRef | null }>({
    floaters: [],
    bursts: [],
    flashKey: 0,
    flashTarget: null,
  });
  const prevEventsRef = useRef(0);
  const floaterSeqRef = useRef(0);
  const burstSeqRef = useRef(0);

  function normalizeFxKind(x: string | undefined): FxKind | null {
    switch (x) {
      case "slash":
      case "impact":
      case "glow":
      case "buff":
      case "debuff":
      case "shield":
      case "charge":
        return x;
      default:
        return null;
    }
  }

  function inferFxForSkillId(skillId: string | undefined, fallback: FxKind): FxKind {
    if (!skillId) return fallback;
    const sk: any = (skillMap as any)[skillId];
    const explicit = normalizeFxKind(sk?.fx);
    if (explicit) return explicit;
    const t = sk?.type as string | undefined;
    switch (t) {
      case "attack":
        return "slash";
      case "heal":
        return "glow";
      case "buff":
        return "buff";
      case "debuff":
        return "debuff";
      case "guard":
        return "shield";
      case "charge":
        return "charge";
      default:
        return fallback;
    }
  }

  useEffect(() => {
    if (!battleDef) return;

    // read selections from PartyBuild (MVP bridge)
    const sel = (window as any).__DCB_SELECTION__ as { selectedUnitIds: string[]; skillSets: Record<string, [string, string, string, string]> } | undefined;

    const teamSize = props.format === "1v1" ? 1 : 3;
    const myIds = sel?.selectedUnitIds?.slice(0, teamSize) ?? props.data.units.slice(0, teamSize).map((u) => u.id);

    const unitMap = Object.fromEntries(props.data.units.map((u) => [u.id, u]));
    const rosterById = new Map(props.save.roster.map((r) => [r.unitId, r] as const));
    const myMembers = myIds.map((id) => {
      const u = unitMap[id];
      const r = rosterById.get(id);
      const level = r?.level ?? 1;
      const bonus = trainingSpentToBonus(r?.trainingPointsSpent);
      const inst = makeUnitInstance(u, level, bonus);
      const ss = sel?.skillSets?.[id] ?? (r?.equippedSkillSet && r.equippedSkillSet.length === 4 ? (r.equippedSkillSet as any) : undefined);
      if (ss) inst.skillSet = ss;
      return inst;
    });

    const enemyTeam = (isDaily ? dailyEnemy?.enemyTeam : battleDef.enemyTeam) ?? battleDef.enemyTeam;
    const enemyIds = enemyTeam.slice(0, teamSize);
    const enemyMembers = enemyIds.map((e: { unitId: string; level: number; skillSet?: string[] }) => {
      const u = unitMap[e.unitId];
      const inst = makeUnitInstance(u, e.level);
      if (e.skillSet && e.skillSet.length === 4) inst.skillSet = e.skillSet as any;
      return inst;
    });

    const seed = isDaily ? Number(todayKey.replace(/-/g, "")) + (props.format === "3v3" ? 3 : 1) : Math.floor(Math.random() * 1e9);

    const s = initBattle({
      engineVersion: ENGINE_VERSION,
      format: props.format,
      seed,
      teamA: { members: myMembers, activeSlot: 0 },
      teamB: { members: enemyMembers, activeSlot: 0 },
    });
    setState(s);
    prevEventsRef.current = s.events.length;
    setFx({ floaters: [], bursts: [], flashKey: 0, flashTarget: null });
    setSelectedAction(null);
  }, [props.battleId, props.format, props.save.roster, isDaily, todayKey, dailyEnemy]);

  useEffect(() => {
    if (!state) return;
    const prev = prevEventsRef.current;
    const newEvents = state.events.slice(prev);
    if (newEvents.length === 0) return;
    prevEventsRef.current = state.events.length;

    const added: Floater[] = [];
    const addedBursts: Burst[] = [];
    let flashTarget: UnitRef | null = null;
    const lastSkillBySide: Partial<Record<Side, string>> = {};

    for (const e of newEvents) {
      if (e.kind === "ACTION" && e.action.kind === "useSkill") {
        lastSkillBySide[e.actor.side] = e.action.skillId;
      }

      if (e.kind === "DAMAGE") {
        flashTarget = e.target;
        // ダメージ発生時に技エフェクト（攻撃系）
        addedBursts.push({
          id: `b${Date.now()}_${++burstSeqRef.current}`,
          side: e.target.side,
          slot: e.target.slot,
          kind: inferFxForSkillId(lastSkillBySide[e.actor.side], "slash"),
        });
        added.push({
          id: `f${Date.now()}_${++floaterSeqRef.current}`,
          side: e.target.side,
          slot: e.target.slot,
          amount: e.amount,
          kind: "dmg",
        });
      } else if (e.kind === "HEAL") {
        flashTarget = e.target;
        addedBursts.push({
          id: `b${Date.now()}_${++burstSeqRef.current}`,
          side: e.target.side,
          slot: e.target.slot,
          kind: inferFxForSkillId(lastSkillBySide[e.actor.side], "glow"),
        });
        added.push({
          id: `f${Date.now()}_${++floaterSeqRef.current}`,
          side: e.target.side,
          slot: e.target.slot,
          amount: e.amount,
          kind: "heal",
        });
      } else if (e.kind === "STAGE") {
        // バフ/デバフは STAGE で確定した時だけ演出
        addedBursts.push({
          id: `b${Date.now()}_${++burstSeqRef.current}`,
          side: e.target.side,
          slot: e.target.slot,
          kind: e.delta > 0 ? "buff" : "debuff",
        });
      } else if (e.kind === "GUARD_SET") {
        addedBursts.push({
          id: `b${Date.now()}_${++burstSeqRef.current}`,
          side: e.target.side,
          slot: e.target.slot,
          kind: "shield",
        });
      } else if (e.kind === "CHARGE_SET") {
        addedBursts.push({
          id: `b${Date.now()}_${++burstSeqRef.current}`,
          side: e.target.side,
          slot: e.target.slot,
          kind: "charge",
        });
      }
    }

    if (added.length || addedBursts.length || flashTarget) {
      setFx((prevFx) => ({
        floaters: [...prevFx.floaters, ...added],
        bursts: [...prevFx.bursts, ...addedBursts],
        flashKey: prevFx.flashKey + (flashTarget ? 1 : 0),
        flashTarget: flashTarget ?? prevFx.flashTarget,
      }));
    }

    for (const f of added) {
      window.setTimeout(() => {
        setFx((prevFx) => ({
          ...prevFx,
          floaters: prevFx.floaters.filter((x) => x.id !== f.id),
        }));
      }, 850);
    }

    for (const b of addedBursts) {
      window.setTimeout(() => {
        setFx((prevFx) => ({
          ...prevFx,
          bursts: prevFx.bursts.filter((x) => x.id !== b.id),
        }));
      }, 680);
    }
  }, [state]);


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
      props.onFinish({ winner: next.winner, state: next });
    }
  }

  const logLines = battleLogToText(state);

  return (
    <div className="container">
      <div className="card">
        <div className="h1">バトル：{props.format}</div>
        <div className="muted">敵AI: {aiProfile.id} / 状態異常なし</div>

        <div className="hr" />

        <div className="stage" style={{ backgroundImage: `url(${battleBg})` }}>
          <div className="stageOverlay">
            <div className="stageTitle">{isDaily ? `デイリーチャレンジ（${todayKey}）` : battleDef.id}</div>
            <div className="stageSub">{props.format === "1v1" ? "1 vs 1" : "3 vs 3"}</div>
          </div>
        </div>

        <div className="row">
          <div className="col card">
            <div className="h2">あなた（A）</div>
            <UnitPanel
              unit={myActive}
              unitDef={unitDefMap[myActive.unitId]}
              side={mySide}
              slot={myTeam.activeSlot}
              floaters={fx.floaters.filter((f) => f.side === mySide && f.slot === myTeam.activeSlot)}
              bursts={fx.bursts.filter((b) => b.side === mySide && b.slot === myTeam.activeSlot)}
              flashKey={fx.flashKey}
              flashTarget={fx.flashTarget}
            />
            {props.format === "3v3" ? (
              <>
                <div className="hr" />
                <BenchPanel team={myTeam} side={mySide} selectedAction={selectedAction} onPickSwap={(toSlot) => setSelectedAction({ kind: "swap", user: { side: mySide, slot: myTeam.activeSlot }, toSlot })} />
              </>
            ) : null}
          </div>

          <div className="col card">
            <div className="h2">敵（B）</div>
            <UnitPanel
              unit={enActive}
              unitDef={unitDefMap[enActive.unitId]}
              side={enemySide}
              slot={enTeam.activeSlot}
              floaters={fx.floaters.filter((f) => f.side === enemySide && f.slot === enTeam.activeSlot)}
              bursts={fx.bursts.filter((b) => b.side === enemySide && b.slot === enTeam.activeSlot)}
              flashKey={fx.flashKey}
              flashTarget={fx.flashTarget}
            />
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

function UnitPanel(props: {
  unit: any;
  unitDef?: any;
  side: Side;
  slot: number;
  floaters: { id: string; amount: number; kind: "dmg" | "heal" }[];
  bursts: { id: string; kind: FxKind }[];
  flashKey: number;
  flashTarget: UnitRef | null;
}) {
  const u = props.unit;
  const name = props.unitDef?.name ?? u.unitId;
  const portrait = props.unitDef?.portrait;

  const [flashOn, setFlashOn] = React.useState(false);
  React.useEffect(() => {
    if (!props.flashTarget) return;
    const match = props.flashTarget.side === props.side && props.flashTarget.slot === props.slot;
    if (!match) return;
    setFlashOn(true);
    const t = window.setTimeout(() => setFlashOn(false), 220);
    return () => window.clearTimeout(t);
  }, [props.flashKey]);

  return (
    <div className={"unitBox" + (flashOn ? " hit" : "")}>
      <div className="unitTop">
        {portrait ? <img className="unitPortrait" src={portrait} alt={name} loading="lazy" /> : null}
        <div className="unitName">{name}</div>
      </div>

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

      <div className="unitFloaters">
        {props.floaters.map((f) => (
          <div key={f.id} className={"floater " + (f.kind === "heal" ? "heal" : "dmg")}>
            {f.kind === "heal" ? "+" : "-"}{f.amount}
          </div>
        ))}
      </div>

      <div className="unitFxLayer">
        {props.bursts.map((b) => (
          <FxOverlay key={b.id} kind={b.kind} />
        ))}
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
