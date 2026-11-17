export type Mail = { to: string; subject: string; text: string; html: string };
export type Mailer = (mail: Mail) => Promise<void>;

/** Sends mail through Resend's HTTP API. */
export function resendMailer(apiKey: string, from: string): Mailer {
  return async (mail) => {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [mail.to], subject: mail.subject, text: mail.text, html: mail.html }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error(`Resend responded ${response.status}: ${await response.text()}`);
  };
}

const escape = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

export function resetPasswordMail(to: string, name: string, url: string): Mail {
  const text = `Merhaba ${name},\n\nKentBağ şifreni yenilemek için bu bağlantıyı aç (1 saat geçerli):\n${url}\n\nBu isteği sen yapmadıysan bu e-postayı yok sayabilirsin; şifren değişmez.\n\nKentBağ · Oltu`;
  const html = `<div style="font:16px/1.6 system-ui,sans-serif;color:#1d262b;max-width:480px">
<p>Merhaba ${escape(name)},</p>
<p>KentBağ şifreni yenilemek için aşağıdaki düğmeye bas. Bağlantı 1 saat geçerli.</p>
<p><a href="${escape(url)}" style="display:inline-block;background:#1d262b;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:700">Şifremi yenile</a></p>
<p style="color:#4b5a62">Bu isteği sen yapmadıysan bu e-postayı yok sayabilirsin; şifren değişmez.</p>
<p style="color:#4b5a62">KentBağ · Oltu</p></div>`;
  return { to, subject: "KentBağ şifre yenileme", text, html };
}
