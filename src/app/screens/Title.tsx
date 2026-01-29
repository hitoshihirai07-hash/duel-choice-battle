import React, { useMemo, useState } from "react";

export default function Title(props: {
  hasSave: boolean;
  lastUpdatedAt: number;
  onStart: () => void;
  onResetAll: () => Promise<void> | void;
}) {
  const [confirm, setConfirm] = useState(false);

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
        <div className="row" style={{ alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <button className="btn primary" onClick={props.onStart}>
            はじめる
          </button>

          <button
            className="btn"
            onClick={async () => {
              if (!confirm) {
                setConfirm(true);
                return;
              }
              setConfirm(false);
              await props.onResetAll();
            }}
          >
            {confirm ? "データ削除（もう一度で確定）" : "データ削除"}
          </button>
        </div>

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
