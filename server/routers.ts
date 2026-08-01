import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { contactsRouter } from "./routers/contacts";
import { gmailRouter } from "./routers/gmail";
import { touchpointsRouter } from "./routers/touchpoints";
import { draftsRouter } from "./routers/drafts";
import { analyticsRouter } from "./routers/analytics";
import { voiceRouter } from "./routers/voice";
import { feedbackRouter } from "./routers/feedback";
import { importExportRouter } from "./routers/import-export";
import { digestRouter } from "./routers/digest";
import { snoozeRouter } from "./routers/snooze";
import { signaturesRouter } from "./routers/signatures";
import { senderProfileRouter } from "./routers/senderProfile";
import { publicRouter, adminRouter } from "./routers/public";
import { onboardingRouter } from "./routers/onboarding";

export const appRouter = router({
  system: systemRouter,
  public: publicRouter,
  admin: adminRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  contacts: contactsRouter,
  gmail: gmailRouter,
  touchpoints: touchpointsRouter,
  drafts: draftsRouter,
  analytics: analyticsRouter,
  voice: voiceRouter,
  feedback: feedbackRouter,
  importExport: importExportRouter,
  digest: digestRouter,
  snooze: snoozeRouter,
  signatures: signaturesRouter,
  senderProfile: senderProfileRouter,
  sequences: sequencesRouter,
  scan: scanRouter,
  onboarding: onboardingRouter,
});

export type AppRouter = typeof appRouter;
import { sequencesRouter } from "./routers/sequences";
import { scanRouter } from "./routers/scan";
