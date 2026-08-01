import { invokeLLM } from "./_core/llm";
import { logAiUsage } from "./usageTracker";
import type { AiVoiceProfile, Contact } from "../drizzle/schema";

/**
 * The one place the touchpoint email prompt lives.
 *
 * This prompt was previously duplicated verbatim between the drafts router and
 * the nightly cron. Tone is the product here — "sounds like me, not a
 * marketer" is the whole pitch — so two copies meant every tone change had to
 * be made twice, and would eventually be made once.
 */

export type GeneratedEmail = {
  subject: string;
  body: string;
  whyExplanation: string;
};

export function buildTouchpointPrompt(
  contact: Pick<Contact, "firstName" | "lastName" | "personalNotes" | "industry" | "company" | "howWeMet">,
  touchpointName: string,
  touchpointDescription: string,
  voiceProfile: Pick<AiVoiceProfile, "voiceSample" | "styleNotes"> | undefined | null
): string {
  const voiceContext = voiceProfile
    ? `Here is how the sender naturally writes/talks (match this voice exactly):\n"${voiceProfile.voiceSample}"\nStyle notes: ${voiceProfile.styleNotes ?? "casual, friendly, direct"}`
    : "Write in a casual, friendly, direct voice — like texting a friend.";

  const personalContext = [
    contact.personalNotes ? `Personal notes about them: ${contact.personalNotes}` : null,
    contact.industry ? `They work in: ${contact.industry}` : null,
    contact.company ? `Their company: ${contact.company}` : null,
    contact.howWeMet ? `How we met: ${contact.howWeMet}` : null,
  ].filter(Boolean).join("\n");

  return `You are writing a short, casual top-of-mind email from me to ${contact.firstName}${contact.lastName ? " " + contact.lastName : ""}.

The reason for the email is: ${touchpointName} — ${touchpointDescription}

${personalContext ? `Context about this person:\n${personalContext}\n` : ""}
${voiceContext}

Rules:
- 7th grade reading level — simple words, short sentences
- NO fluff, NO "I hope this email finds you well", NO corporate speak
- Sound like a real person dashing off a quick note, not a marketer
- 3-5 sentences max for the body
- The subject line should be short and feel personal (like a text preview), not a marketing headline
- End with something warm but brief — no long sign-offs
- Do NOT mention the holiday/event name awkwardly — weave it in naturally

Return JSON with exactly these fields:
{
  "subject": "short subject line here",
  "body": "full email body here (plain text, no HTML)",
  "whyExplanation": "one sentence explaining why this touchpoint was chosen for this contact"
}`;
}

const EMAIL_DRAFT_RESPONSE_FORMAT = {
  type: "json_schema" as const,
  json_schema: {
    name: "email_draft",
    strict: true,
    schema: {
      type: "object",
      properties: {
        subject: { type: "string" },
        body: { type: "string" },
        whyExplanation: { type: "string" },
      },
      required: ["subject", "body", "whyExplanation"],
      additionalProperties: false,
    },
  },
};

/** Generates a touchpoint email, then applies the user's learned edit rules. */
export async function generateTouchpointEmail(
  contact: Parameters<typeof buildTouchpointPrompt>[0],
  touchpointName: string,
  touchpointDescription: string,
  voiceProfile: Parameters<typeof buildTouchpointPrompt>[3],
  userId: number
): Promise<GeneratedEmail & { appliedRules: number[] }> {
  const response = await invokeLLM({
    messages: [
      {
        role: "user",
        content: buildTouchpointPrompt(contact, touchpointName, touchpointDescription, voiceProfile),
      },
    ],
    response_format: EMAIL_DRAFT_RESPONSE_FORMAT,
  });

  const rawContent = response.choices[0]?.message?.content;
  const content = typeof rawContent === "string" ? rawContent : null;
  if (!content) throw new Error("No response from AI");

  const generated = JSON.parse(content) as GeneratedEmail;

  // Log usage for credit tracking
  if (response.usage) {
    await logAiUsage({
      userId,
      action: "email_generation",
      model: response.model ?? null,
      promptTokens: response.usage.prompt_tokens,
      completionTokens: response.usage.completion_tokens,
      totalTokens: response.usage.total_tokens,
    });
  }

  // Apply the user's learned corrections. This step existed and was tested but
  // was never wired into either generation path, so every rule the Feedback
  // Rules page collected sat unused.
  const { applyFeedbackRules } = await import("./db");
  const { text, appliedRules } = await applyFeedbackRules(generated.body, userId);

  return { ...generated, body: text, appliedRules };
}
