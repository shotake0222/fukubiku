/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: { ignoreDuringBuilds: true },

  // キャッシュの方針。
  //
  // 「端末によって見える／見えない」「そのうち見えなくなる」の原因のひとつが
  // キャッシュなので、配信するものを性質で3つに分けて明示的に指定する。
  // (ホスティング側の既定に任せると、環境が変わったときに黙って挙動が変わる)
  async headers() {
    return [
      {
        // ライブラリ類。ファイル名にバージョンが入っていて中身が変わらないので、
        // 1年間そのまま使い回してよい(immutable)。
        // 更新するときはファイル名ごと変えるので、取り違えは起きない。
        source: "/vendor/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
      {
        // 自前のARスクリプト。中身を直すことがあるので、常にサーバーへ確認しにいく。
        // (304が返れば実体は再ダウンロードされないので、体感速度はほぼ変わらない)
        source: "/ar/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=0, must-revalidate" }],
      },
      {
        // テンプレート素材(.glb/.mp4/.png)。ファイル名は同じまま差し替える運用が
        // ありうるため、必ずサーバーへ確認しにいく。壊れた応答が端末に居座って
        // 「その端末だけ出ない」状態になるのを防ぐ方を優先する。
        source: "/presets/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=0, must-revalidate" }],
      },
      {
        // ARマーカー。同上。
        source: "/markers/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=0, must-revalidate" }],
      },
    ];
  },
};
module.exports = nextConfig;
