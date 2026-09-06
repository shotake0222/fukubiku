import { notFound } from "next/navigation";
import RallyApp from "@/components/RallyApp";
import { loadRallyMeta, loadRallyView } from "@/lib/rallyView";

export const dynamic = "force-dynamic";

// 他サイトのiframeに埋め込むための入口。
// 中身は /r/[hash] と同じコンポーネントで、mode="embed" として
// 「詰めた表示」「親ページへの高さ通知」「ARは別タブ」に切り替わる。
export async function generateMetadata({ params }: { params: { hash: string } }) {
  const meta = await loadRallyMeta(params.hash);
  return {
    title: meta?.name ?? "スタンプラリー",
    // 埋め込み用URLが検索結果に単体で出ても意味がないので拾わせない。
    robots: { index: false, follow: false },
  };
}

export default async function RallyEmbedPage({
  params,
  searchParams,
}: {
  params: { hash: string };
  searchParams: { s?: string; n?: string };
}) {
  const loaded = await loadRallyView(params.hash);
  if (!loaded) notFound();

  const landingCode = searchParams.s || searchParams.n || null;
  const landingVia = searchParams.n ? ("nfc" as const) : ("qr" as const);

  return (
    <RallyApp
      rally={{ ...loaded.rally, mode: "embed" }}
      spots={loaded.spots}
      landingCode={landingCode}
      landingVia={landingVia}
    />
  );
}
