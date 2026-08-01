import { getDb } from "./db";
import { sequences, sequenceSteps } from "../drizzle/schema";
import { eq, and } from "drizzle-orm";

export async function seedColdSequence(userId: number): Promise<{ sequenceId: number; stepsCreated: number }> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Check if user already has a cold sequence
  const existing = await db.select().from(sequences)
    .where(and(eq(sequences.userId, userId), eq(sequences.relationshipTier, "cold"), eq(sequences.isDefault, true)))
    .limit(1);

  if (existing[0]) {
    return { sequenceId: existing[0].id, stepsCreated: 0 };
  }

  // Create the sequence
  const [result] = await db.insert(sequences).values({
    userId,
    name: "Cold Relationship Sequence",
    description: "A 12-month sequence that turns a lawful public business contact into a familiar professional connection without pretending a prior relationship exists.",
    relationshipTier: "cold",
    totalSteps: 12,
    isDefault: true,
    isActive: true,
  });

  const sequenceId = result.insertId;

  const steps = [
    {
      stepNumber: 1,
      internalName: "First Impression",
      relationshipObjective: "Clearly explain who the sender is and why the recipient is receiving the message.",
      desiredRecipientThought: "This person found my business information and wanted to introduce themselves.",
      emailGuidance: "State that the sender came across the recipient's business information. Use the real contact source when available. Explain what the sender does in one or two sentences. Explain that the sender likes knowing other local professionals. Do not ask for a referral. Do not ask for a meeting. Do not imply they have met. Do not imply the recipient opted into a list. Give an easy opt-out.",
      suggestedClosing: "I wanted to introduce myself and open the door.",
      primaryCallToAction: "No action required.",
    },
    {
      stepNumber: 2,
      internalName: "Earn Trust",
      relationshipObjective: "Show that the sender runs a credible and dependable business.",
      desiredRecipientThought: "This appears to be a real and professional business.",
      emailGuidance: "Explain the main problem the sender solves. Mention the people the sender normally helps. Share one business standard. Avoid exaggerated claims. Avoid asking for business.",
      suggestedClosing: "If someone in my circle needs what you do, I will keep you in mind.",
      primaryCallToAction: "None.",
    },
    {
      stepNumber: 3,
      internalName: "Explain the Work",
      relationshipObjective: "Help the recipient understand when the sender may be useful.",
      desiredRecipientThought: "Now I understand what this person does.",
      emailGuidance: "Explain the main service in plain language. Describe one common reason someone contacts the sender. Describe an ideal referral without requesting one. Avoid industry jargon.",
      suggestedClosing: "That is usually the point when people reach out to us.",
      primaryCallToAction: "Invite simple questions.",
    },
    {
      stepNumber: 4,
      internalName: "Teach Something Useful",
      relationshipObjective: "Provide value without asking for anything.",
      desiredRecipientThought: "That was useful.",
      emailGuidance: "Share one practical tip. Make the tip useful today. Avoid turning the tip into a sales pitch. Keep the lesson focused on one point.",
      suggestedClosing: "I hope that saves you or someone you know a little trouble.",
      primaryCallToAction: "None.",
    },
    {
      stepNumber: 5,
      internalName: "Share Business Values",
      relationshipObjective: "Show what the sender believes good business should look like.",
      desiredRecipientThought: "I respect how this person approaches business.",
      emailGuidance: "Share one value. Explain why it matters. Include one short example. Possible values include honesty, clear updates, care, reliability, fair pricing, and ownership.",
      suggestedClosing: "That is the standard we try to bring to every job.",
      primaryCallToAction: "Ask what quality they value in a business relationship.",
    },
    {
      stepNumber: 6,
      internalName: "Share a Client Story",
      relationshipObjective: "Show proof through a brief client story.",
      desiredRecipientThought: "This person solves real problems.",
      emailGuidance: "Describe the client's problem. Explain what the sender did. Share the outcome. Protect private client details. Avoid inflated results. Focus on the problem and outcome.",
      suggestedClosing: "Small details often make the biggest difference.",
      primaryCallToAction: "None.",
    },
    {
      stepNumber: 7,
      internalName: "Be Human",
      relationshipObjective: "Help the recipient know the person behind the company.",
      desiredRecipientThought: "This feels like a real person.",
      emailGuidance: "Share a short personal or business lesson. Possible topics include family, sports, mistakes, learning, service, or community. Keep the message suitable for a business contact. Connect the lesson to how the sender treats people.",
      suggestedClosing: "Business gets better when people know the person behind the name.",
      primaryCallToAction: "An optional personal question.",
    },
    {
      stepNumber: 8,
      internalName: "Give First",
      relationshipObjective: "Provide a useful resource with no request in return.",
      desiredRecipientThought: "This person is helpful.",
      emailGuidance: "Share one checklist, guide, article, local resource, or useful contact. Explain why it may help. Allow no more than one link. Do not require a form. Do not gate the resource.",
      suggestedClosing: "No need to respond. I thought it was worth sharing.",
      primaryCallToAction: "View the resource.",
    },
    {
      stepNumber: 9,
      internalName: "Show Community Connection",
      relationshipObjective: "Show that the sender participates in the local business community.",
      desiredRecipientThought: "This person cares about the local community.",
      emailGuidance: "Share one local event, cause, group, or lesson. Do not include political messages. Do not exaggerate the sender's involvement. Mention the local area when useful. Support other local businesses.",
      suggestedClosing: "Strong local businesses make the whole community better.",
      primaryCallToAction: "Optional question about local events or groups.",
    },
    {
      stepNumber: 10,
      internalName: "Demonstrate Expertise",
      relationshipObjective: "Show knowledge without sounding superior.",
      desiredRecipientThought: "This person knows their work.",
      emailGuidance: "Explain one common mistake. Explain the possible cost or risk. Share a better approach. Avoid fear tactics. Do not attack competitors.",
      suggestedClosing: "Knowing what to look for can prevent bigger problems later.",
      primaryCallToAction: "Invite questions.",
    },
    {
      stepNumber: 11,
      internalName: "Express Appreciation",
      relationshipObjective: "Create goodwill and respect.",
      desiredRecipientThought: "This person seems thoughtful.",
      emailGuidance: "Thank the recipient for reading. Recognize the work involved in running a business. Do not claim an active relationship. Do not claim they supported or referred the sender. Keep the message short.",
      suggestedClosing: "I respect anyone working hard to serve their customers well.",
      primaryCallToAction: "None.",
    },
    {
      stepNumber: 12,
      internalName: "Open the Door",
      relationshipObjective: "Invite a real conversation after a year of thoughtful contact.",
      desiredRecipientThought: "I may be open to connecting with this person.",
      emailGuidance: "Mention that the sender has enjoyed sharing occasional messages. Invite a short call, coffee, or email exchange. State that there is no formal pitch. Explain that the purpose is to learn about each other's work. Make the invitation easy to decline.",
      suggestedClosing: "If it makes sense, I would enjoy learning more about your business.",
      primaryCallToAction: "Reply to arrange a short conversation.",
    },
  ];

  for (const step of steps) {
    await db.insert(sequenceSteps).values({
      sequenceId,
      ...step,
    });
  }

  return { sequenceId, stepsCreated: 12 };
}
