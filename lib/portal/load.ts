import { createAdminClient } from "@/lib/supabase/admin";
import { emptyBlocks, type PortalBlockKind, type PortalData, type PortalTemplate } from "./types";
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

  return {
    template: (p.template as PortalTemplate) ?? "kanko",
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
