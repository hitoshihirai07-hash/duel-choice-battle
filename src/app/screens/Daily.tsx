import React, { useEffect, useMemo, useState } from "react";
import type { GameData } from "../store/dataLoader";
import type { SaveDataV1 } from "../save/saveAdapter";
import type { BattleFormat, SkillDef } from "../../engine/types";
import { dailyBattleId, dailyRewardPoints, getJstDateKey, getJstWeekStartKey, jstKeyToUtcMs, utcMsToJstKey } from "../daily/daily";

const statLabel: Record<string, string> = { atk: "攻撃", def: "守備", spd: "素早さ" };
const pct = (v?: number) => (v == null ? "-" : `${Math.round(v * 100)}%`);

const describeSkill = (sk: SkillDef): string => {
  const base = `SP${sk.spCost} / CT${sk.cooldown}`;
  switch (sk.type) {
    case "attack":
      return `攻撃（威力${sk.power ?? "-"} / 命中${pct(sk.hit)}）${base}`;
    case "heal":
      return `回復（HP${pct(sk.healPct)}）${base}`;
    case "buff":
      return `強化（${statLabel[sk.buff?.stat ?? ""] ?? "?"} +${Math.abs(sk.buff?.delta ?? 0)}）${base}`;
    case "debuff":
      return `弱体（${statLabel[sk.debuff?.stat ?? ""] ?? "?"} ${sk.debuff?.delta ?? 0}）${base}`;
    case "guard":
      return `防御（ガード${pct(sk.guardPct)} / ${sk.durationTurns ?? 1}T）${base}`;
    case "charge":
      return `溜め（次攻撃x${sk.chargeMul ?? "-"} / ${sk.durationTurns ?? 1}T）${base}`;
    default:
      return base;
  }
};

export default function Daily(props: {
  data: GameData;
  save: SaveDataV1;
  onUpdateSave: (fn: (prev: SaveDataV1) => SaveDataV1) => void;
  onStart: (format: BattleFormat, battleId: string) => void;
  onBack: () => void;
}) {
  const dateKey = useMemo(() => getJstDateKey(), []);
  const claimed = props.save.daily?.claimed ?? {};
  const today = claimed[dateKey] ?? {};
  const streak = props.save.daily?.streak ?? 0;

  // ---------------------------
  // 週間報酬（デイリー勝利累計）
  // ---------------------------
  const dayMs = 24 * 60 * 60 * 1000;
  const weekStartKey = useMemo(() => getJstWeekStartKey(dateKey), [dateKey]);
  const weekStartUtcMs = useMemo(() => jstKeyToUtcMs(weekStartKey), [weekStartKey]);
  const weekKeys = useMemo(
    () => Array.from({ length: 7 }, (_, i) => utcMsToJstKey(weekStartUtcMs + i * dayMs)),
    [weekStartUtcMs]
  );
  const weekEndKey = weekKeys[6];

  const weeklyWins = useMemo(() => {
    let n = 0;
    for (const k of weekKeys) {
      const c = claimed[k] ?? {};
      if ((c as any).v1) n += 1;
      if ((c as any).v3) n += 1;
    }
    return n;
  }, [claimed, weekKeys]);

  const rawWeekly = props.save.daily?.weekly;
  const weekly = rawWeekly && rawWeekly.weekKey === weekStartKey ? rawWeekly : { weekKey: weekStartKey, claimed: {}, w5Options: undefined as string[] | undefined };
  const wClaimed = weekly.claimed ?? {};
  const claimed3 = !!(wClaimed as any).w3;
  const claimed5 = !!(wClaimed as any).w5;
  const claimed7 = !!(wClaimed as any).w7;

  // 週が変わったら自動リセット（画面を開いたまま日付を跨いでもOK）
  useEffect(() => {
    if (!props.save.daily) return;
    const cur = props.save.daily.weekly;
    if (cur && cur.weekKey === weekStartKey) return;
    props.onUpdateSave((prev) => {
      const d = prev.daily ?? { claimed: {}, streak: 0 };
      return {
        ...prev,
        daily: {
          ...d,
          weekly: { weekKey: weekStartKey, claimed: {}, w5Options: undefined },
        },
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekStartKey]);

  const [toast, setToast] = useState<string | null>(null);
  const [pickOpen, setPickOpen] = useState(false);
  const [pickOptions, setPickOptions] = useState<string[]>([]);

  const unitById = useMemo(() => new Map(props.data.units.map((u) => [u.id, u] as const)), [props.data.units]);
  const skillById = useMemo(() => new Map(props.data.skills.map((s) => [s.id, s] as const)), [props.data.skills]);

  const isUnlockableSkill = (save: SaveDataV1, skillId: string) => {
    let anyLearnable = false;
    let anyMissing = false;
    for (const r of save.roster) {
      const u = unitById.get(r.unitId);
      const learnable = !!u?.learnableSkillIds?.includes(skillId);
      if (!learnable) continue;
      anyLearnable = true;
      if (!r.unlockedSkillIds?.includes(skillId)) anyMissing = true;
    }
    return anyLearnable && anyMissing;
  };

  const buildW5Options = (save: SaveDataV1) => {
    // 週間5勝報酬：スキル選択（必殺は7勝報酬に回す）
    const candidates = props.data.skills
      .map((s) => s.id)
      .filter((id) => id !== "sk_attack" && id !== "sk_guard" && id !== "sk_high_strike")
      .filter((id) => isUnlockableSkill(save, id));

    if (candidates.length <= 3) return candidates;

    // 週ごとに固定したいので、weekKey を seed にする
    const hash32 = (str: string) => {
      let h = 0x811c9dc5;
      for (let i = 0; i < str.length; i++) {
        h ^= str.charCodeAt(i);
        h = Math.imul(h, 0x01000193);
      }
      return h >>> 0;
    };
    let x = (hash32(`weekly:${weekStartKey}`) >>> 0) || 0x12345678;
    const next = () => {
      x ^= x << 13;
      x ^= x >>> 17;
      x ^= x << 5;
      return (x >>> 0) / 0xffffffff;
    };
    const pool = candidates.slice();
    const out: string[] = [];
    while (pool.length && out.length < 3) {
      const idx = Math.floor(next() * pool.length);
      out.push(pool.splice(idx, 1)[0]);
    }
    return out;
  };

  const unlockSkillAll = (prev: SaveDataV1, skillId: string): SaveDataV1 => {
    const nextRoster = prev.roster.map((r) => {
      const u = unitById.get(r.unitId);
      if (!u?.learnableSkillIds?.includes(skillId)) return r;
      if (r.unlockedSkillIds?.includes(skillId)) return r;
      return { ...r, unlockedSkillIds: [...(r.unlockedSkillIds ?? []), skillId] };
    });
    return { ...prev, roster: nextRoster };
  };

  const claimWeekly3 = () => {
    if (weeklyWins < 3 || claimed3) return;
    props.onUpdateSave((prev) => {
      const d = prev.daily ?? { claimed: {}, streak: 0 };
      const w = d.weekly && d.weekly.weekKey === weekStartKey ? d.weekly : { weekKey: weekStartKey, claimed: {}, w5Options: undefined };
      return {
        ...prev,
        resources: { trainingPoints: (prev.resources?.trainingPoints ?? 0) + 10 },
        daily: {
          ...d,
          weekly: { ...w, claimed: { ...(w.claimed ?? {}), w3: true } },
        },
      };
    });
    setToast("週間3勝報酬：+10pt を受け取りました");
  };

  const openWeekly5Pick = () => {
    if (weeklyWins < 5 || claimed5) return;
    const current = weekly.w5Options;
    const opts = current && current.length ? current : buildW5Options(props.save);

    if (!opts.length) {
      // もう解放できるスキルが無い場合はポイントに変換
      props.onUpdateSave((prev) => {
        const d = prev.daily ?? { claimed: {}, streak: 0 };
        const w = d.weekly && d.weekly.weekKey === weekStartKey ? d.weekly : { weekKey: weekStartKey, claimed: {}, w5Options: undefined };
        return {
          ...prev,
          resources: { trainingPoints: (prev.resources?.trainingPoints ?? 0) + 8 },
          daily: { ...d, weekly: { ...w, claimed: { ...(w.claimed ?? {}), w5: true } } },
        };
      });
      setToast("週間5勝報酬：解放候補が無いので +8pt に変換しました");
      return;
    }

    // 週の選択肢を保存（途中で更新しても同じ3択）
    if (!current || !current.length) {
      props.onUpdateSave((prev) => {
        const d = prev.daily ?? { claimed: {}, streak: 0 };
        const w = d.weekly && d.weekly.weekKey === weekStartKey ? d.weekly : { weekKey: weekStartKey, claimed: {}, w5Options: undefined };
        return { ...prev, daily: { ...d, weekly: { ...w, w5Options: opts } } };
      });
    }

    setPickOptions(opts);
    setPickOpen(true);
  };

  const claimWeekly5 = (skillId: string) => {
    props.onUpdateSave((prev) => {
      const d = prev.daily ?? { claimed: {}, streak: 0 };
      const w = d.weekly && d.weekly.weekKey === weekStartKey ? d.weekly : { weekKey: weekStartKey, claimed: {}, w5Options: undefined };
      const afterUnlock = unlockSkillAll(prev, skillId);
      return {
        ...afterUnlock,
        daily: { ...d, weekly: { ...w, claimed: { ...(w.claimed ?? {}), w5: true } } },
      };
    });
    const sk = skillById.get(skillId);
    setToast(`週間5勝報酬：${sk?.name ?? skillId} を解放しました`);
    setPickOpen(false);
  };

  const claimWeekly7 = () => {
    if (weeklyWins < 7 || claimed7) return;
    const skillId = "sk_high_strike";
    props.onUpdateSave((prev) => {
      const d = prev.daily ?? { claimed: {}, streak: 0 };
      const w = d.weekly && d.weekly.weekKey === weekStartKey ? d.weekly : { weekKey: weekStartKey, claimed: {}, w5Options: undefined };
      const afterUnlock = unlockSkillAll(prev, skillId);
      return {
        ...afterUnlock,
        daily: { ...d, weekly: { ...w, claimed: { ...(w.claimed ?? {}), w7: true } } },
      };
    });
    setToast("週間7勝報酬：必殺斬り（特別スキル）を解放しました");
  };

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

        {toast ? (
          <div className="hr" />
        ) : null}
        {toast ? <div className="pill">{toast}</div> : null}

        <div className="hr" />
        <div className="row">
          <div className="col">{row("1v1")}</div>
          <div className="col">{row("3v3")}</div>
        </div>

        <div className="hr" />

        <div className="h2">週間報酬（デイリー累計）</div>
        <div className="muted small">
          {weekStartKey}〜{weekEndKey}（月曜開始） / 今週の勝利数: {weeklyWins}
        </div>
        <div className="small muted">※「デイリーの報酬受け取り」= 1勝としてカウントします（1v1/3v3それぞれ）</div>
        <div style={{ height: 10 }} />
        <div className="row">
          <div className="col">
            <div className="card">
              <div className="h3">3勝</div>
              <div className="muted small">育成pt +10</div>
              <div style={{ height: 8 }} />
              {claimed3 ? (
                <span className="pill">受け取り済み</span>
              ) : weeklyWins >= 3 ? (
                <button className="btn primary" onClick={claimWeekly3}>受け取る</button>
              ) : (
                <span className="pill">未達成</span>
              )}
            </div>
          </div>
          <div className="col">
            <div className="card">
              <div className="h3">5勝</div>
              <div className="muted small">スキルを1つ選んで解放</div>
              <div style={{ height: 8 }} />
              {claimed5 ? (
                <span className="pill">受け取り済み</span>
              ) : weeklyWins >= 5 ? (
                <button className="btn primary" onClick={openWeekly5Pick}>受け取る</button>
              ) : (
                <span className="pill">未達成</span>
              )}
            </div>
          </div>
          <div className="col">
            <div className="card">
              <div className="h3">7勝</div>
              <div className="muted small">必殺斬り（特別スキル）解放</div>
              <div style={{ height: 8 }} />
              {claimed7 ? (
                <span className="pill">受け取り済み</span>
              ) : weeklyWins >= 7 ? (
                <button className="btn primary" onClick={claimWeekly7}>受け取る</button>
              ) : (
                <span className="pill">未達成</span>
              )}
            </div>
          </div>
        </div>

        <div className="hr" />
        <button className="btn" onClick={props.onBack}>
          戻る
        </button>
      </div>

      {pickOpen ? (
        <div className="modalOverlay" onClick={() => setPickOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="h2">週間5勝報酬：スキル選択</div>
            <div className="muted small">以下から1つ選ぶと、そのスキルが「習得済み」に追加されます。</div>
            <div className="hr" />
            <div className="row">
              {pickOptions.map((id) => {
                const sk = skillById.get(id);
                return (
                  <div className="col" key={id}>
                    <div className="card">
                      <div className="h3">{sk?.name ?? id}</div>
                      {sk ? <div className="muted small">{describeSkill(sk)}</div> : null}
                      <div style={{ height: 10 }} />
                      <button className="btn primary" onClick={() => claimWeekly5(id)}>
                        これにする
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="hr" />
            <button className="btn" onClick={() => setPickOpen(false)}>
              キャンセル
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
