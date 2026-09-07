/**
 * 参加者へのメール送信。
 *
 * 送信基盤は Resend を既定にしている（RESEND_API_KEY と RALLY_MAIL_FROM を設定）。
 * 未設定のときは、本番では明確に失敗させ、開発時だけコンソールに出す。
 * 「送ったつもりで届いていない」が一番たちが悪いので、黙って成功にはしない。
 */
export interface MailResult {
  ok: boolean;
  /** 開発時のみ、送信できなかったコードを画面に返して動作確認できるようにする */
  devCode?: string;
  error?: string;
}

const isProd = process.env.NODE_ENV === "production";

export async function sendVerificationCode(
  to: string,
  code: string,
  rallyName: string
): Promise<MailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RALLY_MAIL_FROM;

  if (!apiKey || !from) {
    if (isProd) {
      return { ok: false, error: "mail_not_configured" };
    }
    // 開発環境：実際には送らず、確認できるようにコードを返す
    console.log(`[rally-mail] to=${to} code=${code}`);
    return { ok: true, devCode: code };
  }

  const subject = `【${rallyName}】確認コード ${code}`;
  const text = [
    `${rallyName} の確認コードは次のとおりです。`,
    ``,
    `    ${code}`,
    ``,
    `画面に戻って、このコードを入力してください。`,
    `有効期限は発行から10分間です。`,
    ``,
    `このメールに心当たりがない場合は、破棄してください。`,
    `コードを他人に教えないでください。`,
  ].join("\n");

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ from, to: [to], subject, text }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error("[rally-mail] 送信失敗:", res.status, detail);
      return { ok: false, error: "send_failed" };
    }
    return { ok: true };
  } catch (e) {
    console.error("[rally-mail] 送信エラー:", e);
    return { ok: false, error: "send_failed" };
  }
}
