import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import * as db from "../db";

/**
 * Managing who this user may no longer email.
 *
 * Addresses land here when someone clicks Unsubscribe, or when mail bounces.
 * Until now that was a one-way door: nothing in the app could lift a
 * suppression, so an accidental click, or a partner who later said "put me back
 * on", meant editing the database by hand.
 *
 * Everything here is scoped to the owning user — a suppression describes one
 * sender's relationship with a recipient, not a global blocklist.
 */
export const suppressionRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return db.getSuppressionList(ctx.user.id);
  }),

  /**
   * Lifts a suppression and reactivates any matching paused contacts.
   *
   * Both effects are deliberate and are spelled out in the confirmation dialog:
   * lifting the block without resuming the loop would look like nothing
   * happened, but resuming silently would be worse — so the UI states plainly
   * that this address will start receiving mail again before it is called.
   */
  remove: protectedProcedure
    .input(z.object({ email: z.string().email() }))
    .mutation(async ({ ctx, input }) => {
      await db.removeFromSuppressionList(ctx.user.id, input.email);
      const reactivated = await db.reactivateContactsByEmail(ctx.user.id, input.email);
      return { success: true as const, reactivatedContacts: reactivated };
    }),
});
