const SITE_NAME = "Stellar Client";

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

type EmailTemplateOptions = {
  title: string;
  bodyHtml: string;
  linkUrl?: string | null;
  linkLabel?: string;
  unsubscribeUrl?: string | null;
  footnote?: string;
};

/** Единый брендированный HTML-шаблон для писем. */
export function renderEmail({
  title,
  bodyHtml,
  linkUrl,
  linkLabel = "Открыть в кабинете",
  unsubscribeUrl,
  footnote,
}: EmailTemplateOptions): string {
  const button = linkUrl
    ? `<a href="${escapeHtml(linkUrl)}" style="display:inline-block;margin:8px 0 4px;padding:14px 26px;border-radius:14px;background:#7c3aed;color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;">${escapeHtml(linkLabel)}</a>`
    : "";

  const unsubscribe = unsubscribeUrl
    ? `<p style="margin:18px 0 0;font-size:12px;line-height:1.6;color:#71717a;">Не хотите получать такие письма? <a href="${escapeHtml(unsubscribeUrl)}" style="color:#a78bfa;text-decoration:underline;">Отписаться</a>.</p>`
    : "";

  return `<!doctype html>
<html lang="ru">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#09090b;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#09090b;padding:32px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#111114;border:1px solid #27272a;border-radius:24px;overflow:hidden;">
        <tr>
          <td style="padding:30px 34px 8px;">
            <p style="margin:0;font-size:12px;letter-spacing:4px;text-transform:uppercase;color:#a78bfa;font-weight:700;">${SITE_NAME}</p>
          </td>
        </tr>
        <tr>
          <td style="padding:6px 34px 0;">
            <h1 style="margin:0;font-size:24px;line-height:1.3;color:#ffffff;font-weight:800;">${escapeHtml(title)}</h1>
          </td>
        </tr>
        <tr>
          <td style="padding:18px 34px 10px;color:#d4d4d8;font-size:15px;line-height:1.7;">
            ${bodyHtml}
          </td>
        </tr>
        <tr>
          <td style="padding:6px 34px 30px;">${button}</td>
        </tr>
        <tr>
          <td style="padding:22px 34px 28px;border-top:1px solid #27272a;">
            <p style="margin:0;font-size:12px;line-height:1.6;color:#71717a;">
              ${footnote ? escapeHtml(footnote) + "<br>" : ""}
              Это письмо отправлено автоматически. Сотрудники ${SITE_NAME} никогда не просят пароль или код из письма.
            </p>
            ${unsubscribe}
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
