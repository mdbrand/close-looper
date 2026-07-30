import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
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
      state: String(ctx.user.id),
    });
    return { url };
  }),
});
