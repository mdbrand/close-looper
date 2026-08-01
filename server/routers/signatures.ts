import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { emailSignatures } from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";

export const signaturesRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(emailSignatures).where(eq(emailSignatures.userId, ctx.user.id)).orderBy(emailSignatures.createdAt);
  }),

  create: protectedProcedure
    .input(z.object({ name: z.string(), content: z.string(), isDefault: z.boolean().optional() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      if (input.isDefault) {
        await db.update(emailSignatures).set({ isDefault: false }).where(eq(emailSignatures.userId, ctx.user.id));
      }
      await db.insert(emailSignatures).values({
        userId: ctx.user.id,
        name: input.name,
        content: input.content,
        isDefault: input.isDefault ?? false,
      });
      return { success: true };
    }),

  update: protectedProcedure
    .input(z.object({ id: z.number(), name: z.string().optional(), content: z.string().optional(), isDefault: z.boolean().optional() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { id, ...updates } = input;
      if (updates.isDefault) {
        await db.update(emailSignatures).set({ isDefault: false }).where(eq(emailSignatures.userId, ctx.user.id));
      }
      await db.update(emailSignatures).set(updates).where(and(eq(emailSignatures.id, id), eq(emailSignatures.userId, ctx.user.id)));
      return { success: true };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.delete(emailSignatures).where(and(eq(emailSignatures.id, input.id), eq(emailSignatures.userId, ctx.user.id)));
      return { success: true };
    }),

  getDefault: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return null;
    const result = await db.select().from(emailSignatures).where(and(eq(emailSignatures.userId, ctx.user.id), eq(emailSignatures.isDefault, true))).limit(1);
    return result[0] ?? null;
  }),
});

