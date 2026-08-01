import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerStorageProxy } from "./storageProxy";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { verifyGmailState } from "./crypto";
import { sdk } from "./sdk";
import { serveStatic, setupVite } from "./vite";
import { unsubscribeConfirmPage, unsubscribeDonePage } from "../unsubscribePage";
import { recordEmailOpen, getEmailDraftByTrackingId, upsertGmailAccount, createEmailEvent } from "../db";
import { generateDraftsHandler } from "../scheduled/generateDrafts";
import { checkRepliesHandler } from "../scheduled/checkReplies";
import { sendWeeklyDigestRouter } from "../scheduled/sendWeeklyDigest";
import { generateSequenceDraftsRouter } from "../scheduled/generateSequenceDrafts";
import { sendScheduledDraftsHandler } from "../scheduled/sendScheduledDrafts";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => { server.close(() => resolve(true)); });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) return port;
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  registerStorageProxy(app);
  registerOAuthRoutes(app);

  // ─── Open Tracking Pixel ──────────────────────────────────────────────────
  app.get("/api/track/:trackingId", async (req, res) => {
    const trackingId = req.params.trackingId.replace(".gif", "");
    const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ?? req.socket.remoteAddress ?? "";
    const userAgent = req.headers["user-agent"] ?? "";
    try { await recordEmailOpen(trackingId, ip, userAgent); } catch (_) { /* silent */ }
    const gif = Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64");
    res.set({ "Content-Type": "image/gif", "Cache-Control": "no-store, no-cache", "Pragma": "no-cache" });
    res.send(gif);
  });

  // ─── Unsubscribe ──────────────────────────────────────────────────────────
  // GET only *offers* to unsubscribe — it must never change anything.
  //
  // Mail security gateways (Proofpoint, Mimecast, Microsoft Safe Links) fetch
  // every URL in an inbound email before the recipient sees it. While this was
  // a state-changing GET, those scanners silently unsubscribed and paused real
  // contacts — invisible to both sides, and the exact outcome this product
  // exists to prevent. Scanners do not submit forms, so the action lives on
  // POST below.
  app.get("/api/unsubscribe/:trackingId", async (req, res) => {
    const { trackingId } = req.params;
    let senderLabel: string | null = null;
    try {
      const draft = await getEmailDraftByTrackingId(trackingId);
      if (draft) {
        const { getSenderLabel } = await import("../db");
        senderLabel = await getSenderLabel(draft.userId);
      }
    } catch (_) { /* the page renders fine without a name */ }
    // Never cached: the confirm page must not be served from a scanner's cache.
    res.set("Cache-Control", "no-store");
    res.send(unsubscribeConfirmPage(trackingId, senderLabel));
  });

  app.post("/api/unsubscribe/:trackingId", async (req, res) => {
    const { trackingId } = req.params;
    try {
      const draft = await getEmailDraftByTrackingId(trackingId);
      if (draft) {
        await createEmailEvent({ draftId: draft.id, eventType: "unsubscribed" });
        const { addToSuppressionList, getContact, updateContact } = await import("../db");
        const contact = await getContact(draft.contactId, draft.userId);
        if (contact?.email) {
          await addToSuppressionList(draft.userId, contact.email, "unsubscribed");
          await updateContact(draft.contactId, draft.userId, { loopStatus: "paused" });
        }
      }
    } catch (_) { /* silent: never tell the caller whether the id was real */ }
    res.set("Cache-Control", "no-store");
    res.send(unsubscribeDonePage());
  });

  // ─── Gmail OAuth Callback ─────────────────────────────────────────────────
  app.get("/api/gmail/callback", async (req, res) => {
    const { code, state, error } = req.query as Record<string, string>;
    if (error) return res.redirect(`/settings?gmailError=${encodeURIComponent(error)}`);
    if (!code || !state) return res.redirect("/settings?gmailError=missing_params");

    // Two independent checks, both required:
    //  1. the state must carry our HMAC, so the user id in it cannot be forged;
    //  2. it must match the session actually making this request, so a signed
    //     state captured from another user is useless.
    const verified = verifyGmailState(state);
    if (!verified) return res.redirect("/settings?gmailError=invalid_state");

    let sessionUserId: number;
    try {
      const sessionUser = await sdk.authenticateRequest(req);
      sessionUserId = sessionUser.id;
    } catch {
      return res.redirect("/settings?gmailError=not_signed_in");
    }
    if (sessionUserId !== verified.userId) {
      console.warn(
        `[Gmail OAuth] state/session mismatch: state=${verified.userId} session=${sessionUserId}`
      );
      return res.redirect("/settings?gmailError=invalid_state");
    }

    try {
      const { google } = await import("googleapis");
      const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        process.env.GOOGLE_REDIRECT_URI
      );
      const { tokens } = await oauth2Client.getToken(code);
      oauth2Client.setCredentials(tokens);
      const oauth2 = google.oauth2({ version: "v2", auth: oauth2Client });
      const { data: userInfo } = await oauth2.userinfo.get();
      const gmailAddress = userInfo.email;
      if (!gmailAddress) return res.redirect("/settings?gmailError=no_email");
      await upsertGmailAccount({
        userId: verified.userId,
        gmailAddress,
        accessToken: tokens.access_token ?? "",
        refreshToken: tokens.refresh_token ?? null,
        tokenExpiry: tokens.expiry_date ?? null,
        isDefault: false,
      });
      res.redirect("/settings?gmailSuccess=1&email=" + encodeURIComponent(gmailAddress));
    } catch (err: any) {
      console.error("[Gmail OAuth]", err);
      res.redirect(`/settings?gmailError=${encodeURIComponent((err as Error).message)}`);
    }
  });

  // ─── Scheduled Cron Handlers ─────────────────────────────────────────────
  app.post("/api/scheduled/generateDrafts", generateDraftsHandler);
  app.post("/api/scheduled/checkReplies", checkRepliesHandler);
  app.post("/api/scheduled/sendScheduledDrafts", sendScheduledDraftsHandler);
  app.use(sendWeeklyDigestRouter);
  app.use(generateSequenceDraftsRouter);

  // ─── tRPC API ─────────────────────────────────────────────────────────────
  app.use("/api/trpc", createExpressMiddleware({ router: appRouter, createContext }));

  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);
  if (port !== preferredPort) console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  server.listen(port, () => { console.log(`Server running on http://localhost:${port}/`); });
}

startServer().catch(console.error);
