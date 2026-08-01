import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../_core/trpc";
import * as db from "../db";
import { z } from "zod";

/** Bounds on what counts as a reusable phrase rather than a one-off rewrite. */
const MIN_PATTERN_LENGTH = 4;
const MAX_PATTERN_LENGTH = 80;
/**
 * A change spanning most of the draft is a rewrite, not a correction, however
 * short the draft happens to be. Length alone is not enough: a 90-character
 * pattern is a whole sentence when the draft is 90 characters long.
 */
const MAX_PATTERN_SHARE_OF_DRAFT = 0.75;

/**
 * Extracts the smallest phrase-level substitution between two drafts.
 *
 * Capture previously stored the entire changed *line* as the pattern. Rules are
 * matched literally against future drafts, and an LLM never emits the same
 * whole sentence twice, so those rules could essentially never fire — the
 * feature collected corrections that were guaranteed never to apply.
 *
 * Trimming to the changed span (expanded out to word boundaries) is what makes
 * a rule reusable: "Hope this email finds you well" is a phrase that recurs;
 * an entire rewritten paragraph is not. Whole-body rewrites teach nothing
 * generalisable, so they are deliberately not learned.
 */
export function extractSubstitution(
  before: string,
  after: string
): { pattern: string; replacement: string } | null {
  if (before === after) return null;

  const limit = Math.min(before.length, after.length);

  let start = 0;
  while (start < limit && before[start] === after[start]) start++;

  let end = 0;
  while (end < limit - start && before[before.length - 1 - end] === after[after.length - 1 - end]) end++;

  // Expand outward so we capture whole words, not word fragments.
  while (start > 0 && !/\s/.test(before[start - 1]!)) start--;
  while (end > 0 && !/\s/.test(before[before.length - end]!)) end--;

  const pattern = before.slice(start, before.length - end).trim();
  const replacement = after.slice(start, after.length - end).trim();

  if (!pattern || pattern === replacement) return null;
  if (pattern.length < MIN_PATTERN_LENGTH || pattern.length > MAX_PATTERN_LENGTH) return null;
  if (pattern.length > before.trim().length * MAX_PATTERN_SHARE_OF_DRAFT) return null;
  if (!/[a-z]/i.test(pattern)) return null;

  return { pattern, replacement };
}

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
      const substitution = extractSubstitution(input.originalBody, input.editedBody);
      if (!substitution) return { learned: false as const };

      await db.createFeedbackRule({
        userId: ctx.user.id,
        ruleType: "phrase_replacement",
        pattern: substitution.pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), // escape regex chars
        replacement: substitution.replacement,
        confidence: 65, // medium confidence for learned rules; user can adjust
      });
      return { learned: true as const, pattern: substitution.pattern };
    }),
});
