import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import * as db from "../db";
import { TOUCHPOINTS_SEED } from "../touchpoints-seed";

export const touchpointsRouter = router({
  list: protectedProcedure.query(async () => {
    return db.getTouchpoints();
  }),

  listByIndustry: protectedProcedure.input(z.object({ industry: z.string() })).query(async ({ input }) => {
    return db.getTouchpointsByIndustry(input.industry);
  }),

  // Seed all touchpoints (admin action, run once)
  seed: protectedProcedure.mutation(async () => {
    for (const tp of TOUCHPOINTS_SEED) {
      await db.createTouchpoint(tp);
    }
    return { seeded: TOUCHPOINTS_SEED.length };
  }),

  // Get upcoming touchpoints for a contact (next 60 days)
  upcoming: protectedProcedure.input(z.object({ contactId: z.number() })).query(async ({ ctx, input }) => {
    const contact = await db.getContact(input.contactId, ctx.user.id);
    if (!contact) return [];
    const allTouchpoints = await db.getTouchpoints();
    const now = new Date();
    const upcoming: Array<{ touchpoint: typeof allTouchpoints[0]; date: Date }> = [];
    for (const tp of allTouchpoints) {
      if (tp.industryTag && tp.industryTag !== contact.industry) continue;
      if (tp.monthDay) {
        const [month, day] = tp.monthDay.split("-").map(Number);
        const thisYear = new Date(now.getFullYear(), month - 1, day);
        const nextYear = new Date(now.getFullYear() + 1, month - 1, day);
        const target = thisYear > now ? thisYear : nextYear;
        const daysAway = Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        if (daysAway <= 60) upcoming.push({ touchpoint: tp, date: target });
      }
    }
    return upcoming.sort((a, b) => a.date.getTime() - b.date.getTime()).slice(0, 10);
  }),
});
