import React, { useMemo, useRef, useState } from "react";

export default function Title(props: {
  currentSlot: 1 | 2 | 3;
  slots: Array<{ slot: 1 | 2 | 3; hasSave: boolean; updatedAt: number }>;
  onSelectSlot: (slot: number) => void | Promise<void>;
  hasSave: boolean;
  lastUpdatedAt: number;
  onStart: () => void;
  onResetAll: () => Promise<void> | void;
  onExport: () => void;
  onImport: (file: File) => Promise<string | null>;
  hasBackup: boolean;
  onRestoreBackup: () => Promise<string | null>;
}) {
  const [confirmReset, setConfirmReset] = useState(false);
  const [confirmRestore, setConfirmRestore] = useState(false);
  const [notice, setNotice] = useState<{ type: "ok" | "ng"; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const last = useMemo(() => {
    try {
      const d = new Date(props.lastUpdatedAt);
      return d.toLocaleString("ja-JP");
    } catch {
      return "-";
    }
  }, [props.lastUpdatedAt]);

  return (
    <div className="container">
      <div className="card">
        <div className="h1">Duel Choice Battle</div>
        <div className="muted">
          状態異常なし／バフデバフあり／技4枠／1vs1 & 3vs3(交代) の最小プロト
        </div>
        <div className="hr" />

        <div className="small muted">セーブスロット</div>
        <div className="row" style={{ alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          {props.slots.map((s) => (
            <button
              key={s.slot}
              className={s.slot === props.currentSlot ? "btn primary" : "btn"}
              onClick={async () => {
                if (s.slot === props.currentSlot) return;
                setConfirmReset(false);
                setConfirmRestore(false);
                setNotice(null);
                await props.onSelectSlot(s.slot);
              }}
              title={s.hasSave ? `最終更新: ${new Date(s.updatedAt).toLocaleString("ja-JP")}` : "未使用"}
            >
              {`slot${s.slot}`}
            </button>
          ))}
        </div>
        <div className="small muted" style={{ marginTop: 6 }}>
          {props.slots.map((s) => (
            <span key={s.slot} style={{ marginRight: 10 }}>
              <span className="badge">{`S${s.slot}`}</span>{" "}
              {s.hasSave ? new Date(s.updatedAt).toLocaleString("ja-JP") : "未使用"}
            </span>
          ))}
        </div>

        <div className="hr" />
        <div className="row" style={{ alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <button className="btn primary" onClick={props.onStart}>
            はじめる
          </button>

          <button
            className="btn"
            onClick={() => {
              setNotice(null);
              props.onExport();
            }}
          >
            データ出力
          </button>

          <button
            className="btn"
            onClick={() => {
              setNotice(null);
              fileRef.current?.click();
            }}
          >
            データ読み込み
          </button>

          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            style={{ display: "none" }}
            onChange={async (e) => {
              const f = e.target.files?.[0];
              // 同じファイルを連続で選べるようにリセット
              e.currentTarget.value = "";
              if (!f) return;
              const msg = await props.onImport(f);
              if (msg) setNotice({ type: msg.startsWith("OK:") ? "ok" : "ng", text: msg.replace(/^OK:\s?/, "") });
            }}
          />

          {props.hasBackup && (
            <button
              className="btn"
              onClick={async () => {
                if (!confirmRestore) {
                  setConfirmRestore(true);
                  return;
                }
                setConfirmRestore(false);
                const msg = await props.onRestoreBackup();
                if (msg) setNotice({ type: msg.startsWith("OK:") ? "ok" : "ng", text: msg.replace(/^OK:\s?/, "") });
              }}
            >
              {confirmRestore ? "バックアップ復元（もう一度で確定）" : "バックアップ復元"}
            </button>
          )}

          <button
            className="btn"
            onClick={async () => {
              if (!confirmReset) {
                setConfirmReset(true);
                return;
              }
              setConfirmReset(false);
              await props.onResetAll();
            }}
          >
            {confirmReset ? "データ削除（もう一度で確定）" : "データ削除"}
          </button>
        </div>

        {notice && (
          <div className="hr" />
        )}
        {notice && (
          <div className={notice.type === "ok" ? "small" : "small"}>
            <span className={notice.type === "ok" ? "badge" : "badge"}>{notice.type === "ok" ? "OK" : "NG"}</span>{" "}
            <span className={notice.type === "ok" ? "" : ""}>{notice.text}</span>
          </div>
        )}

        <div className="hr" />
        <div className="small muted">ローカル保存: {props.hasSave ? "あり" : "なし"} / 最終更新: {last}</div>
        <div className="hr" />
        <div className="small muted">
          データは <span className="badge">public/data</span> にあります。ここを増やすだけで拡張できます。
        </div>
      </div>
    </div>
  );
}
