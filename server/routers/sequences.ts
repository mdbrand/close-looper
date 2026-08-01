import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { sequences, sequenceSteps, contactSequenceEnrollments, contacts } from "../../drizzle/schema";
import { eq, and, desc, asc, sql } from "drizzle-orm";
import { seedColdSequence } from "../seed-cold-sequence";

export const sequencesRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return [];
    const seqs = await db.select().from(sequences).where(eq(sequences.userId, ctx.user.id)).orderBy(desc(sequences.createdAt));
    // Get enrollment counts per sequence
    const enriched = await Promise.all(seqs.map(async (seq) => {
      const enrollments = await db.select().from(contactSequenceEnrollments)
        .where(and(eq(contactSequenceEnrollments.sequenceId, seq.id), eq(contactSequenceEnrollments.userId, ctx.user.id)));
      const active = enrollments.filter(e => e.status === "active").length;
      const completed = enrollments.filter(e => e.status === "completed").length;
      const total = enrollments.length;
      return { ...seq, activeContacts: active, completedContacts: completed, totalEnrollments: total, completionRate: total > 0 ? Math.round((completed / total) * 100) : 0 };
    }));
    return enriched;
  }),

  get: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) return null;
    const [seq] = await db.select().from(sequences).where(and(eq(sequences.id, input.id), eq(sequences.userId, ctx.user.id))).limit(1);
    if (!seq) return null;
    const steps = await db.select().from(sequenceSteps).where(eq(sequenceSteps.sequenceId, seq.id)).orderBy(asc(sequenceSteps.stepNumber));
    return { ...seq, steps };
  }),

  seed: protectedProcedure.mutation(async ({ ctx }) => {
    return await seedColdSequence(ctx.user.id);
  }),

  create: protectedProcedure.input(z.object({
    name: z.string().min(1),
    description: z.string().optional(),
    relationshipTier: z.enum(["cold", "warm", "hot"]).default("cold"),
  })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const [result] = await db.insert(sequences).values({ userId: ctx.user.id, ...input, totalSteps: 0 });
    return { id: result.insertId };
  }),

  update: protectedProcedure.input(z.object({
    id: z.number(),
    name: z.string().optional(),
    description: z.string().optional(),
    isActive: z.boolean().optional(),
    isDefault: z.boolean().optional(),
  })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const { id, ...rest } = input;
    await db.update(sequences).set(rest).where(and(eq(sequences.id, id), eq(sequences.userId, ctx.user.id)));
    return { success: true };
  }),

  duplicate: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const [seq] = await db.select().from(sequences).where(and(eq(sequences.id, input.id), eq(sequences.userId, ctx.user.id))).limit(1);
    if (!seq) throw new TRPCError({ code: "NOT_FOUND" });
    const steps = await db.select().from(sequenceSteps).where(eq(sequenceSteps.sequenceId, seq.id));
    const [newSeq] = await db.insert(sequences).values({ userId: ctx.user.id, name: `${seq.name} (Copy)`, description: seq.description, relationshipTier: seq.relationshipTier, totalSteps: seq.totalSteps, isDefault: false, isActive: true });
    for (const step of steps) {
      await db.insert(sequenceSteps).values({ sequenceId: newSeq.insertId, stepNumber: step.stepNumber, internalName: step.internalName, relationshipObjective: step.relationshipObjective, desiredRecipientThought: step.desiredRecipientThought, emailGuidance: step.emailGuidance, suggestedClosing: step.suggestedClosing, primaryCallToAction: step.primaryCallToAction, minimumWordCount: step.minimumWordCount, maximumWordCount: step.maximumWordCount, delayMonths: step.delayMonths, isActive: step.isActive });
    }
    return { id: newSeq.insertId };
  }),

  updateStep: protectedProcedure.input(z.object({
    id: z.number(),
    internalName: z.string().optional(),
    relationshipObjective: z.string().optional(),
    desiredRecipientThought: z.string().optional(),
    emailGuidance: z.string().optional(),
    suggestedClosing: z.string().optional(),
    primaryCallToAction: z.string().optional(),
    minimumWordCount: z.number().optional(),
    maximumWordCount: z.number().optional(),
    delayMonths: z.number().optional(),
    isActive: z.boolean().optional(),
  })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const { id, ...rest } = input;
    await db.update(sequenceSteps).set(rest).where(eq(sequenceSteps.id, id));
    return { success: true };
  }),

  enroll: protectedProcedure.input(z.object({
    contactId: z.number(),
    sequenceId: z.number(),
  })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    // Check no active enrollment exists
    const existing = await db.select().from(contactSequenceEnrollments)
      .where(and(eq(contactSequenceEnrollments.contactId, input.contactId), eq(contactSequenceEnrollments.status, "active")))
      .limit(1);
    if (existing[0]) throw new TRPCError({ code: "CONFLICT", message: "Contact already has an active enrollment" });
    // Calculate nextSendAt: 15th of current or next month
    const now = new Date();
    const day = now.getDate();
    let sendDate: Date;
    if (day <= 10) {
      sendDate = new Date(now.getFullYear(), now.getMonth(), 15, 10, 0, 0);
    } else {
      sendDate = new Date(now.getFullYear(), now.getMonth() + 1, 15, 10, 0, 0);
    }
    // Weekend handling
    const dow = sendDate.getDay();
    if (dow === 0) sendDate.setDate(sendDate.getDate() + 2); // Sunday → Tuesday
    if (dow === 6) sendDate.setDate(sendDate.getDate() + 3); // Saturday → Tuesday
    await db.insert(contactSequenceEnrollments).values({
      userId: ctx.user.id,
      contactId: input.contactId,
      sequenceId: input.sequenceId,
      currentStepNumber: 1,
      status: "active",
      nextSendAt: sendDate,
    });
    // Update contact loopType
    await db.update(contacts).set({ loopType: "relationship_sequence" }).where(eq(contacts.id, input.contactId));
    return { success: true, nextSendAt: sendDate };
  }),

  getEnrollment: protectedProcedure.input(z.object({ contactId: z.number() })).query(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) return null;
    const [enrollment] = await db.select().from(contactSequenceEnrollments)
      .where(and(eq(contactSequenceEnrollments.contactId, input.contactId), eq(contactSequenceEnrollments.userId, ctx.user.id), eq(contactSequenceEnrollments.status, "active")))
      .limit(1);
    if (!enrollment) return null;
    const [seq] = await db.select().from(sequences).where(eq(sequences.id, enrollment.sequenceId)).limit(1);
    const steps = await db.select().from(sequenceSteps).where(eq(sequenceSteps.sequenceId, enrollment.sequenceId)).orderBy(asc(sequenceSteps.stepNumber));
    const currentStep = steps.find(s => s.stepNumber === enrollment.currentStepNumber);
    return { ...enrollment, sequence: seq, steps, currentStep };
  }),

  restoreDefault: protectedProcedure.mutation(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    // Delete existing cold default sequence and re-seed
    const existing = await db.select().from(sequences)
      .where(and(eq(sequences.userId, ctx.user.id), eq(sequences.relationshipTier, "cold"), eq(sequences.isDefault, true)))
      .limit(1);
    if (existing[0]) {
      await db.delete(sequenceSteps).where(eq(sequenceSteps.sequenceId, existing[0].id));
      await db.delete(sequences).where(eq(sequences.id, existing[0].id));
    }
    return await seedColdSequence(ctx.user.id);
  }),
});
