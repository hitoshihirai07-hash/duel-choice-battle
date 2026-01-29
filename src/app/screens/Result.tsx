import React, { useEffect, useMemo, useRef, useState } from "react";

export type BattleMemberSummary = {
  unitId: string;
  name: string;
  portrait?: string;
  hp: number;
  maxHp: number;
  alive: boolean;
};

export type BattleSummary = {
  battleId: string;
  format: "1v1" | "3v3";
  winner: "A" | "B";
  turns: number;
  ts: number;
  fromStory: boolean;
  teamA: BattleMemberSummary[];
  teamB: BattleMemberSummary[];
};

function clamp01(n: number) {
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

async function loadImage(src: string) {
  return await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("image load failed"));
    img.src = src;
  });
}

export default function Result(props: {
  summary: BattleSummary | null;
  onContinue: () => void;
  onBack: () => void;
}) {
  const { summary } = props;
  const [imgUrl, setImgUrl] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    return () => {
      if (imgUrl) URL.revokeObjectURL(imgUrl);
    };
  }, [imgUrl]);

  const youWin = summary?.winner === "A";
  const title = summary ? (youWin ? "あなたの勝ち！" : "あなたの負け…") : "戦闘結果";
  const continueLabel = summary ? (youWin ? "育成へ" : summary.fromStory ? "ストーリーへ" : "モードへ") : "戻る";

  const fileName = useMemo(() => {
    if (!summary) return "battle-card.png";
    const d = new Date(summary.ts);
    const pad = (n: number) => String(n).padStart(2, "0");
    const stamp = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(
      d.getMinutes()
    )}${pad(d.getSeconds())}`;
    return `battle-card-${summary.battleId}-${stamp}.png`;
  }, [summary]);

  async function generateCard() {
    if (!summary) return;
    setGenerating(true);
    try {
      // 1200x630（X/Twitter向け）
      const canvas = canvasRef.current ?? document.createElement("canvas");
      canvas.width = 1200;
      canvas.height = 630;
      canvasRef.current = canvas;
      const ctx0 = canvas.getContext("2d");
      if (!ctx0) return;
      const ctx: CanvasRenderingContext2D = ctx0;

      // 背景
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#f6f6f6";
      ctx.fillRect(0, 0, canvas.width, 96);

      // ヘッダ
      ctx.fillStyle = "#111";
      ctx.font = "bold 42px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
      ctx.fillText("対戦結果", 40, 62);

      ctx.font = "20px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
      ctx.fillStyle = "#333";
      ctx.fillText(
        `${summary.format.toUpperCase()}  /  ターン: ${summary.turns}  /  ID: ${summary.battleId}`,
        40,
        90
      );

      // 勝敗
      ctx.font = "bold 54px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
      ctx.fillStyle = youWin ? "#0a7" : "#d33";
      ctx.fillText(youWin ? "WIN" : "LOSE", 980, 72);

      // チーム描画
      const leftX = 60;
      const rightX = 640;
      const topY = 140;
      const rowH = 120;

      async function drawTeam(
        drawCtx: CanvasRenderingContext2D,
        titleText: string,
        x: number,
        members: BattleMemberSummary[]
      ) {
        drawCtx.fillStyle = "#111";
        drawCtx.font = "bold 28px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
        drawCtx.fillText(titleText, x, topY - 18);

        for (let i = 0; i < members.length; i++) {
          const m = members[i];
          const y = topY + i * rowH;

          // カード枠
          drawCtx.fillStyle = "#fff";
          drawCtx.strokeStyle = "#ddd";
          drawCtx.lineWidth = 2;
          drawCtx.beginPath();
          roundRect(drawCtx, x, y, 500, 96, 18);
          drawCtx.fill();
          drawCtx.stroke();

          // ポートレート
          const px = x + 18;
          const py = y + 16;
          drawCtx.fillStyle = "#eee";
          drawCtx.fillRect(px, py, 64, 64);
          if (m.portrait) {
            try {
              const img = await loadImage(m.portrait);
              drawCtx.drawImage(img, px, py, 64, 64);
            } catch {
              // ignore
            }
          }

          // 名前
          drawCtx.fillStyle = "#111";
          drawCtx.font = "bold 26px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
          drawCtx.fillText(m.name, x + 100, y + 46);

          // HPバー
          const hpRate = clamp01(m.maxHp > 0 ? m.hp / m.maxHp : 0);
          const barX = x + 100;
          const barY = y + 60;
          const barW = 360;
          const barH = 18;
          drawCtx.fillStyle = "#e9e9e9";
          drawCtx.fillRect(barX, barY, barW, barH);
          drawCtx.fillStyle = m.alive ? (hpRate > 0.5 ? "#2aa" : hpRate > 0.2 ? "#e9b400" : "#d33") : "#999";
          drawCtx.fillRect(barX, barY, Math.max(0, Math.floor(barW * hpRate)), barH);

          drawCtx.fillStyle = "#333";
          drawCtx.font = "18px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
          drawCtx.fillText(`HP ${m.hp}/${m.maxHp}`, barX, y + 92);
        }
      }

      await drawTeam(ctx, "あなた", leftX, summary.teamA);
      await drawTeam(ctx, "相手", rightX, summary.teamB);

      // フッタ
      ctx.fillStyle = "#666";
      ctx.font = "18px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
      ctx.fillText("Duel Choice Battle", 40, 610);
      const d = new Date(summary.ts);
      ctx.fillText(d.toLocaleString("ja-JP"), 860, 610);

      const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
      if (!blob) return;

      if (imgUrl) URL.revokeObjectURL(imgUrl);
      const url = URL.createObjectURL(blob);
      setImgUrl(url);
    } finally {
      setGenerating(false);
    }
  }

  function download() {
    if (!imgUrl) return;
    const a = document.createElement("a");
    a.href = imgUrl;
    a.download = fileName;
    a.click();
  }

  if (!summary) {
    return (
      <div className="screen">
        <h1>戦闘結果</h1>
        <p className="muted">戦績が見つかりませんでした。</p>
        <div className="row">
          <button className="btn" onClick={props.onBack}>
            戻る
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="screen">
      <h1>{title}</h1>
      <p className="muted">
        {summary.format.toUpperCase()} / ターン {summary.turns} / {summary.battleId}
      </p>

      <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
        <button className="btn" onClick={generateCard} disabled={generating}>
          {generating ? "画像生成中..." : "戦績カードを作る"}
        </button>
        <button className="btn" onClick={download} disabled={!imgUrl}>
          PNGダウンロード
        </button>
        <button className="btn primary" onClick={props.onContinue}>
          {continueLabel}
        </button>
      </div>

      {imgUrl ? (
        <div style={{ marginTop: 14 }}>
          <img
            src={imgUrl}
            alt="戦績カード"
            style={{ width: "100%", maxWidth: 760, borderRadius: 12, border: "1px solid #ddd" }}
          />
          <p className="muted" style={{ marginTop: 8 }}>
            ※画像はローカル生成です（サーバー送信なし）
          </p>
        </div>
      ) : (
        <p className="muted" style={{ marginTop: 12 }}>
          ※まず「戦績カードを作る」を押してください
        </p>
      )}

      <canvas ref={canvasRef} style={{ display: "none" }} />
    </div>
  );
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}
