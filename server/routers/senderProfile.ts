import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { senderProfiles } from "../../drizzle/schema";
import { eq } from "drizzle-orm";

export const senderProfileRouter = router({
  get: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return null;
    const result = await db.select().from(senderProfiles).where(eq(senderProfiles.userId, ctx.user.id)).limit(1);
    return result[0] ?? null;
  }),

  upsert: protectedProcedure
    .input(z.object({
      senderFirstName: z.string().optional(),
      senderLastName: z.string().optional(),
      companyName: z.string().optional(),
      industry: z.string().optional(),
      city: z.string().optional(),
      serviceArea: z.string().optional(),
      mainService: z.string().optional(),
      shortCompanyDescription: z.string().optional(),
      peopleNormallyHelped: z.string().optional(),
      mainProblemSolved: z.string().optional(),
      idealReferral: z.string().optional(),
      businessValues: z.string().optional(),
      clientSuccessStory: z.string().optional(),
      helpfulTip: z.string().optional(),
      helpfulResource: z.string().optional(),
      communityInvolvement: z.string().optional(),
      personalBusinessLesson: z.string().optional(),
      phone: z.string().optional(),
      website: z.string().optional(),
      linkedinUrl: z.string().optional(),
      mailingAddress: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const existing = await db.select().from(senderProfiles).where(eq(senderProfiles.userId, ctx.user.id)).limit(1);

      if (existing[0]) {
        await db.update(senderProfiles).set(input).where(eq(senderProfiles.userId, ctx.user.id));
      } else {
        await db.insert(senderProfiles).values({ userId: ctx.user.id, ...input });
      }

      return { success: true };
    }),
});
