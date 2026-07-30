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

export const appRouter = router({
  system: systemRouter,
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
});

export type AppRouter = typeof appRouter;

