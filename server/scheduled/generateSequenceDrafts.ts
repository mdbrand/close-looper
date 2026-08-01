import { Router } from "express";
import { getDb } from "../db";
import { contactSequenceEnrollments, contacts, sequences, sequenceSteps, emailDrafts, senderProfiles, aiVoiceProfiles } from "../../drizzle/schema";
import { eq, and, lte, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { ENV } from "../_core/env";

export const generateSequenceDraftsRouter = Router();

generateSequenceDraftsRouter.post("/api/cron/generate-sequence-drafts", async (req, res) => {
  try {
    const db = await getDb();
    if (!db) return res.json({ success: false, error: "No database" });

    const now = new Date();

    // Find all active enrollments where nextSendAt <= now
    const dueEnrollments = await db.select().from(contactSequenceEnrollments)
      .where(and(
        eq(contactSequenceEnrollments.status, "active"),
        lte(contactSequenceEnrollments.nextSendAt, now)
      ));

    let generated = 0;

    for (const enrollment of dueEnrollments) {
      // Check no pending draft already exists for this enrollment
      const existingDraft = await db.select().from(emailDrafts)
        .where(and(
          eq(emailDrafts.sequenceEnrollmentId, enrollment.id),
          eq(emailDrafts.status, "pending")
        )).limit(1);
      if (existingDraft[0]) continue;

      // Get contact, sequence, step, sender profile, voice
      const [contact] = await db.select().from(contacts).where(eq(contacts.id, enrollment.contactId)).limit(1);
      if (!contact) continue;

      const [seq] = await db.select().from(sequences).where(eq(sequences.id, enrollment.sequenceId)).limit(1);
      if (!seq) continue;

      const [step] = await db.select().from(sequenceSteps)
        .where(and(eq(sequenceSteps.sequenceId, enrollment.sequenceId), eq(sequenceSteps.stepNumber, enrollment.currentStepNumber)))
        .limit(1);
      if (!step) continue;

      const [senderProfile] = await db.select().from(senderProfiles).where(eq(senderProfiles.userId, enrollment.userId)).limit(1);
      const [voiceProfile] = await db.select().from(aiVoiceProfiles).where(eq(aiVoiceProfiles.userId, enrollment.userId)).limit(1);

      // Build the AI prompt
      const senderInfo = senderProfile ? `
Sender: ${senderProfile.senderFirstName ?? ""} ${senderProfile.senderLastName ?? ""}
Company: ${senderProfile.companyName ?? ""}
Industry: ${senderProfile.industry ?? ""}
City: ${senderProfile.city ?? ""}
Service Area: ${senderProfile.serviceArea ?? ""}
Main Service: ${senderProfile.mainService ?? ""}
Description: ${senderProfile.shortCompanyDescription ?? ""}
People Helped: ${senderProfile.peopleNormallyHelped ?? ""}
Problem Solved: ${senderProfile.mainProblemSolved ?? ""}
Ideal Referral: ${senderProfile.idealReferral ?? ""}
Values: ${senderProfile.businessValues ?? ""}
Client Story: ${senderProfile.clientSuccessStory ?? ""}
Helpful Tip: ${senderProfile.helpfulTip ?? ""}
Helpful Resource: ${senderProfile.helpfulResource ?? ""}
Community: ${senderProfile.communityInvolvement ?? ""}
Personal Lesson: ${senderProfile.personalBusinessLesson ?? ""}` : "";

      const voiceInfo = voiceProfile ? `
Voice Style: ${voiceProfile.voiceSample ?? ""}
Style Notes: ${voiceProfile.styleNotes ?? ""}` : "";

      const contactSource = contact.contactSource ? `Contact was found via: ${contact.contactSource.replace(/_/g, " ")}${contact.sourceName ? ` (${contact.sourceName})` : ""}` : "I came across your business while looking through local companies in the area.";

      const prompt = `You are writing a relationship-building email. This is Step ${step.stepNumber} of a ${seq.totalSteps}-step sequence.

RELATIONSHIP OBJECTIVE: ${step.relationshipObjective}
DESIRED RECIPIENT THOUGHT: ${step.desiredRecipientThought ?? ""}
EMAIL GUIDANCE: ${step.emailGuidance}
SUGGESTED CLOSING: ${step.suggestedClosing ?? ""}
PRIMARY CALL TO ACTION: ${step.primaryCallToAction ?? "None"}

RECIPIENT:
Name: ${contact.firstName} ${contact.lastName ?? ""}
Company: ${contact.company ?? ""}
Industry: ${contact.industry ?? ""}
Notes: ${contact.personalNotes ?? ""}
Source: ${contactSource}

SENDER:${senderInfo}
${voiceInfo}

RULES:
- Use simple, natural language (7th grade reading level)
- Sound like one person writing to another
- Stay between ${step.minimumWordCount} and ${step.maximumWordCount} words
- Focus on the ONE relationship objective above
- NO sales pressure, NO fake familiarity, NO "just checking in"
- NO "touching base", NO "I hope this email finds you well"
- NO discounts, urgency, or multiple links
- Include a short subject line (5-8 words max)
- Include a soft closing
${step.stepNumber === 1 ? "- MUST state how the contact was found (use the Source above)" : ""}
- Never expose empty variables or broken tokens

Respond in this exact format:
SUBJECT: [subject line]
BODY: [email body]`;

      // Call LLM
      try {
        const response = await fetch(`${ENV.forgeApiUrl}/api/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${ENV.forgeApiKey}` },
          body: JSON.stringify({ model: "claude-sonnet", messages: [{ role: "user", content: prompt }], max_tokens: 500 }),
        });

        const result = await response.json() as any;
        const text = result.choices?.[0]?.message?.content ?? "";

        const subjectMatch = text.match(/SUBJECT:\s*(.+)/i);
        const bodyMatch = text.match(/BODY:\s*([\s\S]+)/i);

        const subject = subjectMatch?.[1]?.trim() ?? `Step ${step.stepNumber}: ${step.internalName}`;
        const body = bodyMatch?.[1]?.trim() ?? text;

        const trackingId = nanoid(32);
        const whyExplanation = `Sequence: ${seq.name} · Step ${step.stepNumber} · ${step.internalName} — ${step.relationshipObjective}`;

        await db.insert(emailDrafts).values({
          userId: enrollment.userId,
          contactId: enrollment.contactId,
          touchpointId: null,
          touchpointName: `${seq.name} - Step ${step.stepNumber}`,
          touchpointCategory: "relationship_sequence",
          sequenceStepId: step.id,
          sequenceEnrollmentId: enrollment.id,
          generationSource: "relationship_sequence",
          subject,
          body,
          whyExplanation,
          status: "pending",
          trackingId,
          scheduledSendAt: enrollment.nextSendAt,
        });

        generated++;
      } catch (llmErr) {
        console.error(`[SequenceDrafts] LLM error for enrollment ${enrollment.id}:`, llmErr);
      }
    }

    res.json({ success: true, generated, checked: dueEnrollments.length });
  } catch (err) {
    console.error("[SequenceDrafts] Error:", err);
    res.status(500).json({ success: false, error: String(err) });
  }
});
