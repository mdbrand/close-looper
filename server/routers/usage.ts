import { protectedProcedure, router } from "../_core/trpc";
import { getUsageStats } from "../usageTracker";

export const usageRouter = router({
  stats: protectedProcedure.query(async ({ ctx }) => {
    return getUsageStats(ctx.user.id);
  }),
});
