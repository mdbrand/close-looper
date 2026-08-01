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
