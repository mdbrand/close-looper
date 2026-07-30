import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import * as db from "../db";

export const contactsRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return db.getContacts(ctx.user.id);
  }),

  get: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ ctx, input }) => {
    const contact = await db.getContact(input.id, ctx.user.id);
    if (!contact) throw new TRPCError({ code: "NOT_FOUND" });
    return contact;
  }),

  create: protectedProcedure.input(z.object({
    firstName: z.string().min(1),
    lastName: z.string().optional(),
    email: z.string().email(),
    phone: z.string().optional(),
    company: z.string().optional(),
    industry: z.string().optional(),
    relationshipType: z.enum(["referral_partner", "customer", "prospect", "other"]).default("referral_partner"),
    howWeMet: z.string().optional(),
    personalNotes: z.string().optional(),
    linkedinUrl: z.string().optional(),
    instagramUrl: z.string().optional(),
    facebookUrl: z.string().optional(),
    birthday: z.string().optional(),
    loopStatus: z.enum(["active", "paused", "archived"]).default("active"),
    sendFrequencyWeeks: z.number().int().min(1).max(52).default(4),
    tags: z.array(z.string()).optional(),
  })).mutation(async ({ ctx, input }) => {
    const id = await db.createContact({
      ...input,
      userId: ctx.user.id,
      tags: input.tags ? JSON.stringify(input.tags) : null,
    });
    return { id };
  }),

  update: protectedProcedure.input(z.object({
    id: z.number(),
    firstName: z.string().min(1).optional(),
    lastName: z.string().optional(),
    email: z.string().email().optional(),
    phone: z.string().optional(),
    company: z.string().optional(),
    industry: z.string().optional(),
    relationshipType: z.enum(["referral_partner", "customer", "prospect", "other"]).optional(),
    howWeMet: z.string().optional(),
    personalNotes: z.string().optional(),
    linkedinUrl: z.string().optional(),
    instagramUrl: z.string().optional(),
    facebookUrl: z.string().optional(),
    birthday: z.string().optional(),
    loopStatus: z.enum(["active", "paused", "archived"]).optional(),
    sendFrequencyWeeks: z.number().int().min(1).max(52).optional(),
    tags: z.array(z.string()).optional(),
  })).mutation(async ({ ctx, input }) => {
    const { id, tags, ...rest } = input;
    await db.updateContact(id, ctx.user.id, {
      ...rest,
      ...(tags !== undefined ? { tags: JSON.stringify(tags) } : {}),
    });
    return { success: true };
  }),

  delete: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
    await db.deleteContact(input.id, ctx.user.id);
    return { success: true };
  }),

  setLoopStatus: protectedProcedure.input(z.object({
    id: z.number(),
    status: z.enum(["active", "paused", "archived"]),
  })).mutation(async ({ ctx, input }) => {
    await db.updateContact(input.id, ctx.user.id, { loopStatus: input.status });
    return { success: true };
  }),
});
