import React, { useEffect, useMemo, useState } from "react";
import { loadGameData, type GameData } from "./store/dataLoader";
import type { Screen } from "./store/gameStore";
import Title from "./screens/Title";
import ModeSelect from "./screens/ModeSelect";
import PartyBuild from "./screens/PartyBuild";
import Story from "./screens/Story";
import Battle from "./screens/Battle";
import Training from "./screens/Training";

import { ACTIVE_SLOT_KEY, SLOT_COUNT, clampSlot, createLocalStorageAdapter, getBackupKey, getSaveKey } from "./save/localStorageAdapter";
import type { SaveDataV1 } from "./save/saveAdapter";
import { createDefaultSave, normalizeSave } from "./save/saveUtils";

export default function App() {
  const [data, setData] = useState<GameData | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [screen, setScreen] = useState<Screen>({ name: "title" });

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
  }, [activeSlot, save.updatedAt]);
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
          onStory={() => api.go({ name: "story" })}
          onFreeBattle={(format) => api.go({ name: "party", format, fromStory: false })}
            onTraining={() => api.go({ name: "training", returnTo: "mode" })}
          onBack={() => api.go({ name: "title" })}
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
          onBack={() => api.go(screen.fromStory ? { name: "story" } : { name: "mode" })}
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
            if (result.winner === "A") {
              // 勝利報酬
              const b = data.battles.find((x) => x.id === screen.battleId);
              const tp = b?.rewards?.trainingPoints ?? 0;
              const unlock = b?.rewards?.unlockSkillIds ?? [];

              updateSave((prev) => {
                let next = {
                  ...prev,
                  resources: { trainingPoints: (prev.resources.trainingPoints ?? 0) + tp },
                };

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

              api.go({ name: "training", returnTo: screen.fromStory ? "story" : "mode" });
            } else {
              // 敗北時は戻るだけ
              api.go(screen.fromStory ? { name: "story" } : { name: "mode" });
            }
          }}
          onExit={() => api.go(screen.fromStory ? { name: "story" } : { name: "mode" })}
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
