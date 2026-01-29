import React from "react";

export default function Training(props: { onDone: () => void }) {
  return (
    <div className="container">
      <div className="card">
        <div className="h1">育成（ダミー）</div>
        <div className="muted">
          MVPでは画面だけ用意しています。次ステップで「勝利報酬のポイント振り」「技解放」「保存」に接続します。
        </div>
        <div className="hr" />
        <button className="btn primary" onClick={props.onDone}>
          モードへ戻る
        </button>
      </div>
    </div>
  );
}
