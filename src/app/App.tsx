import React, { useEffect, useMemo, useState } from "react";
import { loadGameData, type GameData } from "./store/dataLoader";
import type { Screen } from "./store/gameStore";
import Title from "./screens/Title";
import ModeSelect from "./screens/ModeSelect";
import PartyBuild from "./screens/PartyBuild";
import Story from "./screens/Story";
import Battle from "./screens/Battle";
import Training from "./screens/Training";

export default function App() {
  const [data, setData] = useState<GameData | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [screen, setScreen] = useState<Screen>({ name: "title" });

  useEffect(() => {
    loadGameData()
      .then(setData)
      .catch((e) => setErr(String(e)));
  }, []);

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

  switch (screen.name) {
    case "title":
      return <Title onStart={() => api.go({ name: "mode" })} />;
    case "mode":
      return (
        <ModeSelect
          onStory={() => api.go({ name: "story" })}
          onFreeBattle={(format) => api.go({ name: "party", format, fromStory: false })}
          onBack={() => api.go({ name: "title" })}
        />
      );
    case "story":
      return (
        <Story
          data={data}
          onBattle={(battleId, format, nextStoryNodeId) =>
            api.go({ name: "party", format, fromStory: true, battleId: battleId + "|" + nextStoryNodeId })
          }
          onBack={() => api.go({ name: "mode" })}
        />
      );
    case "party":
      return (
        <PartyBuild
          data={data}
          format={screen.format}
          fromStory={screen.fromStory}
          battleKey={screen.battleId}
          onStartBattle={(battleId, nextStoryNodeId) =>
            api.go({ name: "battle", battleId, format: screen.format, fromStory: screen.fromStory, nextStoryNodeId })
          }
          onBack={() => api.go(screen.fromStory ? { name: "story" } : { name: "mode" })}
        />
      );
    case "battle":
      return (
        <Battle
          data={data}
          format={screen.format}
          battleId={screen.battleId}
          fromStory={screen.fromStory}
          onFinish={(result) => {
            // result is minimal; go to training then back
            api.go({ name: "training" });
          }}
          onExit={() => api.go(screen.fromStory ? { name: "story" } : { name: "mode" })}
        />
      );
    case "training":
      return <Training onDone={() => api.go({ name: "mode" })} />;
    default:
      return null;
  }
}
