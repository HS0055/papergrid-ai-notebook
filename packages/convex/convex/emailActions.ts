import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { TEMPLATE_ORDER, renderTemplate, dispatchEmail } from "./email";

export const sendTransactional: ReturnType<typeof internalAction> = internalAction({
  args: {
    templateKey: v.string(),
    toEmail: v.string(),
    context: v.optional(v.any()),
    metadata: v.optional(v.any()),
    triggeredByUserId: v.optional(v.id("users")),
    triggeredByEmail: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { settings, templates } = await ctx.runQuery(internal.email.getRuntimeConfigInternal, {});
    const key = TEMPLATE_ORDER.find((item) => item === args.templateKey);
    if (!key) {
      throw new Error(`Unknown email template: ${args.templateKey}`);
    }

    const template = templates[key];
    const rendered = renderTemplate(
      settings,
      template,
      (args.context as Record<string, unknown> | undefined) ?? {},
    );

    const deliveryId = await ctx.runMutation(internal.email.createDeliveryInternal, {
      templateKey: key,
      toEmail: args.toEmail,
      subject: rendered.subject,
      provider: settings.provider,
      metadata: args.metadata,
      triggeredByUserId: args.triggeredByUserId,
      triggeredByEmail: args.triggeredByEmail,
    });

    if (!settings.enabled || settings.provider === "none" || !template.enabled) {
      await ctx.runMutation(internal.email.markDeliveryInternal, {
        deliveryId,
        status: "skipped",
        error: !settings.enabled
          ? "Email sending disabled in admin settings"
          : settings.provider === "none"
            ? "No email provider selected"
            : `Template ${key} is disabled`,
      });
      return { deliveryId, status: "skipped" as const };
    }

    try {
      const result = await dispatchEmail(settings, args.toEmail, rendered);
      await ctx.runMutation(internal.email.markDeliveryInternal, {
        deliveryId,
        status: "sent",
        providerMessageId: result.providerMessageId,
      });
      return { deliveryId, status: "sent" as const, providerMessageId: result.providerMessageId };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to send email";
      await ctx.runMutation(internal.email.markDeliveryInternal, {
        deliveryId,
        status: "failed",
        error: message,
      });
      throw error;
    }
  },
});
