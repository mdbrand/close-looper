import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { invokeLLM } from "../_core/llm";
import { TRPCError } from "@trpc/server";

export const scanRouter = router({
  extractContactFromImage: protectedProcedure
    .input(z.object({
      imageBase64: z.string(), // base64 encoded image
      mimeType: z.string().default("image/jpeg"),
    }))
    .mutation(async ({ input }) => {
      const dataUrl = `data:${input.mimeType};base64,${input.imageBase64}`;

      const result = await invokeLLM({
        model: "auto",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: { url: dataUrl, detail: "high" },
              },
              {
                type: "text",
                text: `Extract all contact information from this image (business card, flyer, or photo).
Return ONLY a JSON object with these exact fields (use null for missing fields):
{
  "firstName": string | null,
  "lastName": string | null,
  "email": string | null,
  "phone": string | null,
  "company": string | null,
  "industry": string | null,
  "linkedinUrl": string | null,
  "websiteUrl": string | null,
  "address": string | null,
  "title": string | null,
  "notes": string | null
}
Do not include any explanation or markdown. Return only the JSON object.`,
              },
            ],
          },
        ],
      });

      try {
        const rawContent = result.choices?.[0]?.message?.content ?? "";
        const text = typeof rawContent === "string" ? rawContent : JSON.stringify(rawContent);
        // Strip markdown code blocks if present
        const clean = text.replace(/^```json?\n?/, "").replace(/\n?```$/, "").trim();
        const parsed = JSON.parse(clean);
        // Auto-detect industry from company name if not found in image
        let industry = parsed.industry ?? "";
        if (!industry && parsed.company) {
          try {
            const industryResult = await invokeLLM({
              model: "auto",
              messages: [{
                role: "user",
                content: `Given the company name "${parsed.company}", what industry are they in? Reply with ONLY one of these exact values: construction, real_estate, healthcare, finance, marketing, legal, technology, education, other. No explanation.`
              }]
            });
            const raw = industryResult.choices?.[0]?.message?.content ?? "";
            const inferredIndustry = (typeof raw === "string" ? raw : "").trim().toLowerCase();
            const validIndustries = ["construction", "real_estate", "healthcare", "finance", "marketing", "legal", "technology", "education", "other"];
            if (validIndustries.includes(inferredIndustry)) industry = inferredIndustry;
          } catch { /* ignore industry detection failure */ }
        }
        return {
          success: true,
          data: {
            firstName: parsed.firstName ?? "",
            lastName: parsed.lastName ?? "",
            email: parsed.email ?? "",
            phone: parsed.phone ?? "",
            company: parsed.company ?? "",
            industry,
            linkedinUrl: parsed.linkedinUrl ?? "",
            notes: parsed.notes ?? (parsed.title ? `Title: ${parsed.title}` : ""),
            sourceUrl: parsed.websiteUrl ?? "",
          },
        };
      } catch (e) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Could not extract contact info from image. Try a clearer photo." });
      }
    }),
});
