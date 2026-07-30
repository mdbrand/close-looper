import { TRPCError } from "@trpc/server";
import { nanoid } from "nanoid";
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { invokeLLM } from "../_core/llm";
import * as db from "../db";
import { notifyOwner } from "../_core/notification";

async function generateEmailWithAI(
  contact: Awaited<ReturnType<typeof db.getContact>>,
  touchpointName: string,
  touchpointDescription: string,
  voiceProfile: Awaited<ReturnType<typeof db.getVoiceProfile>>
): Promise<{ subject: string; body: string; whyExplanation: string }> {
  if (!contact) throw new Error("Contact not found");

  const voiceContext = voiceProfile
    ? `Here is how the sender naturally writes/talks (match this voice exactly):\n"${voiceProfile.voiceSample}"\nStyle notes: ${voiceProfile.styleNotes ?? "casual, friendly, direct"}`
    : "Write in a casual, friendly, direct voice — like texting a friend.";

  const personalContext = [
    contact.personalNotes ? `Personal notes about them: ${contact.personalNotes}` : null,
    contact.industry ? `They work in: ${contact.industry}` : null,
    contact.company ? `Their company: ${contact.company}` : null,
    contact.howWeMet ? `How we met: ${contact.howWeMet}` : null,
  ].filter(Boolean).join("\n");

  const prompt = `You are writing a short, casual top-of-mind email from me to ${contact.firstName}${contact.lastName ? " " + contact.lastName : ""}.

The reason for the email is: ${touchpointName} — ${touchpointDescription}

${personalContext ? `Context about this person:\n${personalContext}\n` : ""}
${voiceContext}

Rules:
- 7th grade reading level — simple words, short sentences
- NO fluff, NO "I hope this email finds you well", NO corporate speak
- Sound like a real person dashing off a quick note, not a marketer
- 3-5 sentences max for the body
- The subject line should be short and feel personal (like a text preview), not a marketing headline
- End with something warm but brief — no long sign-offs
- Do NOT mention the holiday/event name awkwardly — weave it in naturally

Return JSON with exactly these fields:
{
  "subject": "short subject line here",
  "body": "full email body here (plain text, no HTML)",
  "whyExplanation": "one sentence explaining why this touchpoint was chosen for this contact"
}`;

  const response = await invokeLLM({
    messages: [{ role: "user", content: prompt }],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "email_draft",
        strict: true,
        schema: {
          type: "object",
          properties: {
            subject: { type: "string" },
            body: { type: "string" },
            whyExplanation: { type: "string" },
          },
          required: ["subject", "body", "whyExplanation"],
          additionalProperties: false,
        },
      },
    },
  });

  const rawContent = response.choices[0]?.message?.content;
  const content = typeof rawContent === "string" ? rawContent : null;
  if (!content) throw new Error("No response from AI");
  return JSON.parse(content);
}

export const draftsRouter = router({
  list: protectedProcedure.input(z.object({
    status: z.enum(["pending", "approved", "sent", "skipped", "failed"]).optional(),
  })).query(async ({ ctx, input }) => {
    const drafts = await db.getEmailDrafts(ctx.user.id, input.status);
    // Attach contact info to each draft
    const enriched = await Promise.all(drafts.map(async (draft) => {
      const contact = await db.getContact(draft.contactId, ctx.user.id);
      return { ...draft, contact };
    }));
    return enriched;
  }),

  generate: protectedProcedure.input(z.object({
    contactId: z.number(),
    touchpointId: z.number().optional(),
    touchpointName: z.string().optional(),
    touchpointDescription: z.string().optional(),
    touchpointCategory: z.string().optional(),
  })).mutation(async ({ ctx, input }) => {
    const contact = await db.getContact(input.contactId, ctx.user.id);
    if (!contact) throw new TRPCError({ code: "NOT_FOUND", message: "Contact not found" });

    const voiceProfile = await db.getVoiceProfile(ctx.user.id);

    let tpName = input.touchpointName ?? "Thinking of you";
    let tpDesc = input.touchpointDescription ?? "Just wanted to reach out and say hi.";
    let tpCategory = input.touchpointCategory ?? "personal_milestone";

    if (input.touchpointId) {
      const allTps = await db.getTouchpoints();
      const tp = allTps.find(t => t.id === input.touchpointId);
      if (tp) { tpName = tp.name; tpDesc = tp.description ?? tpName; tpCategory = tp.category; }
    }

    const generated = await generateEmailWithAI(contact, tpName, tpDesc, voiceProfile);
    const trackingId = nanoid(32);

    const id = await db.createEmailDraft({
      userId: ctx.user.id,
      contactId: input.contactId,
      touchpointId: input.touchpointId ?? null,
      touchpointName: tpName,
      touchpointCategory: tpCategory,
      subject: generated.subject,
      body: generated.body,
      whyExplanation: generated.whyExplanation,
      trackingId,
      status: "pending",
    });

    return { id, ...generated, trackingId };
  }),

  approve: protectedProcedure.input(z.object({ id: z.number(), gmailAccountId: z.number().optional() })).mutation(async ({ ctx, input }) => {
    const draft = await db.getEmailDraft(input.id, ctx.user.id);
    if (!draft) throw new TRPCError({ code: "NOT_FOUND" });
    await db.updateEmailDraft(input.id, ctx.user.id, {
      status: "approved",
      gmailAccountId: input.gmailAccountId ?? draft.gmailAccountId,
    });
    return { success: true };
  }),

  edit: protectedProcedure.input(z.object({
    id: z.number(),
    subject: z.string().optional(),
    body: z.string().optional(),
    gmailAccountId: z.number().optional(),
  })).mutation(async ({ ctx, input }) => {
    const { id, ...updates } = input;
    await db.updateEmailDraft(id, ctx.user.id, updates);
    return { success: true };
  }),

  skip: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
    await db.updateEmailDraft(input.id, ctx.user.id, { status: "skipped" });
    return { success: true };
  }),

  send: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
    const draft = await db.getEmailDraft(input.id, ctx.user.id);
    if (!draft) throw new TRPCError({ code: "NOT_FOUND" });
    if (draft.status !== "approved" && draft.status !== "pending") {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Draft must be approved before sending" });
    }

    const contact = await db.getContact(draft.contactId, ctx.user.id);
    if (!contact) throw new TRPCError({ code: "NOT_FOUND", message: "Contact not found" });

    const gmailAccountId = draft.gmailAccountId;
    if (!gmailAccountId) throw new TRPCError({ code: "BAD_REQUEST", message: "No Gmail account selected for this draft" });

    const gmailAccount = await db.getGmailAccount(gmailAccountId);
    if (!gmailAccount) throw new TRPCError({ code: "NOT_FOUND", message: "Gmail account not found" });

    // Build the email with tracking pixel
    const trackingPixelUrl = `${process.env.VITE_APP_URL ?? ""}/api/track/${draft.trackingId}.gif`;
    const unsubscribeUrl = `${process.env.VITE_APP_URL ?? ""}/api/unsubscribe/${draft.trackingId}`;
    const bodyWithTracking = `${draft.body}\n\n---\n<a href="${unsubscribeUrl}" style="color:#999;font-size:11px;">Unsubscribe</a><img src="${trackingPixelUrl}" width="1" height="1" style="display:none;" />`;

    try {
      const { google } = await import("googleapis");
      const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        process.env.GOOGLE_REDIRECT_URI
      );
      oauth2Client.setCredentials({
        access_token: gmailAccount.accessToken,
        refresh_token: gmailAccount.refreshToken ?? undefined,
        expiry_date: gmailAccount.tokenExpiry ?? undefined,
      });

      // Refresh token if needed
      const { credentials } = await oauth2Client.refreshAccessToken();
      if (credentials.access_token && credentials.access_token !== gmailAccount.accessToken) {
        await db.upsertGmailAccount({
          userId: ctx.user.id,
          gmailAddress: gmailAccount.gmailAddress,
          accessToken: credentials.access_token,
          refreshToken: credentials.refresh_token ?? gmailAccount.refreshToken ?? "",
          tokenExpiry: credentials.expiry_date ?? null,
          isDefault: gmailAccount.isDefault,
        });
        oauth2Client.setCredentials(credentials);
      }

      const gmail = google.gmail({ version: "v1", auth: oauth2Client });
      const emailLines = [
        `From: ${gmailAccount.gmailAddress}`,
        `To: ${contact.email}`,
        `Subject: ${draft.subject}`,
        `MIME-Version: 1.0`,
        `Content-Type: text/html; charset=utf-8`,
        ``,
        bodyWithTracking.replace(/\n/g, "<br>"),
      ];
      const raw = Buffer.from(emailLines.join("\r\n")).toString("base64url");
      const sent = await gmail.users.messages.send({ userId: "me", requestBody: { raw } });

      await db.updateEmailDraft(input.id, ctx.user.id, {
        status: "sent",
        sentAt: new Date(),
        gmailMessageId: sent.data.id ?? null,
      });
      await db.createEmailEvent({ draftId: draft.id, eventType: "sent" });
      await db.updateContact(draft.contactId, ctx.user.id, { lastTouchSentAt: new Date() });

      return { success: true, messageId: sent.data.id };
    } catch (err: any) {
      await db.updateEmailDraft(input.id, ctx.user.id, { status: "failed" });
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: `Failed to send: ${err.message}` });
    }
  }),
});
