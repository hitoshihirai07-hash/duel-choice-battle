import React from "react";

export default function Title(props: { onStart: () => void }) {
  return (
    <div className="container">
      <div className="card">
        <div className="h1">Duel Choice Battle</div>
        <div className="muted">
          状態異常なし／バフデバフあり／技4枠／1vs1 & 3vs3(交代) の最小プロト
        </div>
        <div className="hr" />
        <button className="btn primary" onClick={props.onStart}>
          はじめる
        </button>
        <div className="hr" />
        <div className="small muted">
          データは <span className="badge">public/data</span> にあります。ここを増やすだけで拡張できます。
        </div>
      </div>
    </div>
  );
}
