import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * 埋め込み用URLの配信元制限。
 *
 * 何も設定していなければブラウザ既定どおり誰でも埋め込める（ヘッダを出さない）。
 * 管理画面で配信元を指定した時だけ frame-ancestors を出して、そのサイト以外の
 * iframeでは表示されないようにする。取得に失敗した時は制限しない側に倒す
 * （DBが一時的に見えないだけで、正規の埋め込み先まで真っ白にしないため）。
 */
async function embedResponse(request: NextRequest): Promise<NextResponse> {
  const response = NextResponse.next({ request });
  const hash = request.nextUrl.pathname.split("/")[2];
  if (!hash) return response;

  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !key) return response;

  try {
    const res = await fetch(
      `${base}/rest/v1/attend_rally_links?select=allowed_origins&hash=eq.${encodeURIComponent(hash)}`,
      { headers: { apikey: key, Authorization: `Bearer ${key}` }, cache: "no-store" }
    );
    if (!res.ok) return response;
    const rows = (await res.json()) as { allowed_origins: string | null }[];
    const raw = rows[0]?.allowed_origins?.trim();
    if (!raw) return response;

    const origins = raw
      .split(",")
      .map((o) => o.trim())
      .filter(Boolean);
    if (origins.length === 0) return response;

    response.headers.set("Content-Security-Policy", `frame-ancestors 'self' ${origins.join(" ")}`);
  } catch {
    // ネットワークエラー時は制限しない
  }
  return response;
}

export async function middleware(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith("/embed/")) {
    return embedResponse(request);
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isLoginPage = path === "/admin/login";
  // パスワード再設定リンクは、まだログインセッションが無い状態でアクセスされるのが
  // 正常なケースのため、ログインページと同様に認証チェックの対象外にする。
  // (このページ自体は、Supabaseのリカバリー用コード/トークンを検証できた場合に
  // 限りパスワード変更フォームを表示するので、これ自体が保護対象のデータを
  // 表示するわけではない)
  const isResetPasswordPage = path === "/admin/reset-password";
  const isAdminPath = path.startsWith("/admin");

  if (isAdminPath && !isLoginPage && !isResetPasswordPage && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/admin/login";
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }

  if (isLoginPage && user) {
    const url = request.nextUrl.clone();
    url.pathname = "/admin";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ["/admin/:path*", "/embed/:path*"],
};
