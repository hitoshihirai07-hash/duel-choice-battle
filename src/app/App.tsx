import React, { useEffect, useMemo, useState } from "react";
import { loadGameData, type GameData } from "./store/dataLoader";
import type { Screen } from "./store/gameStore";
import Title from "./screens/Title";
import ModeSelect from "./screens/ModeSelect";
import Daily from "./screens/Daily";
import PartyBuild from "./screens/PartyBuild";
import Story from "./screens/Story";
import Battle from "./screens/Battle";
import Training from "./screens/Training";
import Result, { type BattleSummary } from "./screens/Result";

import { ACTIVE_SLOT_KEY, SLOT_COUNT, clampSlot, createLocalStorageAdapter, getBackupKey, getSaveKey } from "./save/localStorageAdapter";
import type { SaveDataV1 } from "./save/saveAdapter";
import { createDefaultSave, normalizeSave } from "./save/saveUtils";
import { dailyRewardPoints, getJstDateKey, isDailyBattleId, isYesterdayJst } from "./daily/daily";
import { applySettings as applySoundSettings, ensureAudio, startBgm, stopBgm } from "./sound/sound";

export default function App() {
  const [data, setData] = useState<GameData | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [screen, setScreen] = useState<Screen>({ name: "title" });

  const [lastBattle, setLastBattle] = useState<BattleSummary | null>(null);
  const [afterResult, setAfterResult] = useState<Screen | null>(null);
  const [lastRewards, setLastRewards] = useState<{ trainingPoints: number; unlockSkillNames: string[]; message?: string } | null>(null);

  const [activeSlot, setActiveSlot] = useState<1 | 2 | 3>(() => {
    try {
      const raw = localStorage.getItem(ACTIVE_SLOT_KEY);
      return clampSlot(raw ? Number(raw) : 1);
    } catch {
      return 1;
    }
  });
  const saveAdapter = useMemo(() => createLocalStorageAdapter(activeSlot), [activeSlot]);

  const [save, setSave] = useState<SaveDataV1 | null>(null);
  const [saveReady, setSaveReady] = useState(false);

  useEffect(() => {
    loadGameData()
      .then(setData)
      .catch((e) => setErr(String(e)));
  }, []);

  // セーブ読み込み（localStorage）
  useEffect(() => {
    if (!data) return;
    let alive = true;
    setSaveReady(false);
    saveAdapter
      .load()
      .then((loaded) => {
        if (!alive) return;
        const s = loaded ? normalizeSave(data, loaded) : createDefaultSave(data);
        setSave(s);
        setSaveReady(true);
      })
      .catch(() => {
        if (!alive) return;
        setSave(createDefaultSave(data));
        setSaveReady(true);
      });
    return () => {
      alive = false;
    };
  }, [data, activeSlot]);

  // 自動保存
  useEffect(() => {
    if (!save || !saveReady) return;
    void saveAdapter.save(save);
  }, [save, saveReady]);

  // サウンド設定（BGM/SE）を反映
  useEffect(() => {
    if (!saveReady || !save) return;
    const sfx = save.settings?.sfx ?? 1;
    const bgm = save.settings?.bgm ?? 1;
    applySoundSettings({ sfx, bgm });
    if (bgm <= 0.001) stopBgm();
  }, [saveReady, save?.settings?.sfx, save?.settings?.bgm]);

  // 最初のユーザー操作で音を有効化（自動再生制限対策）
  useEffect(() => {
    const handler = () => {
      void ensureAudio().then((ok) => {
        if (!ok) return;
        const bgm = save?.settings?.bgm ?? 1;
        if (bgm > 0.001) startBgm();
      });
    };
    window.addEventListener("pointerdown", handler, { once: true });
    return () => window.removeEventListener("pointerdown", handler);
  }, [save?.settings?.bgm]);

  const updateSave = (fn: (prev: SaveDataV1) => SaveDataV1) => {
    setSave((prev) => {
      if (!prev) return prev;
      const next = fn(prev);
      return { ...next, updatedAt: Date.now() };
    });
  };

  const downloadJson = (obj: unknown, filename: string) => {
    const json = JSON.stringify(obj, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 500);
  };

  const formatForFileName = (t: number) => {
    const d = new Date(t);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(
      d.getSeconds()
    )}`;
  };

  const api = useMemo(() => {
    return {
      go: (s: Screen) => setScreen(s),
    };
  }, []);

  // Hooks must run in the same order every render.
  // Compute slot metadata with safe fallbacks even before save is ready.
  const saveUpdatedAt = save?.updatedAt ?? 0;
  const slotMetas = useMemo(() => {
    const metas: Array<{ slot: 1 | 2 | 3; hasSave: boolean; updatedAt: number }> = [];
    for (let i = 1; i <= SLOT_COUNT; i++) {
      const slot = clampSlot(i);
      let hasSave = false;
      let updatedAt = 0;
      try {
        const raw = localStorage.getItem(getSaveKey(slot));
        if (raw) {
          const parsed: any = JSON.parse(raw);
          if (parsed && typeof parsed === "object" && typeof parsed.updatedAt === "number") {
            hasSave = true;
            updatedAt = parsed.updatedAt;
          }
        }
      } catch {
        // ignore
      }

      if (slot === activeSlot && save) {
        hasSave = true;
        updatedAt = save.updatedAt;
      }

      metas.push({ slot, hasSave, updatedAt });
    }
    return metas;
  }, [activeSlot, saveUpdatedAt]);

  if (err) {
    return (
      <div className="container">
        <div className="card">
          <div className="h1">読み込みエラー</div>
          <div className="muted">{err}</div>
          <div className="hr" />
          <div className="small muted">
            Cloudflare Pages配信時は <span className="badge">public/data</span> が配信されているか確認してください。
          </div>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="container">
        <div className="card">
          <div className="h1">読み込み中…</div>
          <div className="muted">data/*.json を読み込んでいます</div>
        </div>
      </div>
    );
  }

  if (!saveReady || !save) {
    return (
      <div className="container">
        <div className="card">
          <div className="h1">読み込み中…</div>
          <div className="muted">セーブデータを確認しています</div>
        </div>
      </div>
    );
  }


  switch (screen.name) {
    case "title":
      return (
        <Title
          currentSlot={activeSlot}
          slots={slotMetas}
          hasSave={slotMetas.find((x) => x.slot === activeSlot)?.hasSave ?? true}
          lastUpdatedAt={save.updatedAt}
          onStart={() => api.go({ name: "mode" })}
          onSelectSlot={async (slot) => {
            const s = clampSlot(slot);
            try {
              localStorage.setItem(ACTIVE_SLOT_KEY, String(s));
            } catch {
              // ignore
            }
            // 画面はタイトルのまま、セーブ読み込みだけ切り替える
            setActiveSlot(s);
            api.go({ name: "title" });
          }}
          onResetAll={async () => {
            await saveAdapter.clear();
            setSave(createDefaultSave(data));
            api.go({ name: "title" });
          }}
          onExport={() => {
            const now = Date.now();
            const payload = {
              app: "duel-choice-battle",
              schema: 1,
              exportedAt: now,
              slot: activeSlot,
              save,
            };
            downloadJson(payload, `duel-choice-battle-slot${activeSlot}-save-${formatForFileName(now)}.json`);
          }}
          onImport={async (file) => {
            try {
              const text = await file.text();
              const parsed: any = JSON.parse(text);
              const candidate: any = parsed?.app === "duel-choice-battle" && parsed?.save ? parsed.save : parsed;

              if (!candidate || typeof candidate !== "object") return "NG: JSONの形式が不正です";
              if (candidate.version !== 1) return "NG: このデータは読み込めません（version違い）";

              // 直前の状態をバックアップ
              try {
                localStorage.setItem(getBackupKey(activeSlot), JSON.stringify(save));
              } catch {
                // ignore
              }

              const next = normalizeSave(data, candidate as SaveDataV1);
              setSave(next);
              return "OK: 読み込みました（タイトルに反映済み）";
            } catch (e) {
              return `NG: 読み込みに失敗しました（${String(e).slice(0, 80)}）`;
            }
          }}
          hasBackup={(() => {
            try {
              return localStorage.getItem(getBackupKey(activeSlot)) != null;
            } catch {
              return false;
            }
          })()}
          onRestoreBackup={async () => {
            try {
              const raw = localStorage.getItem(getBackupKey(activeSlot));
              if (!raw) return "NG: バックアップが見つかりません";
              const parsed: any = JSON.parse(raw);
              if (!parsed || typeof parsed !== "object" || parsed.version !== 1) {
                return "NG: バックアップ形式が不正です";
              }
              const next = normalizeSave(data, parsed as SaveDataV1);
              setSave(next);
              localStorage.removeItem(getBackupKey(activeSlot));
              return "OK: バックアップから復元しました";
            } catch (e) {
              return `NG: 復元に失敗しました（${String(e).slice(0, 80)}）`;
            }
          }}
        />
      );
    case "mode":
      return (
        <ModeSelect
          settings={{
            sfx: save?.settings?.sfx ?? 1,
            bgm: save?.settings?.bgm ?? 1,
          }}
          onUpdateSettings={(patch) =>
            updateSave((prev) => ({
              ...prev,
              settings: {
                ...(prev.settings ?? { textSpeed: 1, sfx: 1, bgm: 1 }),
                ...patch,
              },
            }))
          }
          onStory={() => api.go({ name: "story" })}
          onFreeBattle={(format) => api.go({ name: "party", format, fromStory: false })}
          onDaily={() => api.go({ name: "daily" })}
          onTraining={() => api.go({ name: "training", returnTo: "mode" })}
          onBack={() => api.go({ name: "title" })}
        />
      );
    case "daily":
      return (
        <Daily
          data={data}
          save={save}
          onUpdateSave={updateSave}
          onStart={(format, battleId) => api.go({ name: "party", format, fromStory: false, battleId })}
          onBack={() => api.go({ name: "mode" })}
        />
      );
    case "story":
      return (
        <Story
          data={data}
          save={save}
          onUpdateSave={updateSave}
          onBattle={(battleId, format, nextStoryNodeId) =>
            api.go({ name: "party", format, fromStory: true, battleId, nextStoryNodeId })
          }
          onBack={() => api.go({ name: "mode" })}
        />
      );
    case "party":
      return (
        <PartyBuild
          data={data}
          save={save}
          onUpdateSave={updateSave}
          format={screen.format}
          fromStory={screen.fromStory}
          onStartBattle={(battleId, nextStoryNodeId) =>
            api.go({ name: "battle", battleId, format: screen.format, fromStory: screen.fromStory, nextStoryNodeId })
          }
          onBack={() => {
            if (!screen.fromStory && screen.battleId && isDailyBattleId(screen.battleId)) return api.go({ name: "daily" });
            return api.go(screen.fromStory ? { name: "story" } : { name: "mode" });
          }}
          battleId={screen.battleId}
          nextStoryNodeId={screen.nextStoryNodeId}
        />
      );
    case "battle":
      return (
        <Battle
          data={data}
          save={save}
          format={screen.format}
          battleId={screen.battleId}
          fromStory={screen.fromStory}
          onFinish={(result) => {
            // 戦績（共有カード用）を保持
            try {
              const unitById = new Map(data.units.map((u) => [u.id, u] as const));
              const mk = (m: any) => {
                const ud = unitById.get(m.unitId);
                return {
                  unitId: m.unitId as string,
                  name: ud?.name ?? String(m.unitId),
                  portrait: (ud as any)?.portrait ?? undefined,
                  hp: m.hp as number,
                  maxHp: m.maxHp as number,
                  alive: (m.hp as number) > 0,
                };
              };

              const summary: BattleSummary = {
                battleId: screen.battleId,
                format: screen.format,
                winner: result.winner,
                turns: Math.max(0, (result.state.turn ?? 1) - 1),
                ts: Date.now(),
                fromStory: screen.fromStory,
                teamA: (result.state.teams.A.members ?? []).map(mk),
                teamB: (result.state.teams.B.members ?? []).map(mk),
              };
              setLastBattle(summary);
            } catch {
              // ignore
            }

            const isDaily = isDailyBattleId(screen.battleId);
            const nextScreen: Screen =
              result.winner === "A"
                ? {
                    name: "training",
                    returnTo: screen.fromStory ? "story" : isDaily ? "daily" : "mode",
                  }
                : screen.fromStory
                  ? { name: "story" }
                  : isDaily
                    ? { name: "daily" }
                    : { name: "mode" };
            setAfterResult(nextScreen);

            if (result.winner === "A") {
              const b = data.battles.find((x) => x.id === screen.battleId);

              // デイリーは「日付×形式」で 1 回だけ報酬
              const daily = isDailyBattleId(screen.battleId);
              const todayKey = daily ? getJstDateKey() : "";
              const dailyKey = screen.format === "1v1" ? "v1" : "v3";
              const alreadyClaimed =
                daily && !!(save?.daily?.claimed?.[todayKey] as any)?.[dailyKey];

              const tp = daily ? (alreadyClaimed ? 0 : dailyRewardPoints(screen.format)) : b?.rewards?.trainingPoints ?? 0;
              const unlock = daily ? [] : b?.rewards?.unlockSkillIds ?? [];

              // 「今回 新しく解放された」技だけ抽出（既に習得済みならスキップ）
              const newlyUnlocked: string[] = (() => {
                if (!unlock.length || !save) return unlock;
                const unitById = new Map(data.units.map((u) => [u.id, u] as const));
                return unlock.filter((sid) => {
                  let canLearn = false;
                  let allAlready = true;
                  for (const r of save.roster) {
                    const ud = unitById.get(r.unitId);
                    if (!ud) continue;
                    if (!ud.learnableSkillIds.includes(sid)) continue;
                    canLearn = true;
                    if (!(r.unlockedSkillIds ?? []).includes(sid)) {
                      allAlready = false;
                      break;
                    }
                  }
                  return canLearn && !allAlready;
                });
              })();

              const skillById = new Map(data.skills.map((s) => [s.id, s] as const));
              const names = newlyUnlocked.map((id) => skillById.get(id)?.name ?? id);
              const message = daily
                ? alreadyClaimed
                  ? "デイリー報酬は受け取り済み（今日は +0pt）"
                  : `デイリー報酬 +${tp}pt を獲得！`
                : undefined;
              setLastRewards({ trainingPoints: tp, unlockSkillNames: names, message });

              updateSave((prev) => {
                let next = {
                  ...prev,
                  resources: { trainingPoints: (prev.resources.trainingPoints ?? 0) + tp },
                };

                // デイリー達成記録（形式ごと）＋連続日数
                if (daily) {
                  const tk = todayKey;
                  const dv = next.daily ?? { claimed: {}, streak: 0 };
                  const beforeToday = dv.claimed?.[tk] ?? {};
                  const hadClearedToday = !!((beforeToday as any).v1 || (beforeToday as any).v3);

                  const afterToday = { ...beforeToday, [dailyKey]: true } as any;
                  const claimed = { ...(dv.claimed ?? {}), [tk]: afterToday };

                  // その日の "初" クリアのときだけ streak 更新
                  let streak = dv.streak ?? 0;
                  let lastClearedDate = dv.lastClearedDate;
                  if (!hadClearedToday && (tp > 0 || !alreadyClaimed)) {
                    if (lastClearedDate === tk) {
                      // noop
                    } else if (lastClearedDate && isYesterdayJst(lastClearedDate, tk)) {
                      streak = Math.max(1, streak + 1);
                    } else {
                      streak = 1;
                    }
                    lastClearedDate = tk;
                  }

                  next = { ...next, daily: { claimed, streak, lastClearedDate } };
                }

                // 技解放（習得可能なユニットだけ）
                if (unlock.length) {
                  const unitById = new Map(data.units.map((u) => [u.id, u] as const));
                  next = {
                    ...next,
                    roster: next.roster.map((r) => {
                      const ud = unitById.get(r.unitId);
                      if (!ud) return r;
                      const add = unlock.filter((id) => ud.learnableSkillIds.includes(id));
                      if (add.length === 0) return r;
                      const set = new Set([...(r.unlockedSkillIds ?? []), ...add]);
                      return { ...r, unlockedSkillIds: Array.from(set) };
                    }),
                  };
                }

                // ストーリー進行
                if (screen.fromStory && screen.nextStoryNodeId) {
                  next = { ...next, story: { ...next.story, currentNodeId: screen.nextStoryNodeId } };
                }
                return next;
              });
            } else {
              setLastRewards(null);
            }

            api.go({ name: "result" });
          }}
          onExit={() => {
            if (!screen.fromStory && isDailyBattleId(screen.battleId)) return api.go({ name: "daily" });
            return api.go(screen.fromStory ? { name: "story" } : { name: "mode" });
          }}
        />
      );
    case "result":
      return (
        <Result
          summary={lastBattle}
          rewards={lastRewards}
          onContinue={() => {
            api.go(afterResult ?? { name: "mode" });
          }}
          onBack={() => {
            if (lastBattle?.fromStory) return api.go({ name: "story" });
            if (lastBattle?.battleId && isDailyBattleId(lastBattle.battleId)) return api.go({ name: "daily" });
            return api.go({ name: "mode" });
          }}
        />
      );
    case "training":
      return (
        <Training
          data={data}
          save={save}
          onUpdateSave={updateSave}
          onDone={() => api.go({ name: screen.returnTo })}
        />
      );
    default:
      return null;
  }
}
