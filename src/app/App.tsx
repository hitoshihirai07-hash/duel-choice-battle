import React, { useEffect, useMemo, useState } from "react";
import { loadGameData, type GameData } from "./store/dataLoader";
import type { Screen } from "./store/gameStore";
import Title from "./screens/Title";
import ModeSelect from "./screens/ModeSelect";
import PartyBuild from "./screens/PartyBuild";
import Story from "./screens/Story";
import Battle from "./screens/Battle";
import Training from "./screens/Training";

import { localStorageAdapter } from "./save/localStorageAdapter";
import type { SaveDataV1 } from "./save/saveAdapter";
import { createDefaultSave, normalizeSave } from "./save/saveUtils";

export default function App() {
  const [data, setData] = useState<GameData | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [screen, setScreen] = useState<Screen>({ name: "title" });

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
    localStorageAdapter
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
  }, [data]);

  // 自動保存
  useEffect(() => {
    if (!save || !saveReady) return;
    void localStorageAdapter.save(save);
  }, [save, saveReady]);

  const updateSave = (fn: (prev: SaveDataV1) => SaveDataV1) => {
    setSave((prev) => {
      if (!prev) return prev;
      const next = fn(prev);
      return { ...next, updatedAt: Date.now() };
    });
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

  switch (screen.name) {
    case "title":
      return (
        <Title
          hasSave={true}
          lastUpdatedAt={save.updatedAt}
          onStart={() => api.go({ name: "mode" })}
          onResetAll={async () => {
            await localStorageAdapter.clear();
            setSave(createDefaultSave(data));
            api.go({ name: "title" });
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
