import { protectedProcedure, router } from "../_core/trpc";
import * as db from "../db";
import { z } from "zod";

export const snoozeRouter = router({
  snoozeContact: protectedProcedure
    .input(z.object({
      contactId: z.number(),
      durationDays: z.enum(["7", "14", "30"]).transform(v => parseInt(v)),
    }))
    .mutation(async ({ ctx, input }) => {
      const contact = await db.getContact(input.contactId, ctx.user.id);
      if (!contact) throw new Error("Contact not found");

      const snoozeUntil = new Date();
      snoozeUntil.setDate(snoozeUntil.getDate() + input.durationDays);

      await db.updateContact(input.contactId, ctx.user.id, { snoozeUntil });
      return { success: true, snoozeUntil, durationDays: input.durationDays };
    }),

  unsnoozeContact: protectedProcedure
    .input(z.object({ contactId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const contact = await db.getContact(input.contactId, ctx.user.id);
      if (!contact) throw new Error("Contact not found");

      await db.updateContact(input.contactId, ctx.user.id, { snoozeUntil: null });
      return { success: true };
    }),

  getSnoozeStatus: protectedProcedure
    .input(z.object({ contactId: z.number() }))
    .query(async ({ ctx, input }) => {
      const contact = await db.getContact(input.contactId, ctx.user.id);
      if (!contact) throw new Error("Contact not found");

      if (!contact.snoozeUntil) {
        return { isSnoozed: false, snoozeUntil: null, daysRemaining: 0 };
      }

      const now = new Date();
      const snoozeDate = new Date(contact.snoozeUntil);
      const daysRemaining = Math.ceil((snoozeDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      const isSnoozed = daysRemaining > 0;

      return { isSnoozed, snoozeUntil: contact.snoozeUntil, daysRemaining };
    }),
});
