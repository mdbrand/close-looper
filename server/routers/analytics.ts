import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import * as db from "../db";

export const analyticsRouter = router({
  stats: protectedProcedure.query(async ({ ctx }) => {
    return db.getAnalyticsStats(ctx.user.id);
  }),

  calendarEvents: protectedProcedure.input(z.object({
    startDate: z.date(),
    endDate: z.date(),
  })).query(async ({ ctx, input }) => {
    const events = await db.getCalendarEvents(ctx.user.id, input.startDate, input.endDate);
    const enriched = await Promise.all(events.map(async (e) => {
      const contact = await db.getContact(e.contactId, ctx.user.id);
      return { ...e, contact };
    }));
    return enriched;
  }),

  listView: protectedProcedure.query(async ({ ctx }) => {
    const drafts = await db.getEmailDrafts(ctx.user.id);
    const enriched = await Promise.all(drafts.map(async (d) => {
      const contact = await db.getContact(d.contactId, ctx.user.id);
      return { ...d, contact };
    }));
    return enriched;
  }),

  needsAttention: protectedProcedure.query(async ({ ctx }) => {
    const contacts = await db.getContacts(ctx.user.id);
    const now = new Date();
    const fortyFiveDaysAgo = new Date(now.getTime() - 45 * 24 * 60 * 60 * 1000);
    return contacts.filter(c => {
      if (c.loopStatus === "paused") return true;
      if (!c.personalNotes || c.personalNotes.trim() === "") return true;
      if (c.lastTouchSentAt && c.lastTouchSentAt < fortyFiveDaysAgo) return true;
      return false;
    });
  }),

  topEngaged: protectedProcedure.query(async ({ ctx }) => {
  const drafts = await db.getEmailDrafts(ctx.user.id, "sent");
    // Group by contact and sum open counts
    const contactOpens: Record<number, { contactId: number; totalOpens: number; emailsSent: number }> = {};
    for (const draft of drafts) {
      if (!contactOpens[draft.contactId]) {
        contactOpens[draft.contactId] = { contactId: draft.contactId, totalOpens: 0, emailsSent: 0 };
      }
      contactOpens[draft.contactId]!.totalOpens += draft.openCount;
      contactOpens[draft.contactId]!.emailsSent += 1;
    }
    const sorted = Object.values(contactOpens).sort((a, b) => b.totalOpens - a.totalOpens).slice(0, 5);
    const enriched = await Promise.all(sorted.map(async (item) => {
      const contact = await db.getContact(item.contactId, ctx.user.id);
      return { ...item, contact };
    }));
    return enriched.filter(e => e.contact);
  }),

  pipeline: protectedProcedure.query(async ({ ctx }) => {
    const database = await getDb();
    if (!database) return { cold: 0, warm: 0, hot: 0, inSequence: 0, inTouchpoints: 0, sequenceReplies: 0, sequenceCompletions: 0 };
    const allContacts = await database.select().from(contacts).where(eq(contacts.userId, ctx.user.id));
    const cold = allContacts.filter(c => c.relationshipTier === "cold").length;
    const warm = allContacts.filter(c => c.relationshipTier === "warm").length;
    const hot = allContacts.filter(c => c.relationshipTier === "hot").length;
    const inSequence = allContacts.filter(c => c.loopType === "relationship_sequence").length;
    const inTouchpoints = allContacts.filter(c => c.loopType === "flexible_touchpoints").length;
    const enrollments = await database.select().from(contactSequenceEnrollments).where(eq(contactSequenceEnrollments.userId, ctx.user.id));
    const sequenceCompletions = enrollments.filter(e => e.status === "completed").length;
    return { cold, warm, hot, inSequence, inTouchpoints, sequenceReplies: 0, sequenceCompletions };
  }),

  extendedStats: protectedProcedure.query(async ({ ctx }) => {
    return await db.getExtendedAnalyticsStats(ctx.user.id);
  }),
});
import { getDb } from "../db";
import { contacts, contactSequenceEnrollments } from "../../drizzle/schema";
import { eq, and, sql } from "drizzle-orm";
