# Duel Choice Battle (MVP Scaffold)

状態異常なし / バフ・デバフあり / 技4枠固定（入替可） / 1vs1 & 3vs3(交代制) の叩き台です。
Cloudflare Pages + GitHub でまず静的に公開し、後でCapacitor(Electron)でアプリ/Steam化しやすいように
`src/engine` をUIから分離しています。

## ローカル起動
```bash
npm install
npm run dev
```

## ビルド
```bash
npm run build
npm run preview
```

## Cloudflare Pages
- Build command: `npm run build`
- Output directory: `dist`

## データ
`public/data/*.json` を編集するとコンテンツ追加ができます。

## 実装の入口
- UI: `src/app/App.tsx`
- Engine: `src/engine/battle.ts`
- AI: `src/engine/ai.ts`
