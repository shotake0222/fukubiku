# Straid 運用管理システム

Straid合同会社の2サービス（fukubiku / あてんど）のクライアント提供AR体験を、
1つの管理画面から運用するためのツールです。`/admin` にログインすると、サービス
選択画面からそれぞれの管理画面に入れます。

## サービス構成

| サービス | 管理画面 | クライアント提供URL | ドメイン |
| --- | --- | --- | --- |
| fukubiku（福引AR） | `/admin/fukubiku/*` | `/v/[hash]` | app.fukubikiu.com |
| あてんど（XRコンテンツ配信） | `/admin/attend/*` | `/a/[hash]` | app.attend-ar.com |

オブジェクト管理（表示オブジェクトのテンプレートライブラリ、`/admin/presets`）は
両サービス共通のページです。各プリセットに「fukubiku専用 / あてんど専用 / 共通」
のタグを付けられ、各サービスの編集画面には対応するプリセットのみ表示されます。

### fukubiku
- 注文情報の管理（クライアント名・注文日・納期・担当者・個数・延長確認日）
- 表示オブジェクト（3Dモデル/動画/GIF）の選択、またはアップロード
- 表示方式（A-Frame / MindAR）の選択
- MindAR選択時は、ターゲット画像をアップロードするとブラウザ上で自動的に `.mind` ファイルへコンパイル
- 注文ごとにハッシュ化されたクライアント提供URL（`/v/[hash]`）を自動発行
- 景品セット（当たり/外れ/1等/2等など）をまとめて一括作成する機能あり

### あてんど
- 案件（クライアント単位）と、その下に複数の体験（拠点・シーン単位）を管理
- 体験ごとにARモードを選択: A-Frame（マーカー）/ MindAR画像認識 / MindAR顔認識 / GPS位置トリガー
- プラン（ライト/スタンダード/エンタープライズ）の目安を表示（強制制限なし）
- NFCタグの発注枚数・使用済み枚数の進捗管理
- 体験ごとにハッシュ化されたクライアント提供URL（`/a/[hash]`）を自動発行

## 技術スタック
- Next.js 14 (App Router) + TypeScript + Tailwind CSS
- Supabase（Postgres / Auth / Storage）
- Vercel（ホスティング、1つのデプロイに2つの独自ドメインを割り当て）
- A-Frame / AR.js（マーカー・GPS）/ MindAR（画像認識・顔認識）を、CDNまたは自前ホスティングでクライアントサイドに読み込み

## セットアップ手順

### 1. Supabase プロジェクト
1. Supabaseダッシュボード → 該当プロジェクトを開く
2. 「SQL Editor」で `supabase/schema.sql`（fukubiku）→ `supabase/schema_attend.sql`（あてんど）の順に貼り付けて実行
   - `orders` / `preset_objects` / `attend_projects` / `attend_experiences` テーブル、`assets` ストレージバケット、RLSポリシーが作成されます
3. 「Authentication → Users」で管理者用アカウントを作成（メール／パスワード）
   - このアカウントで管理画面 (`/admin`) にログインします（fukubiku・あてんど共通ログイン）
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
NEXT_PUBLIC_SITE_URL=https://app.fukubikiu.com
NEXT_PUBLIC_ATTEND_SITE_URL=https://app.attend-ar.com
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

### 5. ドメイン設定（app.attend-ar.com を追加する場合）
このプロジェクトは1つのVercelデプロイで2つのドメインを提供します（パスで
サービスを判別しているため、どちらのドメインでアクセスしても同じアプリが動きます）。

1. Vercelダッシュボード → 対象プロジェクト → Settings → Domains
2. 「Add」で `app.attend-ar.com` を追加
3. Vercelが指示するDNSレコード（通常はCNAME → `cname.vercel-dns.com`、ルート直下なら
   ALIAS/Aレコード）を、attend-ar.com を管理しているDNS（Route53やお名前.comなど）に追加
4. DNS反映後、Vercel側で「Valid Configuration」になれば完了
5. 環境変数 `NEXT_PUBLIC_ATTEND_SITE_URL=https://app.attend-ar.com` をVercelにも設定して再デプロイ
   （あてんどの管理画面に表示されるクライアント提供URLがこのドメインで表示されるようになります）

`app.fukubikiu.com` 側は従来どおりで変更不要です。

### 6. 表示オブジェクト（プリセット）の登録
管理画面の「オブジェクト管理」から、動画(.mp4)/GIF/画像/`.glb`形式の3Dモデルと
サムネイル画像を登録しておくと、各サービスの編集画面のプルダウンから選択できる
ようになります。登録時に「利用サービス」を指定すると、片方のサービスの編集画面
にのみ表示されます（未指定は両サービス共通）。

## 使い方の流れ（fukubiku）
1. 「新規注文」で注文情報を入力して保存
2. 遷移先の注文編集画面で「表示方式」（A-Frame / MindAR）を選択
3. 「表示オブジェクト」をプリセットから選ぶか、独自ファイルをアップロード
4. MindARを選んだ場合は、クライアント提供の画像をアップロード → 自動でコンパイルされ `.mind` ファイルが生成される
5. 「保存」を押すと、必要な情報が揃っていれば状態が「公開準備完了」になり、クライアント提供URL（`https://app.fukubikiu.com/v/xxxxxxxxxx`）が表示される
6. そのURLをクライアントに共有すればAR体験を閲覧可能

## 使い方の流れ（あてんど）
1. 「新規案件」でクライアント情報・プラン・NFCタグ発注枚数を入力して保存
2. 案件編集画面で「+ 体験を追加」して拠点・シーンごとの体験を作成
3. 体験編集画面でARモード（A-Frame / MindAR画像認識 / MindAR顔認識 / GPS）を選択し、
   モードに応じたマーカー画像・ターゲット画像・顔アンカー・GPS座標を設定
4. 表示オブジェクトをプリセットから選ぶか、独自ファイルをアップロード
5. 「保存」で状態が「公開準備完了」になり、クライアント提供URL（`https://app.attend-ar.com/a/xxxxxxxxxx`）が表示される
6. 案件編集画面でNFCタグの使用済み枚数を随時更新して進捗管理
