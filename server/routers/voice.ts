import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { invokeLLM } from "../_core/llm";
import * as db from "../db";

export const voiceRouter = router({
  get: protectedProcedure.query(async ({ ctx }) => {
    return db.getVoiceProfile(ctx.user.id);
  }),

  save: protectedProcedure.input(z.object({
    voiceSample: z.string().min(20, "Please write at least a few sentences"),
    styleNotes: z.string().optional(),
  })).mutation(async ({ ctx, input }) => {
    // Ask the AI to analyze the voice sample and extract style notes
    const analysisPrompt = `Analyze this writing sample and describe the author's communication style in 2-3 sentences. Focus on: tone, vocabulary level, sentence length, personality, and any distinctive patterns. Be specific and concise.

Writing sample:
"${input.voiceSample}"`;

    const analysis = await invokeLLM({
      messages: [{ role: "user", content: analysisPrompt }],
    });
    const rawAnalysis = analysis.choices[0]?.message?.content;
    const styleNotes = (typeof rawAnalysis === "string" ? rawAnalysis : null) ?? input.styleNotes ?? "";

    await db.upsertVoiceProfile({
      userId: ctx.user.id,
      voiceSample: input.voiceSample,
      styleNotes: input.styleNotes ?? styleNotes,
    });
    return { success: true, styleNotes };
  }),

  previewEmail: protectedProcedure.input(z.object({
    voiceSample: z.string(),
  })).mutation(async ({ ctx, input }) => {
    const prompt = `Based on this writing style, write a very short (2-3 sentence) example email saying "Happy National Coffee Day" to a business contact named Alex. Match the voice exactly.

Voice sample: "${input.voiceSample}"`;
    const response = await invokeLLM({
      messages: [{ role: "user", content: prompt }],
    });
    const rawPreview = response.choices[0]?.message?.content;
    return { preview: typeof rawPreview === "string" ? rawPreview : "" };
  }),
});
