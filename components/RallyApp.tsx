"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { distanceMeters, formatDistance } from "@/lib/rally";
import type { AttendRallyTheme, AttendStampMethod } from "@/lib/types";
import RallyStampScene from "./RallyStampScene";

export interface RallySpotView {
  id: string;
  name: string;
  description: string | null;
  gpsEnabled: boolean;
  lat: number | null;
  lng: number | null;
  radiusM: number;
  codeEnabled: boolean;
  modelUrl: string | null;
  position: string;
  scale: string | null;
  rotationY: number;
  stampLabel: string;
  stampColor: string;
}

export interface RallyView {
  hash: string;
  name: string;
  description: string | null;
  theme: AttendRallyTheme;
  totalCount: number;
  requiredCount: number;
  active: boolean;
  statusReason: string | null;
  endsAt: string | null;
  couponEnabled: boolean;
  couponLabel: string;
  couponNote: string | null;
  rewardModelUrl: string | null;
  rewardMessage: string;
}

interface StampState {
  spotId: string;
  method: AttendStampMethod;
  createdAt: string;
}

interface RallyState {
  participantId: string;
  restoreCode: string;
  stamps: StampState[];
  completed: boolean;
  coupon: { code: string; issuedAt: string; redeemedAt: string | null } | null;
}

// 参加者画面の配色。案件の雰囲気に合わせて管理画面から選ぶ。
const THEMES: Record<
  AttendRallyTheme,
  { bg: string; panel: string; ink: string; sub: string; accent: string; onAccent: string; line: string }
> = {
  washi: {
    bg: "#f3ede0",
    panel: "#fffdf6",
    ink: "#33291f",
    sub: "#8a7a66",
    accent: "#b03a2e",
    onAccent: "#fffaf2",
    line: "#e2d7c3",
  },
  night: {
    bg: "#101627",
    panel: "#1b2338",
    ink: "#eef2fb",
    sub: "#9aa6c4",
    accent: "#f0b429",
    onAccent: "#1b2338",
    line: "#2c3550",
  },
  pop: {
    bg: "#fff4ec",
    panel: "#ffffff",
    ink: "#23304a",
    sub: "#7b89a5",
    accent: "#ff5c72",
    onAccent: "#ffffff",
    line: "#ffe0d4",
  },
};

const METHOD_LABEL: Record<AttendStampMethod, string> = {
  gps: "現地で取得",
  qr: "QRで取得",
  nfc: "NFCで取得",
  code: "合言葉で取得",
  manual: "運営から付与",
};

type Screen = "book" | "spot" | "celebrate" | "complete";

export default function RallyApp({
  rally,
  spots,
  landingCode,
  landingVia,
}: {
  rally: RallyView;
  spots: RallySpotView[];
  landingCode: string | null;
  landingVia: "qr" | "nfc";
}) {
  const t = THEMES[rally.theme] ?? THEMES.washi;

  const [state, setState] = useState<RallyState | null>(null);
  const [screen, setScreen] = useState<Screen>("book");
  const [activeSpotId, setActiveSpotId] = useState<string | null>(null);
  const [celebrateSpotId, setCelebrateSpotId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showCodeInput, setShowCodeInput] = useState(false);
  const [showRestore, setShowRestore] = useState(false);
  const [codeInput, setCodeInput] = useState("");
  const [restoreInput, setRestoreInput] = useState("");

  const [pos, setPos] = useState<GeolocationPosition | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);

  const stampedIds = useMemo(
    () => new Set((state?.stamps ?? []).map((s) => s.spotId)),
    [state]
  );
  const stampCount = state?.stamps.length ?? 0;
  const activeSpot = spots.find((s) => s.id === activeSpotId) ?? null;
  const celebrateSpot = spots.find((s) => s.id === celebrateSpotId) ?? null;

  const post = useCallback(
    async (path: string, body?: unknown) => {
      const res = await fetch(`/api/rally/${rally.hash}/${path}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body ?? {}),
      });
      const data = await res.json().catch(() => ({}));
      return { ok: res.ok, status: res.status, data } as {
        ok: boolean;
        status: number;
        data: any;
      };
    },
    [rally.hash]
  );

  // 開いた時点で匿名参加者を作る（登録不要で始められるようにするため）。
  const landingHandled = useRef(false);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { ok, data } = await post("join");
      if (cancelled || !ok) return;
      setState(data as RallyState);

      // QR/NFCから開いた場合は、その場でスタンプを押しに行く。
      if (landingCode && !landingHandled.current) {
        landingHandled.current = true;
        await grantByCode(landingCode, landingVia);
        // URLに合言葉が残ったままだと、再読み込みのたびに同じ処理が走り、
        // 他人に画面を見せた時にコードも見えてしまうので消しておく。
        if (typeof window !== "undefined") {
          window.history.replaceState(null, "", `/r/${rally.hash}`);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 現在地は常時見張っておき、スタンプ帳に「あと◯m」を出す。
  useEffect(() => {
    if (!spots.some((s) => s.gpsEnabled)) return;
    if (!navigator.geolocation) {
      setGeoError("この端末では位置情報を取得できません");
      return;
    }
    const id = navigator.geolocation.watchPosition(
      (p) => {
        setGeoError(null);
        setPos(p);
      },
      (e) => {
        setGeoError(
          e.code === e.PERMISSION_DENIED
            ? "位置情報が許可されていません。設定から許可すると、近づくだけでスタンプが押せます。"
            : "位置情報を取得できませんでした"
        );
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 }
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [spots]);

  function distanceTo(spot: RallySpotView): number | null {
    if (!pos || !spot.gpsEnabled || spot.lat == null || spot.lng == null) return null;
    return distanceMeters(pos.coords.latitude, pos.coords.longitude, spot.lat, spot.lng);
  }

  function withinRadius(spot: RallySpotView): boolean {
    const d = distanceTo(spot);
    if (d == null || !pos) return false;
    return d <= spot.radiusM + Math.min(pos.coords.accuracy || 0, 30);
  }

  const applyResult = useCallback(
    (data: any, spotId: string | null) => {
      setState(data as RallyState);
      if (data.granted && spotId) {
        setCelebrateSpotId(spotId);
        setScreen("celebrate");
      } else if (data.already) {
        setMessage("このスポットのスタンプは取得済みです");
      }
    },
    []
  );

  async function grantByCode(code: string, via: AttendStampMethod = "code") {
    setBusy(true);
    const { ok, status, data } = await post("stamp", { code, via });
    setBusy(false);
    if (!ok) {
      setMessage(
        status === 404
          ? "そのコードのスポットが見つかりませんでした"
          : data?.error === "not_active"
            ? "このスタンプラリーはまだ公開されていません"
            : data?.error === "out_of_period"
              ? "開催期間外です"
              : "スタンプを取得できませんでした"
      );
      return;
    }
    setShowCodeInput(false);
    setCodeInput("");
    applyResult(data, data.spotId ?? null);
  }

  // GPSスポットは、圏内に入った瞬間に自動で押す。
  // 連打・多重送信を避けるため、送信中のスポットを ref で覚えておく。
  const pendingRef = useRef<Set<string>>(new Set());
  const grantByGps = useCallback(
    async (spot: RallySpotView) => {
      if (!pos || pendingRef.current.has(spot.id)) return;
      pendingRef.current.add(spot.id);
      const { ok, data } = await post("stamp", {
        spotId: spot.id,
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
      });
      pendingRef.current.delete(spot.id);
      if (!ok) {
        if (data?.error === "too_far") {
          setMessage(`もう少し近づいてください（あと約${data.distance - data.radius}m）`);
        }
        return;
      }
      applyResult(data, spot.id);
    },
    [pos, post, applyResult]
  );

  // 圏内に入ったスポットは、スタンプ帳を開いたままでも自動で押す。
  // 「その場所に着いたら押される」のがスタンプラリーの体験なので、
  // 目的地を選び直させない（演出中は割り込まない）。
  useEffect(() => {
    if (!rally.active || !pos) return;
    if (screen !== "book" && screen !== "spot") return;
    const target = spots.find((s) => !stampedIds.has(s.id) && withinRadius(s));
    if (target) grantByGps(target);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen, pos, stampedIds, rally.active]);

  async function handleRestore() {
    setBusy(true);
    const { ok, data } = await post("restore", { code: restoreInput });
    setBusy(false);
    if (!ok) {
      setMessage("その引き継ぎコードは見つかりませんでした");
      return;
    }
    setState(data as RallyState);
    setShowRestore(false);
    setRestoreInput("");
    setMessage("スタンプ帳を引き継ぎました");
  }

  useEffect(() => {
    if (!message) return;
    const id = setTimeout(() => setMessage(null), 3200);
    return () => clearTimeout(id);
  }, [message]);

  // ---- 画面 ----

  if (screen === "celebrate" && celebrateSpot) {
    return (
      <RallyStampScene
        modelUrl={celebrateSpot.modelUrl}
        position={celebrateSpot.position}
        scale={celebrateSpot.scale}
        rotationY={celebrateSpot.rotationY}
      >
        <StampGetOverlay
          spot={celebrateSpot}
          count={stampCount}
          total={rally.totalCount}
          completed={!!state?.completed}
          onClose={() => {
            setCelebrateSpotId(null);
            setScreen(state?.completed ? "complete" : "book");
          }}
        />
      </RallyStampScene>
    );
  }

  if (screen === "spot" && activeSpot) {
    return (
      <SpotScreen
        theme={t}
        spot={activeSpot}
        distance={distanceTo(activeSpot)}
        accuracy={pos?.coords.accuracy ?? null}
        geoError={geoError}
        stamped={stampedIds.has(activeSpot.id)}
        onBack={() => {
          setActiveSpotId(null);
          setScreen("book");
        }}
        onOpenCode={() => setShowCodeInput(true)}
      />
    );
  }

  if (screen === "complete") {
    return (
      <CompleteScreen
        theme={t}
        rally={rally}
        spots={spots}
        state={state}
        onBack={() => setScreen("book")}
      />
    );
  }

  return (
    <div className="min-h-screen" style={{ background: t.bg, color: t.ink }}>
      <div className="mx-auto max-w-md px-5 pb-28 pt-8">
        <header className="space-y-2">
          <p className="text-xs tracking-[0.3em]" style={{ color: t.sub }}>
            STAMP RALLY
          </p>
          <h1 className="text-2xl font-bold leading-snug">{rally.name}</h1>
          {rally.description && (
            <p className="text-sm leading-relaxed" style={{ color: t.sub }}>
              {rally.description}
            </p>
          )}
        </header>

        {!rally.active && rally.statusReason && (
          <p
            className="mt-5 rounded-xl px-4 py-3 text-sm"
            style={{ background: t.panel, color: t.sub, border: `1px solid ${t.line}` }}
          >
            {rally.statusReason}
          </p>
        )}

        <ProgressBar theme={t} count={stampCount} required={rally.requiredCount} />

        <section
          className="mt-6 rounded-2xl p-5"
          style={{ background: t.panel, border: `1px solid ${t.line}` }}
        >
          <div className="grid grid-cols-3 gap-4">
            {spots.map((spot, i) => (
              <StampSlot
                key={spot.id}
                theme={t}
                spot={spot}
                index={i}
                stamped={stampedIds.has(spot.id)}
              />
            ))}
          </div>
        </section>

        {state?.completed && (
          <button
            onClick={() => setScreen("complete")}
            className="mt-5 w-full rounded-xl py-3.5 text-sm font-bold"
            style={{ background: t.accent, color: t.onAccent }}
          >
            コンプリート特典を見る
          </button>
        )}

        <h2 className="mt-8 mb-3 text-sm font-bold" style={{ color: t.sub }}>
          スポット一覧
        </h2>
        <ul className="space-y-3">
          {spots.map((spot, i) => {
            const stamped = stampedIds.has(spot.id);
            const d = distanceTo(spot);
            return (
              <li
                key={spot.id}
                className="rounded-2xl p-4"
                style={{
                  background: t.panel,
                  border: `1px solid ${t.line}`,
                  opacity: stamped ? 0.72 : 1,
                }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[11px]" style={{ color: t.sub }}>
                      SPOT {String(i + 1).padStart(2, "0")}
                    </p>
                    <p className="truncate font-bold">{spot.name}</p>
                    {spot.description && (
                      <p className="mt-1 text-xs leading-relaxed" style={{ color: t.sub }}>
                        {spot.description}
                      </p>
                    )}
                  </div>
                  {stamped ? (
                    <span
                      className="shrink-0 rounded-full px-3 py-1 text-[11px] font-bold"
                      style={{ background: spot.stampColor, color: "#fff" }}
                    >
                      取得済
                    </span>
                  ) : d != null ? (
                    <span
                      className="shrink-0 rounded-full px-3 py-1 text-[11px]"
                      style={{ background: t.bg, color: t.sub }}
                    >
                      あと {formatDistance(d)}
                    </span>
                  ) : null}
                </div>

                {!stamped && rally.active && (
                  <div className="mt-3 flex gap-2">
                    {spot.gpsEnabled && (
                      <button
                        onClick={() => {
                          setActiveSpotId(spot.id);
                          setScreen("spot");
                        }}
                        className="flex-1 rounded-lg py-2 text-xs font-bold"
                        style={{ background: t.accent, color: t.onAccent }}
                      >
                        現地へ向かう
                      </button>
                    )}
                    {spot.codeEnabled && (
                      <button
                        onClick={() => setShowCodeInput(true)}
                        className="flex-1 rounded-lg py-2 text-xs font-bold"
                        style={{ background: t.bg, color: t.ink, border: `1px solid ${t.line}` }}
                      >
                        合言葉を入力
                      </button>
                    )}
                  </div>
                )}
              </li>
            );
          })}
          {spots.length === 0 && (
            <li className="py-10 text-center text-sm" style={{ color: t.sub }}>
              スポットの準備中です
            </li>
          )}
        </ul>

        {geoError && (
          <p className="mt-5 text-xs leading-relaxed" style={{ color: t.sub }}>
            {geoError}
          </p>
        )}

        <div className="mt-8 flex justify-center gap-4 text-xs" style={{ color: t.sub }}>
          <button onClick={() => setShowCodeInput(true)} className="underline underline-offset-4">
            合言葉を入力
          </button>
          <button onClick={() => setShowRestore(true)} className="underline underline-offset-4">
            機種変更の引き継ぎ
          </button>
        </div>

        {state?.restoreCode && (
          <p className="mt-3 text-center text-[11px]" style={{ color: t.sub }}>
            あなたの引き継ぎコード: <span className="font-mono tracking-widest">{state.restoreCode}</span>
          </p>
        )}
      </div>

      {message && (
        <div className="fixed inset-x-0 bottom-6 z-40 flex justify-center px-6">
          <p
            className="rounded-full px-5 py-2.5 text-sm shadow-lg"
            style={{ background: t.ink, color: t.bg }}
          >
            {message}
          </p>
        </div>
      )}

      {showCodeInput && (
        <Sheet theme={t} title="合言葉を入力" onClose={() => setShowCodeInput(false)}>
          <p className="text-xs leading-relaxed" style={{ color: t.sub }}>
            スタンプ台に掲示されている合言葉を入力してください。
            QRコードやNFCタグからでも同じスタンプが押せます。
          </p>
          <input
            value={codeInput}
            onChange={(e) => setCodeInput(e.target.value)}
            autoCapitalize="characters"
            autoComplete="off"
            placeholder="例: 7KDM2"
            className="mt-4 w-full rounded-xl px-4 py-3 text-center font-mono text-lg tracking-[0.3em]"
            style={{ background: t.bg, color: t.ink, border: `1px solid ${t.line}` }}
          />
          <button
            disabled={busy || !codeInput.trim()}
            onClick={() => grantByCode(codeInput)}
            className="mt-4 w-full rounded-xl py-3.5 text-sm font-bold disabled:opacity-40"
            style={{ background: t.accent, color: t.onAccent }}
          >
            {busy ? "確認中..." : "スタンプを押す"}
          </button>
        </Sheet>
      )}

      {showRestore && (
        <Sheet theme={t} title="機種変更の引き継ぎ" onClose={() => setShowRestore(false)}>
          <p className="text-xs leading-relaxed" style={{ color: t.sub }}>
            以前の端末に表示されていた引き継ぎコードを入力すると、
            集めたスタンプをこの端末に引き戻せます。
          </p>
          <input
            value={restoreInput}
            onChange={(e) => setRestoreInput(e.target.value)}
            autoCapitalize="characters"
            autoComplete="off"
            placeholder="例: 7KDM2XVA"
            className="mt-4 w-full rounded-xl px-4 py-3 text-center font-mono text-lg tracking-[0.3em]"
            style={{ background: t.bg, color: t.ink, border: `1px solid ${t.line}` }}
          />
          <button
            disabled={busy || !restoreInput.trim()}
            onClick={handleRestore}
            className="mt-4 w-full rounded-xl py-3.5 text-sm font-bold disabled:opacity-40"
            style={{ background: t.accent, color: t.onAccent }}
          >
            {busy ? "確認中..." : "引き継ぐ"}
          </button>
        </Sheet>
      )}
    </div>
  );
}

type Theme = (typeof THEMES)[AttendRallyTheme];

function ProgressBar({ theme, count, required }: { theme: Theme; count: number; required: number }) {
  const pct = required > 0 ? Math.min(100, Math.round((count / required) * 100)) : 0;
  return (
    <div className="mt-6">
      <div className="flex items-baseline justify-between">
        <span className="text-sm" style={{ color: theme.sub }}>
          集めたスタンプ
        </span>
        <span className="font-bold">
          <span className="text-3xl">{count}</span>
          <span className="text-sm" style={{ color: theme.sub }}>
            {" "}
            / {required}
          </span>
        </span>
      </div>
      <div className="mt-2 h-2 w-full overflow-hidden rounded-full" style={{ background: theme.line }}>
        <div
          className="h-2 rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, background: theme.accent }}
        />
      </div>
    </div>
  );
}

// スタンプ帳の升目。押してあるものは、朱肉で押した印のように少し傾けて重ねる。
function StampSlot({
  theme,
  spot,
  index,
  stamped,
}: {
  theme: Theme;
  spot: RallySpotView;
  index: number;
  stamped: boolean;
}) {
  // 傾きは升目ごとに固定（毎回変わると「押し直された」ように見えるため）。
  const tilt = ((index * 37) % 17) - 8;
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div
        className="relative flex h-20 w-20 items-center justify-center rounded-full"
        style={{
          border: stamped ? "none" : `2px dashed ${theme.line}`,
          background: stamped ? "transparent" : theme.bg,
        }}
      >
        {stamped ? (
          <div
            className="flex h-full w-full items-center justify-center rounded-full"
            style={{
              transform: `rotate(${tilt}deg)`,
              border: `3px solid ${spot.stampColor}`,
              color: spot.stampColor,
              background: "transparent",
              boxShadow: `inset 0 0 0 2px ${spot.stampColor}22`,
            }}
          >
            <span className="px-1 text-center text-[15px] font-black leading-tight">
              {spot.stampLabel}
            </span>
          </div>
        ) : (
          <span className="text-lg font-bold" style={{ color: theme.line }}>
            {index + 1}
          </span>
        )}
      </div>
      <span className="w-full truncate text-center text-[10px]" style={{ color: theme.sub }}>
        {spot.name}
      </span>
    </div>
  );
}

function Sheet({
  theme,
  title,
  children,
  onClose,
}: {
  theme: Theme;
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 px-4 pb-4">
      <div className="w-full max-w-md rounded-3xl p-6" style={{ background: theme.panel, color: theme.ink }}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-bold">{title}</h3>
          <button onClick={onClose} className="text-sm" style={{ color: theme.sub }}>
            閉じる
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// 現地へ向かっている間の画面。圏内に入ると自動でスタンプが押される。
function SpotScreen({
  theme,
  spot,
  distance,
  accuracy,
  geoError,
  stamped,
  onBack,
  onOpenCode,
}: {
  theme: Theme;
  spot: RallySpotView;
  distance: number | null;
  accuracy: number | null;
  geoError: string | null;
  stamped: boolean;
  onBack: () => void;
  onOpenCode: () => void;
}) {
  return (
    <div className="min-h-screen px-6 py-8" style={{ background: theme.bg, color: theme.ink }}>
      <button onClick={onBack} className="text-sm" style={{ color: theme.sub }}>
        ← スタンプ帳へ戻る
      </button>

      <div className="mx-auto mt-16 max-w-sm text-center">
        <p className="text-xs tracking-[0.3em]" style={{ color: theme.sub }}>
          NEXT SPOT
        </p>
        <h2 className="mt-2 text-2xl font-bold">{spot.name}</h2>
        {spot.description && (
          <p className="mt-2 text-sm leading-relaxed" style={{ color: theme.sub }}>
            {spot.description}
          </p>
        )}

        <div className="mt-12">
          {stamped ? (
            <p className="text-lg font-bold" style={{ color: spot.stampColor }}>
              このスポットは取得済みです
            </p>
          ) : distance == null ? (
            <p className="text-lg">現在地を確認しています...</p>
          ) : (
            <>
              <p className="text-5xl font-bold tracking-tight">あと {formatDistance(distance)}</p>
              <p className="mt-3 text-sm" style={{ color: theme.sub }}>
                半径{spot.radiusM}m まで近づくと、自動でスタンプが押されます
              </p>
              {accuracy != null && accuracy > 50 && (
                <p className="mt-2 text-xs" style={{ color: theme.sub }}>
                  測位の精度が粗い状態です（誤差 約{Math.round(accuracy)}m）。
                  屋外や見晴らしの良い場所だと安定します。
                </p>
              )}
            </>
          )}
        </div>

        {geoError && (
          <p className="mt-8 text-sm leading-relaxed" style={{ color: theme.accent }}>
            {geoError}
          </p>
        )}

        {spot.codeEnabled && !stamped && (
          <button
            onClick={onOpenCode}
            className="mt-12 w-full rounded-xl py-3 text-sm"
            style={{ background: theme.panel, color: theme.ink, border: `1px solid ${theme.line}` }}
          >
            うまく反応しないときは合言葉を入力
          </button>
        )}
      </div>
    </div>
  );
}

// スタンプ獲得時にAR映像の上へ重ねる演出。
function StampGetOverlay({
  spot,
  count,
  total,
  completed,
  onClose,
}: {
  spot: RallySpotView;
  count: number;
  total: number;
  completed: boolean;
  onClose: () => void;
}) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-between px-6 py-10 text-white">
      <div className="text-center">
        <p className="text-xs tracking-[0.4em] text-white/70">STAMP GET</p>
        <h2 className="mt-2 text-3xl font-black drop-shadow-lg">{spot.name}</h2>
      </div>

      <div
        className="flex h-32 w-32 animate-[stampIn_500ms_ease-out] items-center justify-center rounded-full"
        style={{
          border: `5px solid ${spot.stampColor}`,
          color: spot.stampColor,
          background: "rgba(255,255,255,0.9)",
        }}
      >
        <span className="px-2 text-center text-2xl font-black leading-tight">{spot.stampLabel}</span>
      </div>

      <div className="pointer-events-auto w-full max-w-sm space-y-3 text-center">
        <p className="text-lg font-bold drop-shadow">
          {count} / {total} 個
        </p>
        <button
          onClick={onClose}
          className="w-full rounded-xl bg-white py-3.5 text-sm font-bold text-slate-900"
        >
          {completed ? "コンプリート特典へ" : "スタンプ帳へ戻る"}
        </button>
      </div>

      <style>{`@keyframes stampIn {
        0% { transform: scale(2.4) rotate(-14deg); opacity: 0; }
        60% { transform: scale(0.92) rotate(-6deg); opacity: 1; }
        100% { transform: scale(1) rotate(-6deg); opacity: 1; }
      }`}</style>
    </div>
  );
}

// ---- コンプリート画面 ----

const CARD_W = 1080;
const CARD_H = 1350;
const CARD_FONT = '"Hiragino Sans", "Hiragino Kaku Gothic ProN", "Noto Sans JP", "Yu Gothic", sans-serif';

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  // 日本語は単語区切りが無いので1文字ずつ詰めて折り返す。
  const lines: string[] = [];
  let line = "";
  for (const ch of Array.from(text)) {
    if (ch === "\n") {
      lines.push(line);
      line = "";
      continue;
    }
    const next = line + ch;
    if (ctx.measureText(next).width > maxWidth && line) {
      lines.push(line);
      line = ch;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/** シェア用の記念カードを描く。スタンプ帳の見た目をそのまま1枚絵にする。 */
function drawMemorialCard(
  canvas: HTMLCanvasElement,
  opts: { theme: Theme; title: string; spots: RallySpotView[]; stampedIds: Set<string>; couponCode: string | null }
) {
  const { theme, title, spots, stampedIds, couponCode } = opts;
  canvas.width = CARD_W;
  canvas.height = CARD_H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  ctx.fillStyle = theme.bg;
  ctx.fillRect(0, 0, CARD_W, CARD_H);

  // 内側の枠（賞状のような余白の取り方にする）
  ctx.strokeStyle = theme.line;
  ctx.lineWidth = 4;
  ctx.strokeRect(48, 48, CARD_W - 96, CARD_H - 96);

  ctx.textAlign = "center";
  ctx.fillStyle = theme.sub;
  ctx.font = `500 32px ${CARD_FONT}`;
  ctx.fillText("C O M P L E T E", CARD_W / 2, 176);

  ctx.fillStyle = theme.ink;
  ctx.font = `bold 62px ${CARD_FONT}`;
  const titleLines = wrapText(ctx, title, CARD_W - 220).slice(0, 2);
  titleLines.forEach((l, i) => ctx.fillText(l, CARD_W / 2, 268 + i * 78));

  // スタンプの升目
  const cols = 3;
  const rows = Math.max(1, Math.ceil(spots.length / cols));
  const radius = 88;
  const gapX = 300;
  const gapY = 226;
  const gridTop = 268 + titleLines.length * 78 + 90;
  const startX = CARD_W / 2 - ((cols - 1) * gapX) / 2;

  spots.slice(0, cols * 4).forEach((spot, i) => {
    const cx = startX + (i % cols) * gapX;
    const cy = gridTop + Math.floor(i / cols) * gapY;
    const stamped = stampedIds.has(spot.id);

    ctx.save();
    ctx.translate(cx, cy);
    if (stamped) {
      ctx.rotate((((i * 37) % 17) - 8) * (Math.PI / 180));
      ctx.strokeStyle = spot.stampColor;
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = spot.stampColor;
      ctx.font = `900 46px ${CARD_FONT}`;
      ctx.textBaseline = "middle";
      ctx.fillText(spot.stampLabel, 0, 4);
    } else {
      ctx.strokeStyle = theme.line;
      ctx.lineWidth = 6;
      ctx.setLineDash([12, 12]);
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();

    ctx.fillStyle = theme.sub;
    ctx.font = `500 26px ${CARD_FONT}`;
    ctx.textBaseline = "alphabetic";
    const name = spot.name.length > 8 ? `${spot.name.slice(0, 8)}…` : spot.name;
    ctx.fillText(name, cx, cy + radius + 46);
  });

  const footY = Math.max(gridTop + rows * gapY + 40, CARD_H - 230);
  ctx.fillStyle = theme.accent;
  ctx.font = `bold 44px ${CARD_FONT}`;
  ctx.fillText("スタンプをすべて集めました", CARD_W / 2, footY);

  ctx.fillStyle = theme.sub;
  ctx.font = `500 30px ${CARD_FONT}`;
  const d = new Date();
  ctx.fillText(
    `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`,
    CARD_W / 2,
    footY + 56
  );
  if (couponCode) {
    ctx.font = `500 26px ${CARD_FONT}`;
    ctx.fillText(`引換コード ${couponCode}`, CARD_W / 2, footY + 104);
  }
}

function CompleteScreen({
  theme,
  rally,
  spots,
  state,
  onBack,
}: {
  theme: Theme;
  rally: RallyView;
  spots: RallySpotView[];
  state: RallyState | null;
  onBack: () => void;
}) {
  const [showAr, setShowAr] = useState(false);
  const [cardUrl, setCardUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const stampedIds = useMemo(
    () => new Set((state?.stamps ?? []).map((s) => s.spotId)),
    [state]
  );

  useEffect(() => {
    const canvas = document.createElement("canvas");
    canvasRef.current = canvas;
    drawMemorialCard(canvas, {
      theme,
      title: rally.name,
      spots,
      stampedIds,
      couponCode: state?.coupon?.code ?? null,
    });
    const url = canvas.toDataURL("image/png");
    setCardUrl(url);
  }, [theme, rally.name, spots, stampedIds, state?.coupon?.code]);

  async function handleShare() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!blob) return;
    const file = new File([blob], "stamp-rally.png", { type: "image/png" });
    const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
    if (nav.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: rally.name });
        return;
      } catch {
        // 共有シートを閉じただけの場合はここに来る。保存導線は下に残っているので何もしない。
        return;
      }
    }
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "stamp-rally.png";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  if (showAr && rally.rewardModelUrl) {
    return (
      <RallyStampScene modelUrl={rally.rewardModelUrl}>
        <div className="flex h-full w-full flex-col items-center justify-between px-6 py-10 text-white">
          <p className="text-center text-2xl font-black drop-shadow-lg">{rally.rewardMessage}</p>
          <div className="pointer-events-auto w-full max-w-sm">
            <button
              onClick={() => setShowAr(false)}
              className="w-full rounded-xl bg-white py-3.5 text-sm font-bold text-slate-900"
            >
              戻る
            </button>
          </div>
        </div>
      </RallyStampScene>
    );
  }

  return (
    <div className="min-h-screen px-6 py-8" style={{ background: theme.bg, color: theme.ink }}>
      <button onClick={onBack} className="text-sm" style={{ color: theme.sub }}>
        ← スタンプ帳へ戻る
      </button>

      <div className="mx-auto mt-6 max-w-md space-y-6">
        <div className="text-center">
          <p className="text-xs tracking-[0.4em]" style={{ color: theme.sub }}>
            COMPLETE
          </p>
          <h2 className="mt-2 text-2xl font-bold">{rally.rewardMessage}</h2>
        </div>

        {cardUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={cardUrl}
            alt="記念カード"
            className="w-full rounded-2xl"
            style={{ border: `1px solid ${theme.line}` }}
          />
        )}

        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={handleShare}
            className="rounded-xl py-3 text-sm font-bold"
            style={{ background: theme.accent, color: theme.onAccent }}
          >
            記念カードを保存 / 共有
          </button>
          <button
            onClick={() => setShowAr(true)}
            disabled={!rally.rewardModelUrl}
            className="rounded-xl py-3 text-sm font-bold disabled:opacity-40"
            style={{ background: theme.panel, color: theme.ink, border: `1px solid ${theme.line}` }}
          >
            記念ARを見る
          </button>
        </div>

        {rally.couponEnabled && state?.coupon && (
          <section
            className="rounded-2xl p-5 text-center"
            style={{ background: theme.panel, border: `1px solid ${theme.line}` }}
          >
            <p className="text-sm font-bold">{rally.couponLabel}</p>
            <p
              className="mt-3 font-mono text-3xl font-bold tracking-[0.2em]"
              style={{ color: state.coupon.redeemedAt ? theme.sub : theme.accent }}
            >
              {state.coupon.code}
            </p>
            {state.coupon.redeemedAt ? (
              <p className="mt-3 text-xs" style={{ color: theme.sub }}>
                引換済み（{new Date(state.coupon.redeemedAt).toLocaleString("ja-JP")}）
              </p>
            ) : (
              <>
                <p className="mt-3 text-xs leading-relaxed" style={{ color: theme.sub }}>
                  この画面を係員にご提示ください。係員が確認すると引換済みになります。
                </p>
                {rally.couponNote && (
                  <p className="mt-2 text-xs leading-relaxed" style={{ color: theme.sub }}>
                    {rally.couponNote}
                  </p>
                )}
              </>
            )}
            <button
              onClick={() => {
                navigator.clipboard?.writeText(state.coupon!.code);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
              className="mt-4 text-xs underline underline-offset-4"
              style={{ color: theme.sub }}
            >
              {copied ? "コピーしました" : "コードをコピー"}
            </button>
          </section>
        )}

        {state?.restoreCode && (
          <p className="text-center text-[11px]" style={{ color: theme.sub }}>
            引き継ぎコード: <span className="font-mono tracking-widest">{state.restoreCode}</span>
          </p>
        )}
      </div>
    </div>
  );
}
