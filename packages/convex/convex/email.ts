import { v } from "convex/values";
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
  QueryCtx,
  MutationCtx,
} from "./_generated/server";
import { internal } from "./_generated/api";

const EMAIL_SETTINGS_KEY = "email-settings";
const EMAIL_TEMPLATES_KEY = "email-templates";
const RESEND_TEST_DOMAIN = "resend.dev";
const LEGACY_DEFAULT_FROM_EMAIL = "onboarding@resend.dev";
const LEGACY_DEFAULT_REPLY_TO = "support@papergrid.app";

function envDefault(name: string, fallback: string): string {
  const value = process.env[name]?.trim();
  return value || fallback;
}

export const TEMPLATE_ORDER = [
  "password_reset",
  "waitlist_joined",
  "welcome",
  "gift",
  "referral_reward",
  "referral_welcome",
  "custom",
] as const;

export type EmailTemplateKey = typeof TEMPLATE_ORDER[number];
export type EmailProvider = "none" | "resend" | "postmark" | "sendgrid";

export interface EmailSettings {
  enabled: boolean;
  provider: EmailProvider;
  appName: string;
  appBaseUrl: string;
  senderName: string;
  fromEmail: string;
  replyTo: string;
  supportEmail: string;
}

export interface EmailTemplate {
  key: EmailTemplateKey;
  label: string;
  description: string;
  enabled: boolean;
  subject: string;
  html: string;
  text: string;
  sampleContext: Record<string, unknown>;
}

export type EmailTemplateMap = Record<EmailTemplateKey, EmailTemplate>;

export interface RenderedTemplate {
  subject: string;
  html: string;
  text: string;
}

const DEFAULT_SETTINGS: EmailSettings = {
  enabled: true,
  provider: "resend",
  appName: "Papera",
  appBaseUrl: process.env.PUBLIC_APP_URL || "https://papera.io",
  senderName: "Papera",
  fromEmail: envDefault("EMAIL_FROM", "hello@papera.io"),
  replyTo: envDefault("EMAIL_REPLY_TO", "support@papera.io"),
  supportEmail: envDefault("SUPPORT_EMAIL", "support@papera.io"),
};

const DEFAULT_TEMPLATE_DEFINITIONS: EmailTemplateMap = {
  password_reset: {
    key: "password_reset",
    label: "Password Reset",
    description: "Forgot-password delivery with a one-time reset code.",
    enabled: true,
    subject: "{{appName}} password reset code: {{resetCode}}",
    html: `
      <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#0f172a">
        <p style="font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#64748b;margin:0 0 12px">Password reset</p>
        <h1 style="font-size:28px;line-height:1.2;margin:0 0 12px">Reset your {{appName}} password</h1>
        <p style="font-size:15px;line-height:1.7;color:#334155;margin:0 0 20px">Use the code below to reset your password. It expires in {{resetExpiresMinutes}} minutes.</p>
        <div style="font-size:34px;font-weight:700;letter-spacing:.22em;background:#f8fafc;border:1px solid #cbd5e1;border-radius:16px;padding:18px 22px;text-align:center;margin:0 0 20px">{{resetCode}}</div>
        <p style="font-size:14px;line-height:1.7;color:#475569;margin:0 0 12px">If you did not request this, you can ignore this email.</p>
        <p style="font-size:14px;line-height:1.7;color:#475569;margin:0">Need help? Reply to this email or contact {{supportEmail}}.</p>
      </div>
    `.trim(),
    text: `Reset your {{appName}} password.\n\nUse this code: {{resetCode}}\n\nIt expires in {{resetExpiresMinutes}} minutes.\n\nIf you did not request this, ignore this email.\n\nSupport: {{supportEmail}}`,
    sampleContext: {
      name: "Alex",
      resetCode: "123456",
      resetExpiresMinutes: 15,
    },
  },
  waitlist_joined: {
    key: "waitlist_joined",
    label: "Waitlist Joined",
    description: "Confirmation after someone joins the launch waitlist.",
    enabled: true,
    subject: "You're on the {{appName}} waitlist",
    html: `
      <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#0f172a">
        <p style="font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#64748b;margin:0 0 12px">Waitlist</p>
        <h1 style="font-size:28px;line-height:1.2;margin:0 0 12px">You're in</h1>
        <p style="font-size:15px;line-height:1.7;color:#334155;margin:0 0 16px">Thanks for joining the {{appName}} waitlist. We'll email you as soon as early access opens.</p>
        <ul style="padding-left:20px;color:#334155;line-height:1.8;margin:0 0 18px">
          <li>{{waitlistBonusInk}} bonus Ink on launch day</li>
          <li>{{waitlistDiscountPercent}}% lifetime discount on Pro</li>
          <li>First access to the latest release</li>
        </ul>
        <p style="font-size:14px;line-height:1.7;color:#475569;margin:0">We'll reach you at {{email}}. If that changes, reply and we'll sort it out.</p>
      </div>
    `.trim(),
    text: `You're on the {{appName}} waitlist.\n\nWe'll email you when early access opens.\n\nPerks:\n- {{waitlistBonusInk}} bonus Ink on launch day\n- {{waitlistDiscountPercent}}% lifetime discount on Pro\n- First access to the latest release\n\nWe'll reach you at {{email}}.`,
    sampleContext: {
      email: "alex@example.com",
      waitlistBonusInk: 25,
      waitlistDiscountPercent: 20,
    },
  },
  welcome: {
    key: "welcome",
    label: "Welcome",
    description: "Post-signup welcome email for new accounts.",
    enabled: true,
    subject: "Welcome to {{appName}}, {{name}}",
    html: `
      <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#0f172a">
        <p style="font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#64748b;margin:0 0 12px">Welcome</p>
        <h1 style="font-size:28px;line-height:1.2;margin:0 0 12px">Hi {{name}}, welcome to {{appName}}</h1>
        <p style="font-size:15px;line-height:1.7;color:#334155;margin:0 0 16px">Your account is live and ready. Start creating notebooks, layouts, and covers from your dashboard.</p>
        <p style="font-size:15px;line-height:1.7;color:#334155;margin:0 0 16px">Current plan: <strong>{{plan}}</strong>.</p>
        <p style="font-size:15px;line-height:1.7;color:#334155;margin:0 0 16px">{{welcomeBonusLine}}</p>
        <a href="{{appBaseUrl}}/app" style="display:inline-block;background:#111827;color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:12px;font-weight:600">Open {{appName}}</a>
      </div>
    `.trim(),
    text: `Hi {{name}}, welcome to {{appName}}.\n\nYour account is live.\n\nCurrent plan: {{plan}}\n{{welcomeBonusLine}}\n\nOpen your dashboard: {{appBaseUrl}}/app`,
    sampleContext: {
      name: "Alex",
      plan: "free",
      welcomeBonusLine: "You also unlocked 25 bonus Ink from the launch waitlist.",
    },
  },
  gift: {
    key: "gift",
    label: "Gift",
    description: "Gift or credit delivery. Kept generic for future flows.",
    enabled: true,
    subject: "{{giftSenderName}} sent you a gift on {{appName}}",
    html: `
      <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#0f172a">
        <p style="font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#64748b;margin:0 0 12px">Gift</p>
        <h1 style="font-size:28px;line-height:1.2;margin:0 0 12px">You've received {{giftAmount}}</h1>
        <p style="font-size:15px;line-height:1.7;color:#334155;margin:0 0 16px">{{giftSenderName}} sent you a gift on {{appName}}.</p>
        <p style="font-size:15px;line-height:1.7;color:#334155;margin:0 0 16px">{{giftMessage}}</p>
        <a href="{{ctaUrl}}" style="display:inline-block;background:#111827;color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:12px;font-weight:600">{{ctaLabel}}</a>
      </div>
    `.trim(),
    text: `You've received {{giftAmount}} on {{appName}}.\n\nFrom: {{giftSenderName}}\nMessage: {{giftMessage}}\n\n{{ctaLabel}}: {{ctaUrl}}`,
    sampleContext: {
      giftSenderName: "Papera Team",
      giftAmount: "50 Ink",
      giftMessage: "A small boost to get started.",
      ctaUrl: "https://papera.io/app",
      ctaLabel: "Open dashboard",
    },
  },
  referral_reward: {
    key: "referral_reward",
    label: "Referral Reward",
    description: "Reward email for the referrer after a referral qualifies.",
    enabled: true,
    subject: "You earned {{rewardInk}} Ink on {{appName}}",
    html: `
      <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#0f172a">
        <p style="font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#64748b;margin:0 0 12px">Referral reward</p>
        <h1 style="font-size:28px;line-height:1.2;margin:0 0 12px">Referral bonus unlocked</h1>
        <p style="font-size:15px;line-height:1.7;color:#334155;margin:0 0 16px">{{referredName}} signed up through your link, so {{rewardInk}} Ink has been added to your wallet.</p>
        <a href="{{appBaseUrl}}/referral" style="display:inline-block;background:#111827;color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:12px;font-weight:600">View referrals</a>
      </div>
    `.trim(),
    text: `Referral bonus unlocked.\n\n{{referredName}} signed up through your link, so {{rewardInk}} Ink has been added to your wallet.\n\nView referrals: {{appBaseUrl}}/referral`,
    sampleContext: {
      referredName: "Sam",
      rewardInk: 25,
    },
  },
  referral_welcome: {
    key: "referral_welcome",
    label: "Referral Welcome",
    description: "Reward email for the new user who joined through a referral.",
    enabled: true,
    subject: "Your {{appName}} referral bonus is ready",
    html: `
      <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#0f172a">
        <p style="font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#64748b;margin:0 0 12px">Referral welcome</p>
        <h1 style="font-size:28px;line-height:1.2;margin:0 0 12px">Your bonus Ink is in</h1>
        <p style="font-size:15px;line-height:1.7;color:#334155;margin:0 0 16px">You joined {{appName}} through {{referrerName}}, and {{rewardInk}} Ink has been added to your account.</p>
        <a href="{{appBaseUrl}}/app" style="display:inline-block;background:#111827;color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:12px;font-weight:600">Open dashboard</a>
      </div>
    `.trim(),
    text: `Your bonus Ink is in.\n\nYou joined {{appName}} through {{referrerName}}, and {{rewardInk}} Ink has been added to your account.\n\nOpen dashboard: {{appBaseUrl}}/app`,
    sampleContext: {
      referrerName: "Taylor",
      rewardInk: 25,
    },
  },
  custom: {
    key: "custom",
    label: "Custom",
    description: "Generic admin-defined template for ad hoc sends.",
    enabled: false,
    subject: "{{customSubject}}",
    html: `
      <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#0f172a">
        <h1 style="font-size:28px;line-height:1.2;margin:0 0 12px">{{headline}}</h1>
        <p style="font-size:15px;line-height:1.7;color:#334155;margin:0 0 16px">{{body}}</p>
        <a href="{{ctaUrl}}" style="display:inline-block;background:#111827;color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:12px;font-weight:600">{{ctaLabel}}</a>
      </div>
    `.trim(),
    text: `{{headline}}\n\n{{body}}\n\n{{ctaLabel}}: {{ctaUrl}}`,
    sampleContext: {
      customSubject: "A quick update from Papera",
      headline: "A quick update from Papera",
      body: "You can edit this template in admin and use it for one-off emails.",
      ctaUrl: "https://papera.io",
      ctaLabel: "Open site",
    },
  },
};

function cloneTemplateMap(): EmailTemplateMap {
  return TEMPLATE_ORDER.reduce((acc, key) => {
    acc[key] = {
      ...DEFAULT_TEMPLATE_DEFINITIONS[key],
      sampleContext: { ...DEFAULT_TEMPLATE_DEFINITIONS[key].sampleContext },
    };
    return acc;
  }, {} as EmailTemplateMap);
}

async function requireAdmin(ctx: QueryCtx | MutationCtx, sessionToken: string) {
  const session = await ctx.db
    .query("authSessions")
    .withIndex("by_token", (q) => q.eq("token", sessionToken))
    .first();
  if (!session || new Date(session.expiresAt).getTime() <= Date.now()) {
    throw new Error("Not authenticated");
  }
  const user = await ctx.db.get(session.userId);
  if (!user || user.role !== "admin") {
    throw new Error("Admin only");
  }
  return user;
}

function normalizeSettings(raw: unknown): EmailSettings {
  const input = (raw && typeof raw === "object" ? raw : {}) as Partial<EmailSettings>;
  const provider = input.provider;
  const fromEmail = typeof input.fromEmail === "string" ? input.fromEmail.trim() : "";
  const replyTo = typeof input.replyTo === "string" ? input.replyTo.trim() : "";
  const supportEmail = typeof input.supportEmail === "string" ? input.supportEmail.trim() : "";

  return {
    enabled: input.enabled ?? DEFAULT_SETTINGS.enabled,
    provider:
      provider === "resend" || provider === "postmark" || provider === "sendgrid" || provider === "none"
        ? provider
        : DEFAULT_SETTINGS.provider,
    appName: typeof input.appName === "string" && input.appName.trim() ? input.appName.trim() : DEFAULT_SETTINGS.appName,
    appBaseUrl:
      typeof input.appBaseUrl === "string" && input.appBaseUrl.trim()
        ? input.appBaseUrl.trim().replace(/\/+$/, "")
        : DEFAULT_SETTINGS.appBaseUrl,
    senderName:
      typeof input.senderName === "string" && input.senderName.trim()
        ? input.senderName.trim()
        : DEFAULT_SETTINGS.senderName,
    fromEmail:
      fromEmail.toLowerCase() === LEGACY_DEFAULT_FROM_EMAIL
        ? DEFAULT_SETTINGS.fromEmail
        : fromEmail || DEFAULT_SETTINGS.fromEmail,
    replyTo:
      replyTo.toLowerCase() === LEGACY_DEFAULT_REPLY_TO
        ? DEFAULT_SETTINGS.replyTo
        : replyTo || DEFAULT_SETTINGS.replyTo,
    supportEmail:
      supportEmail.toLowerCase() === LEGACY_DEFAULT_REPLY_TO
        ? DEFAULT_SETTINGS.supportEmail
        : supportEmail || DEFAULT_SETTINGS.supportEmail,
  };
}

function normalizeTemplate(key: EmailTemplateKey, raw: unknown): EmailTemplate {
  const base = DEFAULT_TEMPLATE_DEFINITIONS[key];
  const input = (raw && typeof raw === "object" ? raw : {}) as Partial<EmailTemplate>;
  return {
    key,
    label: typeof input.label === "string" && input.label.trim() ? input.label.trim() : base.label,
    description:
      typeof input.description === "string" && input.description.trim()
        ? input.description.trim()
        : base.description,
    enabled: input.enabled ?? base.enabled,
    subject:
      typeof input.subject === "string" && input.subject.trim()
        ? input.subject
        : base.subject,
    html:
      typeof input.html === "string" && input.html.trim()
        ? input.html
        : base.html,
    text:
      typeof input.text === "string" && input.text.trim()
        ? input.text
        : base.text,
    sampleContext:
      input.sampleContext && typeof input.sampleContext === "object"
        ? (input.sampleContext as Record<string, unknown>)
        : { ...base.sampleContext },
  };
}

function normalizeTemplates(raw: unknown): EmailTemplateMap {
  const out = cloneTemplateMap();
  if (!raw || typeof raw !== "object") return out;
  const input = raw as Record<string, unknown>;
  for (const key of TEMPLATE_ORDER) {
    out[key] = normalizeTemplate(key, input[key]);
  }
  return out;
}

async function getStoredSettings(ctx: QueryCtx | MutationCtx): Promise<EmailSettings> {
  const row = await ctx.db
    .query("appSettings")
    .withIndex("by_key", (q) => q.eq("key", EMAIL_SETTINGS_KEY))
    .first();
  return normalizeSettings(row?.value);
}

async function getStoredTemplates(ctx: QueryCtx | MutationCtx): Promise<EmailTemplateMap> {
  const row = await ctx.db
    .query("appSettings")
    .withIndex("by_key", (q) => q.eq("key", EMAIL_TEMPLATES_KEY))
    .first();
  return normalizeTemplates(row?.value);
}

function formatFromHeader(settings: EmailSettings): string {
  return settings.senderName ? `${settings.senderName} <${settings.fromEmail}>` : settings.fromEmail;
}

function lookupToken(context: Record<string, unknown>, tokenPath: string): string {
  const value = tokenPath.split(".").reduce<unknown>((acc, segment) => {
    if (acc && typeof acc === "object" && segment in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[segment];
    }
    return undefined;
  }, context);
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
}

function renderString(template: string, context: Record<string, unknown>): string {
  return template.replace(/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g, (_, token: string) => lookupToken(context, token));
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getBrandIconUrl(settings: EmailSettings): string {
  return `${settings.appBaseUrl}/brand/papera-icon-trimmed.png`;
}

function wrapEmailHtml(settings: EmailSettings, bodyHtml: string): string {
  const brandIconUrl = getBrandIconUrl(settings);
  const appName = escapeHtml(settings.appName);

  return `
    <div style="background:#f8fafc;margin:0;padding:24px 12px">
      <div style="max-width:600px;margin:0 auto">
        <div style="font-family:Arial,sans-serif;display:flex;align-items:center;gap:10px;margin:0 0 12px;padding:0 8px;color:#0f172a">
          <img src="${escapeHtml(brandIconUrl)}" width="36" height="36" alt="${appName}" style="display:block;width:36px;height:36px;border-radius:8px" />
          <span style="font-size:16px;font-weight:700;line-height:1">${appName}</span>
        </div>
        <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:18px;overflow:hidden">
          ${bodyHtml}
        </div>
      </div>
    </div>
  `.trim();
}

function buildRenderContext(
  settings: EmailSettings,
  template: EmailTemplate,
  rawContext: Record<string, unknown>,
): Record<string, unknown> {
  const merged: Record<string, unknown> = {
    appName: settings.appName,
    appBaseUrl: settings.appBaseUrl,
    brandIconUrl: getBrandIconUrl(settings),
    supportEmail: settings.supportEmail,
    currentYear: new Date().getFullYear(),
    ...template.sampleContext,
    ...rawContext,
  };
  if (typeof merged.name !== "string" || !merged.name) {
    merged.name = "there";
  }
  return merged;
}

export function renderTemplate(
  settings: EmailSettings,
  template: EmailTemplate,
  rawContext: Record<string, unknown>,
): RenderedTemplate {
  const context = buildRenderContext(settings, template, rawContext);
  const html = renderString(template.html, context);
  return {
    subject: renderString(template.subject, context),
    html: wrapEmailHtml(settings, html),
    text: renderString(template.text, context),
  };
}

async function sendViaResend(
  settings: EmailSettings,
  toEmail: string,
  rendered: RenderedTemplate,
): Promise<{ id?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("RESEND_API_KEY not set");
  }
  if (settings.fromEmail.toLowerCase().endsWith(`@${RESEND_TEST_DOMAIN}`)) {
    throw new Error(
      `Resend sender ${settings.fromEmail} uses the ${RESEND_TEST_DOMAIN} test domain. ` +
        "Set From email to an address on your verified domain, e.g. hello@papera.io.",
    );
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: formatFromHeader(settings),
      to: [toEmail],
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      reply_to: settings.replyTo || undefined,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Resend ${res.status}: ${text.slice(0, 300)}`);
  }
  return (await res.json()) as { id?: string };
}

export async function dispatchEmail(
  settings: EmailSettings,
  toEmail: string,
  rendered: RenderedTemplate,
): Promise<{ providerMessageId?: string }> {
  switch (settings.provider) {
    case "resend": {
      const response = await sendViaResend(settings, toEmail, rendered);
      return { providerMessageId: response.id };
    }
    case "postmark":
    case "sendgrid":
      throw new Error(`${settings.provider} provider adapter not implemented yet`);
    default:
      throw new Error("Email provider not configured");
  }
}

export const getRuntimeConfigInternal = internalQuery({
  args: {},
  handler: async (ctx) => {
    const settings = await getStoredSettings(ctx);
    const templates = await getStoredTemplates(ctx);
    return { settings, templates };
  },
});

export const createDeliveryInternal = internalMutation({
  args: {
    templateKey: v.string(),
    toEmail: v.string(),
    subject: v.string(),
    provider: v.string(),
    metadata: v.optional(v.any()),
    triggeredByUserId: v.optional(v.id("users")),
    triggeredByEmail: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("emailDeliveries", {
      templateKey: args.templateKey,
      toEmail: args.toEmail,
      subject: args.subject,
      provider: args.provider,
      status: "pending",
      metadata: args.metadata,
      triggeredByUserId: args.triggeredByUserId,
      triggeredByEmail: args.triggeredByEmail,
      createdAt: new Date().toISOString(),
    });
  },
});

export const markDeliveryInternal = internalMutation({
  args: {
    deliveryId: v.id("emailDeliveries"),
    status: v.union(
      v.literal("sent"),
      v.literal("failed"),
      v.literal("skipped"),
    ),
    providerMessageId: v.optional(v.string()),
    error: v.optional(v.string()),
  },
  handler: async (ctx, { deliveryId, status, providerMessageId, error }) => {
    await ctx.db.patch(deliveryId, {
      status,
      providerMessageId,
      error,
      sentAt: new Date().toISOString(),
    });
  },
});

export const getAdminSnapshot = query({
  args: { sessionToken: v.string() },
  handler: async (ctx, { sessionToken }) => {
    await requireAdmin(ctx, sessionToken);
    const settings = await getStoredSettings(ctx);
    const templates = await getStoredTemplates(ctx);
    return {
      settings,
      templates,
      templateOrder: [...TEMPLATE_ORDER],
      providerStatus: {
        resendConfigured: Boolean(process.env.RESEND_API_KEY),
        postmarkConfigured: Boolean(process.env.POSTMARK_SERVER_TOKEN),
        sendgridConfigured: Boolean(process.env.SENDGRID_API_KEY),
        activeProviderReady:
          settings.provider === "resend"
            ? Boolean(process.env.RESEND_API_KEY)
            : settings.provider === "postmark"
              ? Boolean(process.env.POSTMARK_SERVER_TOKEN)
              : settings.provider === "sendgrid"
                ? Boolean(process.env.SENDGRID_API_KEY)
                : false,
      },
    };
  },
});

export const updateAdminConfig = mutation({
  args: {
    sessionToken: v.string(),
    settings: v.any(),
    templates: v.any(),
  },
  handler: async (ctx, { sessionToken, settings, templates }) => {
    const admin = await requireAdmin(ctx, sessionToken);
    const nextSettings = normalizeSettings(settings);
    const nextTemplates = normalizeTemplates(templates);
    const nowIso = new Date().toISOString();

    const [settingsRow, templatesRow] = await Promise.all([
      ctx.db.query("appSettings").withIndex("by_key", (q) => q.eq("key", EMAIL_SETTINGS_KEY)).first(),
      ctx.db.query("appSettings").withIndex("by_key", (q) => q.eq("key", EMAIL_TEMPLATES_KEY)).first(),
    ]);

    if (settingsRow) {
      await ctx.db.patch(settingsRow._id, {
        value: nextSettings,
        updatedAt: nowIso,
        updatedBy: admin._id,
      });
    } else {
      await ctx.db.insert("appSettings", {
        key: EMAIL_SETTINGS_KEY,
        value: nextSettings,
        updatedAt: nowIso,
        updatedBy: admin._id,
      });
    }

    if (templatesRow) {
      await ctx.db.patch(templatesRow._id, {
        value: nextTemplates,
        updatedAt: nowIso,
        updatedBy: admin._id,
      });
    } else {
      await ctx.db.insert("appSettings", {
        key: EMAIL_TEMPLATES_KEY,
        value: nextTemplates,
        updatedAt: nowIso,
        updatedBy: admin._id,
      });
    }

    await ctx.db.insert("adminAuditLog", {
      actorUserId: admin._id,
      actorEmail: admin.email,
      action: "email.updateAdminConfig",
      details: {
        provider: nextSettings.provider,
        enabled: nextSettings.enabled,
      },
      createdAt: nowIso,
    });

    return {
      success: true,
      settings: nextSettings,
      templates: nextTemplates,
      templateOrder: [...TEMPLATE_ORDER],
    };
  },
});

export const sendAdminTestEmail = mutation({
  args: {
    sessionToken: v.string(),
    templateKey: v.string(),
    toEmail: v.string(),
    context: v.optional(v.any()),
  },
  handler: async (ctx, { sessionToken, templateKey, toEmail, context }) => {
    const admin = await requireAdmin(ctx, sessionToken);
    await ctx.scheduler.runAfter(0, internal.emailActions.sendTransactional, {
      templateKey,
      toEmail,
      context,
      metadata: { source: "admin-test" },
      triggeredByUserId: admin._id,
      triggeredByEmail: admin.email,
    });

    await ctx.db.insert("adminAuditLog", {
      actorUserId: admin._id,
      actorEmail: admin.email,
      action: "email.sendAdminTestEmail",
      targetEmail: toEmail,
      details: { templateKey },
      createdAt: new Date().toISOString(),
    });

    return { queued: true };
  },
});

export const listDeliveries = query({
  args: {
    sessionToken: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { sessionToken, limit }) => {
    await requireAdmin(ctx, sessionToken);
    const pageSize = Math.min(Math.max(limit ?? 50, 1), 200);
    return await ctx.db.query("emailDeliveries").order("desc").take(pageSize);
  },
});
