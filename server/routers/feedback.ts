import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../_core/trpc";
import * as db from "../db";
import { z } from "zod";

export const feedbackRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return db.getFeedbackRules(ctx.user.id, false);
  }),

  create: protectedProcedure
    .input(z.object({
      ruleType: z.enum(["phrase_replacement", "tone_adjustment", "fluff_removal"]),
      pattern: z.string().min(1),
      replacement: z.string(),
      confidence: z.number().min(0).max(100).default(50),
    }))
    .mutation(async ({ ctx, input }) => {
      const ruleId = await db.createFeedbackRule({
        userId: ctx.user.id,
        ruleType: input.ruleType,
        pattern: input.pattern,
        replacement: input.replacement,
        confidence: input.confidence,
      });
      return { id: ruleId };
    }),

  update: protectedProcedure
    .input(z.object({
      ruleId: z.number(),
      isActive: z.boolean().optional(),
      confidence: z.number().min(0).max(100).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await db.updateFeedbackRule(input.ruleId, ctx.user.id, {
        isActive: input.isActive,
        confidence: input.confidence,
      });
    }),

  delete: protectedProcedure
    .input(z.object({ ruleId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await db.deleteFeedbackRule(input.ruleId, ctx.user.id);
    }),

  captureEdit: protectedProcedure
    .input(z.object({
      draftId: z.number(),
      originalBody: z.string(),
      editedBody: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Simple diff: find the first difference
      const lines1 = input.originalBody.split("\n");
      const lines2 = input.editedBody.split("\n");
      
      for (let i = 0; i < Math.min(lines1.length, lines2.length); i++) {
        if (lines1[i] !== lines2[i]) {
          const pattern = lines1[i]?.trim() || "";
          const replacement = lines2[i]?.trim() || "";
          
          if (pattern && replacement && pattern !== replacement) {
            // Create a new rule with medium confidence (user can adjust)
            await db.createFeedbackRule({
              userId: ctx.user.id,
              ruleType: "phrase_replacement",
              pattern: pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), // escape regex chars
              replacement,
              confidence: 65, // medium confidence for learned rules
            });
          }
          break;
        }
      }
    }),
});
