import { bigint, boolean, int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ─── AI Voice Profile ────────────────────────────────────────────────────────
export const aiVoiceProfiles = mysqlTable("ai_voice_profiles", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  voiceSample: text("voiceSample").notNull(),
  styleNotes: text("styleNotes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type AiVoiceProfile = typeof aiVoiceProfiles.$inferSelect;
export type InsertAiVoiceProfile = typeof aiVoiceProfiles.$inferInsert;

// ─── Gmail Accounts ──────────────────────────────────────────────────────────
export const gmailAccounts = mysqlTable("gmail_accounts", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  gmailAddress: varchar("gmailAddress", { length: 320 }).notNull(),
  senderName: varchar("senderName", { length: 200 }),
  accessToken: text("accessToken").notNull(),
  refreshToken: text("refreshToken"),
  tokenExpiry: bigint("tokenExpiry", { mode: "number" }),
  isDefault: boolean("isDefault").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type GmailAccount = typeof gmailAccounts.$inferSelect;
export type InsertGmailAccount = typeof gmailAccounts.$inferInsert;

// ─── Contacts ────────────────────────────────────────────────────────────────
export const contacts = mysqlTable("contacts", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  firstName: varchar("firstName", { length: 100 }).notNull(),
  lastName: varchar("lastName", { length: 100 }),
  email: varchar("email", { length: 320 }).notNull(),
  phone: varchar("phone", { length: 30 }),
  company: varchar("company", { length: 200 }),
  industry: varchar("industry", { length: 100 }),
  relationshipType: mysqlEnum("relationshipType", ["referral_partner", "customer", "prospect", "other"]).default("referral_partner").notNull(),
  howWeMet: text("howWeMet"),
  personalNotes: text("personalNotes"),
  linkedinUrl: varchar("linkedinUrl", { length: 500 }),
  instagramUrl: varchar("instagramUrl", { length: 500 }),
  facebookUrl: varchar("facebookUrl", { length: 500 }),
  birthday: varchar("birthday", { length: 10 }), // MM-DD format
  loopStatus: mysqlEnum("loopStatus", ["active", "paused", "archived"]).default("active").notNull(),
  sendFrequencyWeeks: int("sendFrequencyWeeks").default(4).notNull(), // weeks between touches
  tags: text("tags"), // JSON array of strings
  lastTouchSentAt: timestamp("lastTouchSentAt"),
  nextTouchScheduledAt: timestamp("nextTouchScheduledAt"),
  snoozeUntil: timestamp("snoozeUntil"), // null = not snoozed, timestamp = resume date
  signatureId: int("signatureId"),
  relationshipTier: mysqlEnum("relationshipTier", ["cold", "warm", "hot"]).default("warm").notNull(),
  loopType: mysqlEnum("loopType", ["relationship_sequence", "flexible_touchpoints", "manual", "none"]).default("flexible_touchpoints").notNull(),
  contactSource: varchar("contactSource", { length: 100 }),
  sourceName: varchar("sourceName", { length: 200 }),
  sourceLocation: varchar("sourceLocation", { length: 300 }),
  sourceUrl: varchar("sourceUrl", { length: 500 }),
  dateFoundOrMet: varchar("dateFoundOrMet", { length: 20 }),
  permissionNote: text("permissionNote"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Contact = typeof contacts.$inferSelect;
export type InsertContact = typeof contacts.$inferInsert;

// ─── Touchpoints ─────────────────────────────────────────────────────────────
export const touchpoints = mysqlTable("touchpoints", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 200 }).notNull(),
  description: text("description"),
  category: mysqlEnum("category", ["federal_holiday", "quirky_holiday", "industry_specific", "personal_milestone"]).notNull(),
  industryTag: varchar("industryTag", { length: 100 }), // for industry_specific category
  monthDay: varchar("monthDay", { length: 5 }), // MM-DD for recurring annual dates
  specificDate: varchar("specificDate", { length: 10 }), // YYYY-MM-DD for one-time dates
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Touchpoint = typeof touchpoints.$inferSelect;
export type InsertTouchpoint = typeof touchpoints.$inferInsert;

// ─── Email Drafts ─────────────────────────────────────────────────────────────
export const emailDrafts = mysqlTable("email_drafts", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  contactId: int("contactId").notNull(),
  touchpointId: int("touchpointId"),
  touchpointName: varchar("touchpointName", { length: 200 }), // snapshot at generation time
  touchpointCategory: varchar("touchpointCategory", { length: 50 }),
  sequenceStepId: int("sequenceStepId"),
  sequenceEnrollmentId: int("sequenceEnrollmentId"),
  generationSource: mysqlEnum("generationSource", ["relationship_sequence", "flexible_touchpoint", "manual"]).default("flexible_touchpoint").notNull(),
  gmailAccountId: int("gmailAccountId"), // which gmail account to send from
  subject: varchar("subject", { length: 500 }).notNull(),
  body: text("body").notNull(),
  whyExplanation: varchar("whyExplanation", { length: 500 }).notNull(),
  status: mysqlEnum("status", ["pending", "approved", "sent", "skipped", "failed"]).default("pending").notNull(),
  scheduledSendAt: timestamp("scheduledSendAt"),
  sentAt: timestamp("sentAt"),
  gmailMessageId: varchar("gmailMessageId", { length: 200 }), // Gmail message ID for reply detection
  trackingId: varchar("trackingId", { length: 64 }).notNull(), // unique ID for open tracking pixel
  openCount: int("openCount").default(0).notNull(),
  firstOpenedAt: timestamp("firstOpenedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type EmailDraft = typeof emailDrafts.$inferSelect;
export type InsertEmailDraft = typeof emailDrafts.$inferInsert;

// ─── Email Events ─────────────────────────────────────────────────────────────
export const emailEvents = mysqlTable("email_events", {
  id: int("id").autoincrement().primaryKey(),
  draftId: int("draftId").notNull(),
  eventType: mysqlEnum("eventType", ["sent", "opened", "bounced", "replied", "unsubscribed"]).notNull(),
  occurredAt: timestamp("occurredAt").defaultNow().notNull(),
  ipAddress: varchar("ipAddress", { length: 45 }),
  userAgent: text("userAgent"),
});

export type EmailEvent = typeof emailEvents.$inferSelect;
export type InsertEmailEvent = typeof emailEvents.$inferInsert;

// ─── Feedback Rules ──────────────────────────────────────────────────────────
/**
 * Feedback rules table — stores learned corrections from user edits
 * When a user edits a draft, the system extracts the pattern and stores it as a rule
 * Future emails are checked against these rules and corrected automatically
 */
export const feedbackRules = mysqlTable("feedback_rules", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  ruleType: varchar("ruleType", { length: 50 }).notNull(), // "phrase_replacement", "tone_adjustment", "fluff_removal"
  pattern: text("pattern").notNull(), // the phrase/pattern to match
  replacement: text("replacement").notNull(), // what to replace it with
  confidence: int("confidence").default(50).notNull(), // 0-100, how confident we are in this rule
  appliedCount: int("appliedCount").default(0).notNull(), // how many times this rule has been applied
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type FeedbackRule = typeof feedbackRules.$inferSelect;
export type InsertFeedbackRule = typeof feedbackRules.$inferInsert;

// ─── Import Batches ─────────────────────────────────────────────────────────
export const importBatches = mysqlTable("import_batches", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  filename: varchar("filename", { length: 500 }),
  contactCount: int("contactCount").default(0).notNull(),
  contactIds: text("contactIds"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ImportBatch = typeof importBatches.$inferSelect;
export type InsertImportBatch = typeof importBatches.$inferInsert;

// ─── Email Signatures ────────────────────────────────────────────────────────
export const emailSignatures = mysqlTable("email_signatures", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  name: varchar("name", { length: 200 }).notNull(),
  content: text("content").notNull(),
  isDefault: boolean("isDefault").default(false).notNull(),
  sendCount: int("sendCount").default(0).notNull(),
  replyCount: int("replyCount").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type EmailSignature = typeof emailSignatures.$inferSelect;
export type InsertEmailSignature = typeof emailSignatures.$inferInsert;

// ─── Sequences ──────────────────────────────────────────────────────────────
export const sequences = mysqlTable("sequences", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  name: varchar("name", { length: 300 }).notNull(),
  description: text("description"),
  relationshipTier: mysqlEnum("relationshipTier", ["cold", "warm", "hot"]).default("cold").notNull(),
  totalSteps: int("totalSteps").default(0).notNull(),
  isDefault: boolean("isDefault").default(false).notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Sequence = typeof sequences.$inferSelect;
export type InsertSequence = typeof sequences.$inferInsert;

// ─── Sequence Steps ─────────────────────────────────────────────────────────
export const sequenceSteps = mysqlTable("sequence_steps", {
  id: int("id").autoincrement().primaryKey(),
  sequenceId: int("sequenceId").notNull(),
  stepNumber: int("stepNumber").notNull(),
  internalName: varchar("internalName", { length: 200 }).notNull(),
  relationshipObjective: text("relationshipObjective").notNull(),
  desiredRecipientThought: text("desiredRecipientThought"),
  emailGuidance: text("emailGuidance").notNull(),
  suggestedClosing: text("suggestedClosing"),
  primaryCallToAction: text("primaryCallToAction"),
  minimumWordCount: int("minimumWordCount").default(75).notNull(),
  maximumWordCount: int("maximumWordCount").default(150).notNull(),
  delayMonths: int("delayMonths").default(1).notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type SequenceStep = typeof sequenceSteps.$inferSelect;
export type InsertSequenceStep = typeof sequenceSteps.$inferInsert;

// ─── Contact Sequence Enrollments ───────────────────────────────────────────
export const contactSequenceEnrollments = mysqlTable("contact_sequence_enrollments", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  contactId: int("contactId").notNull(),
  sequenceId: int("sequenceId").notNull(),
  currentStepNumber: int("currentStepNumber").default(1).notNull(),
  status: mysqlEnum("status", ["active", "paused", "completed", "cancelled"]).default("active").notNull(),
  enrolledAt: timestamp("enrolledAt").defaultNow().notNull(),
  nextSendAt: timestamp("nextSendAt"),
  completedAt: timestamp("completedAt"),
  pausedAt: timestamp("pausedAt"),
  pauseReason: text("pauseReason"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ContactSequenceEnrollment = typeof contactSequenceEnrollments.$inferSelect;
export type InsertContactSequenceEnrollment = typeof contactSequenceEnrollments.$inferInsert;

// ─── Sender Profile ─────────────────────────────────────────────────────────
export const senderProfiles = mysqlTable("sender_profiles", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  senderFirstName: varchar("senderFirstName", { length: 100 }),
  senderLastName: varchar("senderLastName", { length: 100 }),
  companyName: varchar("companyName", { length: 300 }),
  industry: varchar("industry", { length: 200 }),
  city: varchar("city", { length: 200 }),
  serviceArea: varchar("serviceArea", { length: 300 }),
  mainService: text("mainService"),
  shortCompanyDescription: text("shortCompanyDescription"),
  peopleNormallyHelped: text("peopleNormallyHelped"),
  mainProblemSolved: text("mainProblemSolved"),
  idealReferral: text("idealReferral"),
  businessValues: text("businessValues"),
  clientSuccessStory: text("clientSuccessStory"),
  helpfulTip: text("helpfulTip"),
  helpfulResource: text("helpfulResource"),
  communityInvolvement: text("communityInvolvement"),
  personalBusinessLesson: text("personalBusinessLesson"),
  phone: varchar("phone", { length: 30 }),
  website: varchar("website", { length: 500 }),
  linkedinUrl: varchar("linkedinUrl", { length: 500 }),
  mailingAddress: text("mailingAddress"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type SenderProfile = typeof senderProfiles.$inferSelect;
export type InsertSenderProfile = typeof senderProfiles.$inferInsert;

// ─── Suppression List ──────────────────────────────────────────────────────
export const suppressionList = mysqlTable("suppression_list", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  email: varchar("email", { length: 320 }).notNull(),
  reason: mysqlEnum("reason", ["unsubscribed", "bounced", "blocked"]).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type SuppressionEntry = typeof suppressionList.$inferSelect;
export type InsertSuppressionEntry = typeof suppressionList.$inferInsert;
