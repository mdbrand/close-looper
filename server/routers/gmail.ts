import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { signGmailState } from "../_core/crypto";
import * as db from "../db";

export const gmailRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const accounts = await db.getGmailAccounts(ctx.user.id);
    // Never expose tokens to the client
    return accounts.map(({ accessToken, refreshToken, ...safe }) => safe);
  }),

  setDefault: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
    await db.setDefaultGmailAccount(input.id, ctx.user.id);
    return { success: true };
  }),

  disconnect: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
    await db.deleteGmailAccount(input.id, ctx.user.id);
    return { success: true };
  }),

  updateSenderName: protectedProcedure
    .input(z.object({ id: z.number(), senderName: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { getDb } = await import("../db");
      const database = await getDb();
      if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { gmailAccounts } = await import("../../drizzle/schema");
      const { eq, and } = await import("drizzle-orm");
      await database.update(gmailAccounts)
        .set({ senderName: input.senderName || null })
        .where(and(eq(gmailAccounts.id, input.id), eq(gmailAccounts.userId, ctx.user.id)));
      return { success: true };
    }),

  // Returns the OAuth URL for connecting a Gmail account
  getAuthUrl: protectedProcedure.query(async ({ ctx }) => {
    const { google } = await import("googleapis");
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI;
    if (!clientId || !clientSecret || !redirectUri) {
      throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Google OAuth credentials not configured" });
    }
    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
    const url = oauth2Client.generateAuthUrl({
      access_type: "offline",
      scope: [
        "https://www.googleapis.com/auth/gmail.send",
        "https://www.googleapis.com/auth/gmail.readonly",
        "https://www.googleapis.com/auth/userinfo.email",
      ],
      prompt: "consent",
      // Signed and short-lived. A bare user id here let anyone complete their
      // own Google consent and name someone else's account in the callback.
      state: signGmailState(ctx.user.id),
    });
    return { url };
  }),
});
