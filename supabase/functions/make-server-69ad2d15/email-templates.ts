export type EmailTemplateInput = {
  type: string;
  subject: string;
  text: string;
  ctaLabel?: string;
  ctaUrl?: string;
};

const TITLES: Record<string, string> = {
  email_verification: 'Verify your email address',
  welcome: 'Welcome to CLINTPOS',
  approval: 'Your application is approved',
  rejection: 'An update on your application',
  onboarding_admin: 'New merchant application',
  restaurant_invoice: 'Your receipt',
  billing: 'Your subscription update',
  downgrade: 'Your plan has changed',
  cancellation: 'Your subscription update',
  password_setup: 'Create your CLINTPOS sign-in',
};

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[char]!);
}

export function renderEmailTemplate(input: EmailTemplateInput): { html: string; text: string } {
  const paragraphs = input.text.split(/\n\s*\n/).map((part) => escapeHtml(part).replace(/\n/g, '<br>'));
  const action = input.ctaUrl && input.ctaLabel
    ? `<p style="margin:28px 0"><a href="${escapeHtml(input.ctaUrl)}" style="display:inline-block;background:#4f46e5;color:#fff;text-decoration:none;font-weight:700;padding:14px 22px;border-radius:10px">${escapeHtml(input.ctaLabel)}</a></p>`
    : '';
  const title = TITLES[input.type] || 'A message from CLINTPOS';
  const html = `<!doctype html><html><body style="margin:0;background:#f4f5f8;font-family:Arial,Helvetica,sans-serif;color:#202332"><div style="display:none;max-height:0;overflow:hidden">${escapeHtml(input.subject)}</div><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f5f8;padding:32px 12px"><tr><td align="center"><table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width:600px;width:100%;background:#fff;border-radius:18px;overflow:hidden"><tr><td style="background:#111827;padding:22px 32px;color:#fff;font-size:18px;font-weight:800;letter-spacing:1px">CLINTPOS</td></tr><tr><td style="padding:34px 32px"><h1 style="font-size:24px;margin:0 0 22px">${escapeHtml(title)}</h1>${paragraphs.map((p) => `<p style="font-size:15px;line-height:1.65;color:#424657;margin:0 0 16px">${p}</p>`).join('')}${action}<p style="font-size:13px;line-height:1.6;color:#6b7280;margin-top:28px">Need help? Contact support@clintpos.co.za.</p></td></tr><tr><td style="padding:18px 32px;background:#f8fafc;color:#7b8190;font-size:12px">CLINTPOS · Secure merchant operations</td></tr></table></td></tr></table></body></html>`;
  return { html, text: input.text + (input.ctaUrl ? `\n\n${input.ctaLabel}: ${input.ctaUrl}` : '') };
}
