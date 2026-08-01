import { TRPCError } from "@trpc/server";
import { nanoid } from "nanoid";
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import * as db from "../db";
import { sendDraft } from "../sendDraft";
import { generateTouchpointEmail } from "../generateEmail";

/**
 * Rejects a Gmail account id the caller does not own.
 *
 * `gmailAccountId` arrives from the client on approve/edit and is later used to
 * pick the OAuth credentials to send with. Unvalidated, a user could point a
 * draft at another tenant's account and send mail out of their mailbox.
 */
async function assertOwnsGmailAccount(gmailAccountId: number | undefined, userId: number) {
  if (gmailAccountId === undefined) return;
  const account = await db.getGmailAccount(gmailAccountId, userId);
  if (!account) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Gmail account not found." });
  }
}

export const draftsRouter = router({
  list: protectedProcedure.input(z.object({
    status: z.enum(["pending", "approved", "sent", "skipped", "failed"]).optional(),
  })).query(async ({ ctx, input }) => {
    const drafts = await db.getEmailDrafts(ctx.user.id, input.status);
    // One query for the whole page rather than one per draft: the queue used to
    // issue a contact lookup for every row, and many rows share a contact.
    const contacts = await db.getContacts(ctx.user.id);
    const byId = new Map(contacts.map(c => [c.id, c]));
    return drafts.map(draft => ({ ...draft, contact: byId.get(draft.contactId) }));
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

    const generated = await generateTouchpointEmail(contact, tpName, tpDesc, voiceProfile, ctx.user.id);
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
    await assertOwnsGmailAccount(input.gmailAccountId, ctx.user.id);
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
    await assertOwnsGmailAccount(updates.gmailAccountId, ctx.user.id);
    await db.updateEmailDraft(id, ctx.user.id, updates);
    return { success: true };
  }),

  skip: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
    await db.updateEmailDraft(input.id, ctx.user.id, { status: "skipped" });
    return { success: true };
  }),

  /**
   * Send immediately, outside the approval queue (Calendar / Contact Detail
   * "Send Now"). Deliberately does not require `approved` — the user is taking
   * the action by hand on a draft in front of them.
   */
  manualSend: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
    const result = await sendDraft(input.id, ctx.user.id);
    return { ...result, deliveryStatus: "delivered" as const };
  }),

  /** Send from the approval queue. Requires a human to have approved first. */
  send: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
    const draft = await db.getEmailDraft(input.id, ctx.user.id);
    if (!draft) throw new TRPCError({ code: "NOT_FOUND" });
    // The approval queue is the product's core promise: nothing goes out
    // without a human seeing it. `pending` was previously accepted here, which
    // made the gate bypassable despite this very message.
    if (draft.status !== "approved") {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Draft must be approved before sending" });
    }
    return sendDraft(input.id, ctx.user.id);
  }),

  scheduleSend: protectedProcedure
    .input(z.object({ id: z.number(), scheduledSendAt: z.date() }))
    .mutation(async ({ ctx, input }) => {
      const draft = await db.getEmailDraft(input.id, ctx.user.id);
      if (!draft) throw new TRPCError({ code: "NOT_FOUND" });
      if (draft.status === "sent") throw new TRPCError({ code: "BAD_REQUEST", message: "Email already sent" });
      
      await db.updateEmailDraft(input.id, ctx.user.id, {
        status: "approved",
        scheduledSendAt: input.scheduledSendAt,
      });
      
      return { success: true, scheduledAt: input.scheduledSendAt };
    }),
});
