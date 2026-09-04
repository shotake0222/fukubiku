# fukubiku 管理ツール

fukubikiu.attend-ar.com のクライアント提供AR体験を管理するための管理画面です。

- 注文情報の管理（クライアント名・注文日・納期・担当者・個数・延長確認日）
- 表示オブジェクト（3Dモデル）の選択、またはアップロード
- 表示方式（A-Frame / MindAR）の選択
- MindAR選択時は、ターゲット画像をアップロードするとブラウザ上で自動的に `.mind` ファイルへコンパイル
- 注文ごとにハッシュ化されたクライアント提供URL（`/v/[hash]`）を自動発行

## 技術スタック
- Next.js 14 (App Router) + TypeScript + Tailwind CSS
- Supabase（Postgres / Auth / Storage）
- Vercel（ホスティング）
- A-Frame / MindAR（CDN経由でクライアントサイドに読み込み）

## セットアップ手順

### 1. Supabase プロジェクト
1. Supabaseダッシュボード → 該当プロジェクトを開く
2. 左メニュー「SQL Editor」で `supabase/schema.sql` の内容を貼り付けて実行
   - `orders` / `preset_objects` テーブル、`assets` ストレージバケット、RLSポリシーが作成されます
3. 「Authentication → Users」で管理者用アカウントを作成（メール／パスワード）
   - このアカウントで管理画面 (`/admin`) にログインします
4. 「Project Settings → API」から以下を控える
   - Project URL
   - `anon` public key
   - `service_role` key（絶対に公開しないこと）

### 2. 環境変数
`.env.local.example` を `.env.local` にコピーして値を入力（ローカル開発用）。

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
NEXT_PUBLIC_SITE_URL=https://fukubikiu.attend-ar.com
```

Vercelプロジェクト（fukubiku）の Settings → Environment Variables にも同じ値を登録してください。

### 3. ローカル動作確認
```
npm install
npm run dev
```
`http://localhost:3000/admin` にアクセスし、Supabaseで作成した管理者アカウントでログイン。

### 4. デプロイ
GitHubリポジトリへ push すると、Vercelが自動でビルド・デプロイします。

```
git add -A
git commit -m "feat: 管理画面・URL発行ツールを追加"
git push origin main
```

### 5. 表示オブジェクト（プリセット）の登録
管理画面の「オブジェクト管理」から、`.glb` 形式の3Dモデルとサムネイル画像を登録しておくと、
注文編集画面のプルダウンから選択できるようになります。

## 使い方の流れ
1. 「新規注文」で注文情報（クライアント名・注文日・納期・担当者・個数・延長確認日）を入力して保存
2. 遷移先の注文編集画面で「表示方式」（A-Frame / MindAR）を選択
3. 「表示オブジェクト」をプリセットから選ぶか、独自の3Dモデル(.glb)をアップロード
4. MindARを選んだ場合は、クライアント提供の画像をアップロード → 自動でコンパイルされ `.mind` ファイルが生成される
5. 「保存」を押すと、必要な情報が揃っていれば状態が「公開準備完了」になり、ページ下部にクライアント提供URL（`https://fukubikiu.attend-ar.com/v/xxxxxxxxxx`）が表示される
6. そのURLをクライアントに共有すればAR体験を閲覧可能
