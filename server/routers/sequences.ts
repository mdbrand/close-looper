import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { sequences, sequenceSteps, contactSequenceEnrollments, contacts, senderProfiles, aiVoiceProfiles } from "../../drizzle/schema";
import { eq, and, desc, asc } from "drizzle-orm";
import { seedColdSequence } from "../seed-cold-sequence";
import { ENV } from "../_core/env";

async function getOwnedSequenceStep(database: NonNullable<Awaited<ReturnType<typeof getDb>>>, stepId: number, userId: number) {
  const [row] = await database
    .select({ step: sequenceSteps, sequence: sequences })
    .from(sequenceSteps)
    .innerJoin(sequences, eq(sequenceSteps.sequenceId, sequences.id))
    .where(and(eq(sequenceSteps.id, stepId), eq(sequences.userId, userId)))
    .limit(1);
  return row;
}

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
    emailTemplate: z.string().optional(),
    subjectTemplate: z.string().optional(),
  })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const { id, ...rest } = input;
    const owned = await getOwnedSequenceStep(db, id, ctx.user.id);
    if (!owned) throw new TRPCError({ code: "NOT_FOUND", message: "Sequence step not found" });
    await db.update(sequenceSteps).set(rest).where(eq(sequenceSteps.id, id));
    return { success: true };
  }),

  enroll: protectedProcedure.input(z.object({
    contactId: z.number(),
    sequenceId: z.number(),
  })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const [[contact], [sequence]] = await Promise.all([
      db.select({ id: contacts.id }).from(contacts)
        .where(and(eq(contacts.id, input.contactId), eq(contacts.userId, ctx.user.id))).limit(1),
      db.select({ id: sequences.id }).from(sequences)
        .where(and(eq(sequences.id, input.sequenceId), eq(sequences.userId, ctx.user.id), eq(sequences.isActive, true))).limit(1),
    ]);
    if (!contact) throw new TRPCError({ code: "NOT_FOUND", message: "Contact not found" });
    if (!sequence) throw new TRPCError({ code: "NOT_FOUND", message: "Sequence not found" });
    // Check no active enrollment exists
    const existing = await db.select().from(contactSequenceEnrollments)
      .where(and(
        eq(contactSequenceEnrollments.userId, ctx.user.id),
        eq(contactSequenceEnrollments.contactId, input.contactId),
        eq(contactSequenceEnrollments.status, "active")
      ))
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
    await db.update(contacts).set({ loopType: "relationship_sequence" })
      .where(and(eq(contacts.id, input.contactId), eq(contacts.userId, ctx.user.id)));
    return { success: true, nextSendAt: sendDate };
  }),

  getEnrollment: protectedProcedure.input(z.object({ contactId: z.number() })).query(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) return null;
    const [enrollment] = await db.select().from(contactSequenceEnrollments)
      .where(and(eq(contactSequenceEnrollments.contactId, input.contactId), eq(contactSequenceEnrollments.userId, ctx.user.id), eq(contactSequenceEnrollments.status, "active")))
      .limit(1);
    if (!enrollment) return null;
    const [seq] = await db.select().from(sequences)
      .where(and(eq(sequences.id, enrollment.sequenceId), eq(sequences.userId, ctx.user.id))).limit(1);
    if (!seq) return null;
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

  generateTemplate: protectedProcedure.input(z.object({ stepId: z.number() })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const owned = await getOwnedSequenceStep(db, input.stepId, ctx.user.id);
    if (!owned) throw new TRPCError({ code: "NOT_FOUND", message: "Sequence step not found" });
    const { step, sequence: seq } = owned;
    const [senderProfile] = await db.select().from(senderProfiles).where(eq(senderProfiles.userId, ctx.user.id)).limit(1);
    const [voiceProfile] = await db.select().from(aiVoiceProfiles).where(eq(aiVoiceProfiles.userId, ctx.user.id)).limit(1);
    const prompt = `Write a reusable email template for Step ${step.stepNumber} of a relationship-building sequence.

STEP: ${step.internalName}
RELATIONSHIP OBJECTIVE: ${step.relationshipObjective}
DESIRED RECIPIENT THOUGHT: ${step.desiredRecipientThought ?? ""}
EMAIL GUIDANCE: ${step.emailGuidance}
SUGGESTED CLOSING: ${step.suggestedClosing ?? ""}
CTA: ${step.primaryCallToAction ?? "None"}

SENDER: ${senderProfile?.senderFirstName ?? "Rob"} ${senderProfile?.senderLastName ?? ""}
COMPANY: ${senderProfile?.companyName ?? ""}
SERVICE: ${senderProfile?.mainService ?? ""}
${voiceProfile ? `VOICE STYLE: ${voiceProfile.voiceSample}` : ""}

RULES:
- Use {{firstName}}, {{company}}, {{industry}} as placeholders for personalization
- Write in casual, natural 7th-grade language
- No fluff, no "I hope this finds you well", no fake urgency
- Keep it between ${step.minimumWordCount}–${step.maximumWordCount} words
- Make it feel like one person writing to another

Respond in this format:
SUBJECT: [subject line using {{firstName}} if appropriate]
BODY: [email body with {{firstName}}, {{company}}, {{industry}} placeholders]`;

    const response = await fetch(`${ENV.forgeApiUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${ENV.forgeApiKey}` },
      body: JSON.stringify({ model: "claude-sonnet", messages: [{ role: "user", content: prompt }], max_tokens: 500 }),
    });
    const result = await response.json() as any;
    const text = result.choices?.[0]?.message?.content ?? "";
    const subjectMatch = text.match(/SUBJECT:\s*(.+)/i);
    const bodyMatch = text.match(/BODY:\s*([\s\S]+)/i);
    return {
      subject: subjectMatch?.[1]?.trim() ?? "",
      body: bodyMatch?.[1]?.trim() ?? text,
    };
  }),

  previewTemplate: protectedProcedure.input(z.object({
    subjectTemplate: z.string(),
    emailTemplate: z.string(),
    contactId: z.number().optional(),
  })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    // Get a sample contact (first contact or specified)
    let contact: any = null;
    if (input.contactId) {
      const [c] = await db.select().from(contacts).where(and(eq(contacts.id, input.contactId), eq(contacts.userId, ctx.user.id))).limit(1);
      contact = c;
    } else {
      const [c] = await db.select().from(contacts).where(eq(contacts.userId, ctx.user.id)).limit(1);
      contact = c;
    }
    const replaceVars = (text: string) => text
      .replace(/\{\{firstName\}\}/g, contact?.firstName ?? "Alex")
      .replace(/\{\{lastName\}\}/g, contact?.lastName ?? "Smith")
      .replace(/\{\{company\}\}/g, contact?.company ?? "Acme Corp")
      .replace(/\{\{industry\}\}/g, contact?.industry ?? "construction")
      .replace(/\{\{howWeMet\}\}/g, contact?.howWeMet ?? "the chamber event")
      .replace(/\{\{personalNotes\}\}/g, contact?.personalNotes ?? "");
    return {
      subject: replaceVars(input.subjectTemplate),
      body: replaceVars(input.emailTemplate),
      contactUsed: contact ? `${contact.firstName} ${contact.lastName ?? ""}`.trim() : "Sample Contact",
    };
  }),
});
