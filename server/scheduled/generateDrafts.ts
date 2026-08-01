import { Request, Response } from "express";
import { nanoid } from "nanoid";
import { notifyOwner } from "../_core/notification";
import * as db from "../db";
import { generateTouchpointEmail } from "../generateEmail";

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

    // Touchpoints are global, so they are fetched once for the whole run
    // rather than once per user.
    const touchpoints = await db.getTouchpoints();

    for (const dbUser of allUsers) {
      const contacts = await db.getActiveContactsForCron(dbUser.id);
      const voiceProfile = await db.getVoiceProfile(dbUser.id);

      // Fetched once per user. This used to run inside the contact loop, so a
      // user with N contacts issued N full scans of their own pending drafts.
      const pendingDrafts = await db.getEmailDrafts(dbUser.id, "pending");
      const contactsWithPendingDraft = new Set(pendingDrafts.map(d => d.contactId));

      for (const contact of contacts) {
        // Check if contact is due for a touch (based on sendFrequencyWeeks)
        const now = new Date();
        const lastTouch = contact.lastTouchSentAt;
        const weeksSinceLast = lastTouch
          ? (now.getTime() - lastTouch.getTime()) / (1000 * 60 * 60 * 24 * 7)
          : Infinity;

        if (weeksSinceLast < contact.sendFrequencyWeeks) continue; // Not due yet

        if (contactsWithPendingDraft.has(contact.id)) continue;

        // Pick a touchpoint
        const picked = pickTouchpoint(touchpoints, contact);
        if (!picked) continue;

        const { tp, date } = picked;

        // Generate the email with AI
        try {
          const generated = await generateTouchpointEmail(
            contact,
            tp.name,
            tp.description ?? tp.name,
            voiceProfile,
            dbUser.id
          );
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

          contactsWithPendingDraft.add(contact.id);
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
    // Stack traces stay in the logs, not in the HTTP response.
    res.status(500).json({ error: "generateDrafts failed", timestamp: new Date().toISOString() });
  }
}
