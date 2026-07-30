import { Request, Response } from "express";
import { nanoid } from "nanoid";
import { invokeLLM } from "../_core/llm";
import { notifyOwner } from "../_core/notification";
import * as db from "../db";

// Picks the best upcoming touchpoint for a contact based on their industry and upcoming dates
function pickTouchpoint(touchpoints: Awaited<ReturnType<typeof db.getTouchpoints>>, contact: Awaited<ReturnType<typeof db.getContact>>) {
  if (!contact) return null;
  const now = new Date();
  const in60Days = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);

  // Prefer industry-specific touchpoints for this contact's industry
  const industryTps = contact.industry
    ? touchpoints.filter(tp => tp.industryTag === contact.industry && tp.monthDay)
    : [];
  const generalTps = touchpoints.filter(tp => !tp.industryTag && tp.monthDay);
  const candidates = [...industryTps, ...generalTps];

  // Find the next one coming up in the next 60 days
  for (const tp of candidates) {
    if (!tp.monthDay) continue;
    const [month, day] = tp.monthDay.split("-").map(Number);
    const thisYear = new Date(now.getFullYear(), month - 1, day);
    const target = thisYear > now ? thisYear : new Date(now.getFullYear() + 1, month - 1, day);
    if (target <= in60Days) return { tp, date: target };
  }

  // Fallback: pick a random quirky holiday
  const quirky = touchpoints.filter(tp => tp.category === "quirky_holiday");
  if (quirky.length > 0) {
    const tp = quirky[Math.floor(Math.random() * quirky.length)];
    return { tp, date: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000) };
  }
  return null;
}

export async function generateDraftsHandler(req: Request, res: Response) {
  try {
    const { sdk } = await import("../_core/sdk");
    const user = await sdk.authenticateRequest(req);
    if (!user.isCron) return res.status(403).json({ error: "cron-only" });

    console.log("[Cron] generateDrafts triggered, taskUid:", user.taskUid);

    // Get all users (for now, process the owner — expand later for multi-user)
    const allDb = await db.getDb();
    if (!allDb) return res.json({ ok: true, skipped: "no-db" });

    const { users } = await import("../../drizzle/schema");
    const allUsers = await allDb.select().from(users);

    let totalGenerated = 0;

    for (const dbUser of allUsers) {
      const contacts = await db.getActiveContactsForCron(dbUser.id);
      const touchpoints = await db.getTouchpoints();
      const voiceProfile = await db.getVoiceProfile(dbUser.id);

      for (const contact of contacts) {
        // Check if contact is due for a touch (based on sendFrequencyWeeks)
        const now = new Date();
        const lastTouch = contact.lastTouchSentAt;
        const weeksSinceLast = lastTouch
          ? (now.getTime() - lastTouch.getTime()) / (1000 * 60 * 60 * 24 * 7)
          : Infinity;

        if (weeksSinceLast < contact.sendFrequencyWeeks) continue; // Not due yet

        // Check if there's already a pending draft for this contact
        const existingDrafts = await db.getEmailDrafts(dbUser.id, "pending");
        const hasExisting = existingDrafts.some(d => d.contactId === contact.id);
        if (hasExisting) continue;

        // Pick a touchpoint
        const picked = pickTouchpoint(touchpoints, contact);
        if (!picked) continue;

        const { tp, date } = picked;

        // Generate the email with AI
        try {
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

The reason for the email is: ${tp.name} — ${tp.description ?? tp.name}

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
          if (!content) continue;
          const generated = JSON.parse(content);
          const trackingId = nanoid(32);

          await db.createEmailDraft({
            userId: dbUser.id,
            contactId: contact.id,
            touchpointId: tp.id,
            touchpointName: tp.name,
            touchpointCategory: tp.category,
            subject: generated.subject,
            body: generated.body,
            whyExplanation: generated.whyExplanation,
            trackingId,
            status: "pending",
            scheduledSendAt: date,
          });

          totalGenerated++;
        } catch (err) {
          console.error(`[Cron] Failed to generate draft for contact ${contact.id}:`, err);
        }
      }
    }

    if (totalGenerated > 0) {
      await notifyOwner({
        title: "Close Looper: New Drafts Ready",
        content: `${totalGenerated} new email draft${totalGenerated !== 1 ? "s" : ""} have been generated and are waiting in your Approval Queue.`,
      });
    }

    console.log(`[Cron] generateDrafts complete. Generated: ${totalGenerated}`);
    res.json({ ok: true, generated: totalGenerated });
  } catch (err: any) {
    console.error("[Cron] generateDrafts error:", err);
    res.status(500).json({ error: err.message, stack: err.stack, timestamp: new Date().toISOString() });
  }
}
