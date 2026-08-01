import { eq } from "drizzle-orm";
import { senderProfiles } from "../../drizzle/schema";
import { protectedProcedure, router } from "../_core/trpc";
import * as db from "../db";

/**
 * Onboarding progress.
 *
 * Derived from data the user has already created rather than stored on a
 * column, so there is no new table, no migration, and no way for a stored flag
 * to disagree with reality. Disconnecting Gmail correctly reopens that step.
 *
 * "Skipped" is deliberately not tracked server-side — it is a client-side
 * preference about whether to show the wizard, not a fact about the account.
 */
export const onboardingRouter = router({
  status: protectedProcedure.query(async ({ ctx }) => {
    const [gmailAccounts, voiceProfile, contacts, database] = await Promise.all([
      db.getGmailAccounts(ctx.user.id),
      db.getVoiceProfile(ctx.user.id),
      db.getContacts(ctx.user.id),
      db.getDb(),
    ]);

    // The sender profile counts as done once it can actually feed the AI —
    // an empty row created by a stray save should not tick the box.
    let senderProfileComplete = false;
    if (database) {
      const [profile] = await database
        .select()
        .from(senderProfiles)
        .where(eq(senderProfiles.userId, ctx.user.id))
        .limit(1);
      senderProfileComplete = Boolean(profile?.companyName?.trim() && profile?.mainService?.trim());
    }

    const steps = {
      gmail: gmailAccounts.length > 0,
      senderProfile: senderProfileComplete,
      voice: Boolean(voiceProfile?.voiceSample?.trim()),
      contacts: contacts.length > 0,
    };

    const completedCount = Object.values(steps).filter(Boolean).length;
    const totalSteps = Object.keys(steps).length;

    return {
      steps,
      completedCount,
      totalSteps,
      isComplete: completedCount === totalSteps,
      contactCount: contacts.length,
      gmailAddress: gmailAccounts[0]?.gmailAddress ?? null,
    };
  }),
});
