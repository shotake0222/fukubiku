import { createAdminClient } from "@/lib/supabase/admin";
import {
  emptyBlocks,
  resolveDesign,
  resolveSections,
  type PortalBlockKind,
  type PortalData,
  type PortalDesign,
  type PortalNavLink,
  type PortalSection,
  type PortalSnsLink,
  type PortalTemplate,
} from "./types";
import type { AttendPortal, AttendPortalBlock, AttendRally } from "@/lib/types";

/** ラリーの配布用URLを引く。埋め込み用ではなく、必ず単体で開けるURLを使う。 */
async function rallyUrlFor(
  supabase: ReturnType<typeof createAdminClient>,
  rallyId: string,
  origin: string
): Promise<string | null> {
  const { data: link } = await supabase
    .from("attend_rally_links")
    .select("hash")
    .eq("rally_id", rallyId)
    .eq("mode", "standalone")
    .eq("enabled", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (link) return `${origin}/r/${(link as { hash: string }).hash}`;

  const { data: rally } = await supabase
    .from("attend_rallies")
    .select("hash")
    .eq("id", rallyId)
    .maybeSingle();
  return rally ? `${origin}/r/${(rally as Pick<AttendRally, "hash">).hash}` : null;
}

/** JSONB列は何でも入りうるので、描画前に形だけ確かめる */
function asNav(v: unknown): PortalNavLink[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((x): x is PortalNavLink => !!x && typeof x === "object")
    .map((x) => ({ label: String((x as any).label ?? ""), url: String((x as any).url ?? "") }))
    .filter((x) => x.label && x.url);
}

function asSns(v: unknown): PortalSnsLink[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((x): x is PortalSnsLink => !!x && typeof x === "object")
    .map((x) => ({ kind: (x as any).kind, url: String((x as any).url ?? "") }))
    .filter((x) => x.kind && x.url);
}

export function toPortalData(
  p: AttendPortal,
  blockRows: AttendPortalBlock[],
  arUrl: string | null
): PortalData {
  const blocks = emptyBlocks();
  for (const b of blockRows) {
    if (!b.enabled) continue;
    const kind = b.kind as PortalBlockKind;
    if (!blocks[kind]) continue;
    blocks[kind].push({
      id: b.id,
      kind,
      title: b.title,
      body: b.body,
      meta: b.meta,
      imageUrl: b.image_url,
      linkUrl: b.link_url,
      badge: b.badge,
    });
  }

  const template = (p.template as PortalTemplate) ?? "kanko";

  return {
    template,
    design: resolveDesign(template, p.design as Partial<PortalDesign> | null),
    sections: resolveSections(template, p.sections as PortalSection[] | null),
    nav: asNav(p.nav),
    sns: asSns(p.sns),
    status: p.status,
    endedMessage: p.ended_message,
    endedLinkUrl: p.ended_link_url,
    endedLinkLabel: p.ended_link_label,

    brand: p.brand_color || "#0f766e",
    brandDark: p.brand_color_dark || "#115e59",
    accent: p.accent_color || p.brand_color || "#0f766e",
    logoUrl: p.logo_url,
    logoText: p.logo_text,

    siteTitle: p.site_title || "スタンプラリー",
    siteDescription: p.site_description,
    ogImageUrl: p.og_image_url || p.hero_image_url,

    heroImageUrl: p.hero_image_url,
    heroEyebrow: p.hero_eyebrow,
    heroTitle: p.hero_title,
    heroText: p.hero_text,

    arUrl,
    arHeading: p.ar_heading || "スタンプラリーに参加する",
    arText: p.ar_text,
    arButtonLabel: p.ar_button_label || "いますぐ始める",

    statusLine: p.status_line,

    ownerName: p.owner_name,
    ownerAddress: p.owner_address,
    privacyUrl: p.privacy_url,
    termsUrl: p.terms_url,
    contactUrl: p.contact_url,
    copyrightText: p.copyright_text,

    blocks,
  };
}

export async function loadPortal(hash: string, origin: string): Promise<PortalData | null> {
  const supabase = createAdminClient();

  const { data } = await supabase
    .from("attend_portals")
    .select("*")
    .eq("hash", hash)
    .maybeSingle();
  if (!data) return null;
  const portal = data as AttendPortal;

  const { data: blockRows } = await supabase
    .from("attend_portal_blocks")
    .select("*")
    .eq("portal_id", portal.id)
    .order("sort_order", { ascending: true });

  const arUrl = portal.rally_id
    ? await rallyUrlFor(supabase, portal.rally_id, origin)
    : portal.custom_ar_url;

  return toPortalData(portal, (blockRows as AttendPortalBlock[] | null) ?? [], arUrl);
}
