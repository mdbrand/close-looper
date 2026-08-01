import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { decryptSecret, encryptSecret } from "./_core/crypto";
import {
  AiVoiceProfile,
  Contact,
  EmailDraft,
  EmailEvent,
  FeedbackRule,
  GmailAccount,
  InsertAiVoiceProfile,
  InsertContact,
  InsertEmailDraft,
  InsertEmailEvent,
  InsertFeedbackRule,
  InsertGmailAccount,
  InsertTouchpoint,
  InsertUser,
  Touchpoint,
  aiVoiceProfiles,
  contacts,
  emailDrafts,
  emailEvents,
  feedbackRules,
  gmailAccounts,
  touchpoints,
  users,
} from "../drizzle/schema";
import { senderProfiles, suppressionList } from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ─── Users ────────────────────────────────────────────────────────────────────
export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) { console.warn("[Database] Cannot upsert user: database not available"); return; }
  try {
    const values: InsertUser = { openId: user.openId };
    const updateSet: Record<string, unknown> = {};
    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];
    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };
    textFields.forEach(assignNullable);
    if (user.lastSignedIn !== undefined) { values.lastSignedIn = user.lastSignedIn; updateSet.lastSignedIn = user.lastSignedIn; }
    if (user.role !== undefined) { values.role = user.role; updateSet.role = user.role; }
    else if (user.openId === ENV.ownerOpenId) { values.role = "admin"; updateSet.role = "admin"; }
    if (!values.lastSignedIn) values.lastSignedIn = new Date();
    if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();
    await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
  } catch (error) { console.error("[Database] Failed to upsert user:", error); throw error; }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ─── AI Voice Profile ─────────────────────────────────────────────────────────
export async function getVoiceProfile(userId: number): Promise<AiVoiceProfile | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(aiVoiceProfiles).where(eq(aiVoiceProfiles.userId, userId)).limit(1);
  return result[0];
}

export async function upsertVoiceProfile(data: InsertAiVoiceProfile): Promise<void> {
  const db = await getDb();
  if (!db) return;
  const existing = await getVoiceProfile(data.userId);
  if (existing) {
    await db.update(aiVoiceProfiles).set({ voiceSample: data.voiceSample, styleNotes: data.styleNotes }).where(eq(aiVoiceProfiles.userId, data.userId));
  } else {
    await db.insert(aiVoiceProfiles).values(data);
  }
}

// ─── Gmail Accounts ───────────────────────────────────────────────────────────

/**
 * Decrypts the OAuth tokens on a row read back from storage.
 *
 * Decryption failure (rotated JWT_SECRET, tampered row) blanks the tokens
 * rather than throwing, so listing accounts still works. The send path checks
 * for an empty access token and asks the user to reconnect Gmail.
 */
function decryptAccountTokens(account: GmailAccount): GmailAccount {
  try {
    return {
      ...account,
      accessToken: decryptSecret(account.accessToken),
      refreshToken: account.refreshToken ? decryptSecret(account.refreshToken) : account.refreshToken,
    };
  } catch (error) {
    console.error(`[Database] Failed to decrypt tokens for gmail account ${account.id}:`, error);
    return { ...account, accessToken: "", refreshToken: null };
  }
}

export async function getGmailAccounts(userId: number): Promise<GmailAccount[]> {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select().from(gmailAccounts).where(eq(gmailAccounts.userId, userId));
  return rows.map(decryptAccountTokens);
}

/**
 * Fetches one Gmail account, scoped to its owner.
 *
 * `userId` is required: without it a caller could pass any account id and get
 * back another tenant's OAuth tokens, which is enough to send mail from their
 * mailbox.
 */
export async function getGmailAccount(id: number, userId: number): Promise<GmailAccount | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(gmailAccounts)
    .where(and(eq(gmailAccounts.id, id), eq(gmailAccounts.userId, userId)))
    .limit(1);
  return result[0] ? decryptAccountTokens(result[0]) : undefined;
}

export async function upsertGmailAccount(data: InsertGmailAccount): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  // Encrypt at the storage boundary so callers keep passing plaintext.
  const accessToken = encryptSecret(data.accessToken);
  const refreshToken = data.refreshToken ? encryptSecret(data.refreshToken) : data.refreshToken;
  const existing = await db.select().from(gmailAccounts).where(and(eq(gmailAccounts.userId, data.userId), eq(gmailAccounts.gmailAddress, data.gmailAddress))).limit(1);
  if (existing[0]) {
    await db.update(gmailAccounts).set({ accessToken, refreshToken: refreshToken ?? existing[0].refreshToken, tokenExpiry: data.tokenExpiry }).where(eq(gmailAccounts.id, existing[0].id));
    return existing[0].id;
  }
  const result = await db.insert(gmailAccounts).values({ ...data, accessToken, refreshToken });
  return (result as any)[0]?.insertId ?? 0;
}

export async function deleteGmailAccount(id: number, userId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.delete(gmailAccounts).where(and(eq(gmailAccounts.id, id), eq(gmailAccounts.userId, userId)));
}

export async function setDefaultGmailAccount(id: number, userId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(gmailAccounts).set({ isDefault: false }).where(eq(gmailAccounts.userId, userId));
  await db.update(gmailAccounts).set({ isDefault: true }).where(and(eq(gmailAccounts.id, id), eq(gmailAccounts.userId, userId)));
}

// ─── Contacts ─────────────────────────────────────────────────────────────────
export async function getContacts(userId: number): Promise<Contact[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(contacts).where(eq(contacts.userId, userId)).orderBy(desc(contacts.createdAt));
}

export async function getContact(id: number, userId: number): Promise<Contact | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(contacts).where(and(eq(contacts.id, id), eq(contacts.userId, userId))).limit(1);
  return result[0];
}

export async function createContact(data: InsertContact): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(contacts).values(data);
  return (result as any)[0]?.insertId ?? 0;
}

export async function updateContact(id: number, userId: number, data: Partial<InsertContact>): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(contacts).set(data).where(and(eq(contacts.id, id), eq(contacts.userId, userId)));
}

export async function deleteContact(id: number, userId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.delete(contacts).where(and(eq(contacts.id, id), eq(contacts.userId, userId)));
}

// ─── Touchpoints ──────────────────────────────────────────────────────────────
export async function getTouchpoints(): Promise<Touchpoint[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(touchpoints).where(eq(touchpoints.isActive, true));
}

export async function getTouchpointsByIndustry(industry: string): Promise<Touchpoint[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(touchpoints).where(and(eq(touchpoints.isActive, true), eq(touchpoints.industryTag, industry)));
}

export async function createTouchpoint(data: InsertTouchpoint): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.insert(touchpoints).values(data);
}

// ─── Email Drafts ─────────────────────────────────────────────────────────────
export async function getEmailDrafts(userId: number, status?: string): Promise<EmailDraft[]> {
  const db = await getDb();
  if (!db) return [];
  const conditions = [eq(emailDrafts.userId, userId)];
  if (status) conditions.push(eq(emailDrafts.status, status as any));
  return db.select().from(emailDrafts).where(and(...conditions)).orderBy(desc(emailDrafts.createdAt));
}

export async function getEmailDraft(id: number, userId: number): Promise<EmailDraft | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(emailDrafts).where(and(eq(emailDrafts.id, id), eq(emailDrafts.userId, userId))).limit(1);
  return result[0];
}

export async function getEmailDraftByTrackingId(trackingId: string): Promise<EmailDraft | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(emailDrafts).where(eq(emailDrafts.trackingId, trackingId)).limit(1);
  return result[0];
}

export async function createEmailDraft(data: InsertEmailDraft): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(emailDrafts).values(data);
  return (result as any)[0]?.insertId ?? 0;
}

export async function updateEmailDraft(id: number, userId: number, data: Partial<InsertEmailDraft>): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(emailDrafts).set(data).where(and(eq(emailDrafts.id, id), eq(emailDrafts.userId, userId)));
}

export async function recordEmailOpen(trackingId: string, ip: string, userAgent: string): Promise<void> {
  const db = await getDb();
  if (!db) return;
  const draft = await getEmailDraftByTrackingId(trackingId);
  if (!draft || draft.status !== "sent") return;
  await db.update(emailDrafts).set({
    openCount: sql`${emailDrafts.openCount} + 1`,
    firstOpenedAt: draft.firstOpenedAt ?? new Date(),
  }).where(eq(emailDrafts.trackingId, trackingId));
  await db.insert(emailEvents).values({ draftId: draft.id, eventType: "opened", ipAddress: ip, userAgent });
}

// ─── Email Events ─────────────────────────────────────────────────────────────
export async function createEmailEvent(data: InsertEmailEvent): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.insert(emailEvents).values(data);
}

// ─── Analytics ────────────────────────────────────────────────────────────────
export async function getAnalyticsStats(userId: number) {
  const db = await getDb();
  if (!db) return null;
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [sentThisMonth] = await db.select({ count: sql<number>`count(*)` }).from(emailDrafts)
    .where(and(eq(emailDrafts.userId, userId), eq(emailDrafts.status, "sent"), gte(emailDrafts.sentAt, startOfMonth)));
  const [sentAllTime] = await db.select({ count: sql<number>`count(*)` }).from(emailDrafts)
    .where(and(eq(emailDrafts.userId, userId), eq(emailDrafts.status, "sent")));
  const [pendingCount] = await db.select({ count: sql<number>`count(*)` }).from(emailDrafts)
    .where(and(eq(emailDrafts.userId, userId), eq(emailDrafts.status, "pending")));
  const [activeContacts] = await db.select({ count: sql<number>`count(*)` }).from(contacts)
    .where(and(eq(contacts.userId, userId), eq(contacts.loopStatus, "active")));
  const [pausedContacts] = await db.select({ count: sql<number>`count(*)` }).from(contacts)
    .where(and(eq(contacts.userId, userId), eq(contacts.loopStatus, "paused")));
  const [openedCount] = await db.select({ count: sql<number>`count(*)` }).from(emailDrafts)
    .where(and(eq(emailDrafts.userId, userId), eq(emailDrafts.status, "sent"), gte(emailDrafts.openCount, 1)));

  const totalSent = Number(sentAllTime?.count ?? 0);
  const totalOpened = Number(openedCount?.count ?? 0);
  return {
    sentThisMonth: Number(sentThisMonth?.count ?? 0),
    sentAllTime: totalSent,
    openRate: totalSent > 0 ? Math.round((totalOpened / totalSent) * 100) : 0,
    pendingCount: Number(pendingCount?.count ?? 0),
    activeContacts: Number(activeContacts?.count ?? 0),
    pausedContacts: Number(pausedContacts?.count ?? 0),
  };
}

export async function getExtendedAnalyticsStats(userId: number) {
  const db = await getDb();
  if (!db) return null;
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [totalContacts] = await db.select({ count: sql<number>`count(*)` }).from(contacts).where(eq(contacts.userId, userId));
  const [coldContacts] = await db.select({ count: sql<number>`count(*)` }).from(contacts).where(and(eq(contacts.userId, userId), eq(contacts.relationshipTier, "cold")));
  const [warmContacts] = await db.select({ count: sql<number>`count(*)` }).from(contacts).where(and(eq(contacts.userId, userId), eq(contacts.relationshipTier, "warm")));
  const [hotContacts] = await db.select({ count: sql<number>`count(*)` }).from(contacts).where(and(eq(contacts.userId, userId), eq(contacts.relationshipTier, "hot")));
  const [scheduledEmails] = await db.select({ count: sql<number>`count(*)` }).from(emailDrafts).where(and(eq(emailDrafts.userId, userId), eq(emailDrafts.status, "approved")));
  const [sentThisMonth] = await db.select({ count: sql<number>`count(*)` }).from(emailDrafts).where(and(eq(emailDrafts.userId, userId), eq(emailDrafts.status, "sent"), gte(emailDrafts.sentAt, startOfMonth)));
  const [repliesReceived] = await db.select({ count: sql<number>`count(*)` }).from(emailEvents).where(eq(emailEvents.eventType, "replied"));
  const [pausedAfterReply] = await db.select({ count: sql<number>`count(*)` }).from(contacts).where(and(eq(contacts.userId, userId), eq(contacts.loopStatus, "paused")));
  const [pendingApproval] = await db.select({ count: sql<number>`count(*)` }).from(emailDrafts).where(and(eq(emailDrafts.userId, userId), eq(emailDrafts.status, "pending")));

  // Count active sequences
  const { contactSequenceEnrollments } = await import("../drizzle/schema");
  const [activeSequences] = await db.select({ count: sql<number>`count(*)` }).from(contactSequenceEnrollments).where(and(eq(contactSequenceEnrollments.userId, userId), eq(contactSequenceEnrollments.status, "active")));

  return {
    totalContacts: Number(totalContacts?.count ?? 0),
    coldContacts: Number(coldContacts?.count ?? 0),
    warmContacts: Number(warmContacts?.count ?? 0),
    hotContacts: Number(hotContacts?.count ?? 0),
    activeSequences: Number(activeSequences?.count ?? 0),
    pendingApproval: Number(pendingApproval?.count ?? 0),
    scheduledEmails: Number(scheduledEmails?.count ?? 0),
    sentThisMonth: Number(sentThisMonth?.count ?? 0),
    repliesReceived: Number(repliesReceived?.count ?? 0),
    pausedAfterReply: Number(pausedAfterReply?.count ?? 0),
  };
}

export async function getCalendarEvents(userId: number, startDate: Date, endDate: Date) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(emailDrafts)
    .where(and(
      eq(emailDrafts.userId, userId),
      gte(emailDrafts.scheduledSendAt, startDate),
      lte(emailDrafts.scheduledSendAt, endDate)
    ))
    .orderBy(emailDrafts.scheduledSendAt);
}

export async function getActiveContactsForCron(userId: number): Promise<Contact[]> {
  const db = await getDb();
  if (!db) return [];
  const now = new Date();
  const allActive = await db.select().from(contacts).where(and(eq(contacts.userId, userId), eq(contacts.loopStatus, "active")));
  // Filter out snoozed contacts (snoozeUntil is in the future)
  return allActive.filter(c => !c.snoozeUntil || new Date(c.snoozeUntil) <= now);
}

// Feedback Rules
export async function getFeedbackRules(userId: number, activeOnly = true): Promise<FeedbackRule[]> {
  const db = await getDb();
  if (!db) return [];
  const conditions = [eq(feedbackRules.userId, userId)];
  if (activeOnly) conditions.push(eq(feedbackRules.isActive, true));
  return db.select().from(feedbackRules).where(and(...conditions)).orderBy(desc(feedbackRules.createdAt));
}

export async function createFeedbackRule(rule: InsertFeedbackRule): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(feedbackRules).values(rule);
  return (result as any)[0]?.insertId ?? 0;
}

export async function updateFeedbackRule(ruleId: number, userId: number, updates: Partial<Omit<FeedbackRule, "id" | "createdAt">>): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(feedbackRules).set({ ...updates, updatedAt: new Date() }).where(and(eq(feedbackRules.id, ruleId), eq(feedbackRules.userId, userId)));
}

export async function deleteFeedbackRule(ruleId: number, userId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.delete(feedbackRules).where(and(eq(feedbackRules.id, ruleId), eq(feedbackRules.userId, userId)));
}

export async function applyFeedbackRules(text: string, userId: number): Promise<{ text: string; appliedRules: number[] }> {
  const rules = await getFeedbackRules(userId, true);
  let result = text;
  const appliedRuleIds: number[] = [];
  for (const rule of rules) {
    if (rule.confidence >= 60) {
      try {
        const regex = new RegExp(rule.pattern, "gi");
        if (regex.test(result)) {
          result = result.replace(regex, rule.replacement);
          appliedRuleIds.push(rule.id);
          await updateFeedbackRule(rule.id, userId, { appliedCount: rule.appliedCount + 1 });
        }
      } catch (e) {
        // invalid regex, skip
      }
    }
  }
  return { text: result, appliedRules: appliedRuleIds };
}

// ─── Suppression List ────────────────────────────────────────────────────────
/**
 * Whether this user has suppressed this address.
 *
 * Scoped to the owner: suppression is a fact about one sender's relationship
 * with a recipient, not a global blocklist. Unscoped, one tenant's unsubscribe
 * silently blocked that address for every other tenant.
 */
export async function isEmailSuppressed(email: string, userId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  const result = await db
    .select()
    .from(suppressionList)
    .where(and(eq(suppressionList.userId, userId), eq(suppressionList.email, email.toLowerCase())))
    .limit(1);
  return result.length > 0;
}

/** Human-readable name for the sender, for the unsubscribe confirmation page. */
export async function getSenderLabel(userId: number): Promise<string | null> {
  const db = await getDb();
  if (!db) return null;
  const [profile] = await db
    .select({ companyName: senderProfiles.companyName })
    .from(senderProfiles)
    .where(eq(senderProfiles.userId, userId))
    .limit(1);
  return profile?.companyName?.trim() || null;
}

export async function getSuppressionList(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(suppressionList)
    .where(eq(suppressionList.userId, userId))
    .orderBy(desc(suppressionList.createdAt));
}

/**
 * Lifts a suppression.
 *
 * Unsubscribing was previously a one-way door — the address was blocked with no
 * way back short of editing the database, so an accidental click or a contact
 * who later asked to hear from you again could not be undone.
 */
export async function removeFromSuppressionList(userId: number, email: string): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db
    .delete(suppressionList)
    .where(and(eq(suppressionList.userId, userId), eq(suppressionList.email, email.toLowerCase())));
}

/** Reactivates this user's paused contacts at a given address. */
export async function reactivateContactsByEmail(userId: number, email: string): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const matching = await db
    .select()
    .from(contacts)
    .where(and(eq(contacts.userId, userId), eq(contacts.email, email.toLowerCase())));

  let reactivated = 0;
  for (const contact of matching) {
    if (contact.loopStatus !== "paused") continue;
    await db
      .update(contacts)
      .set({ loopStatus: "active" })
      .where(and(eq(contacts.id, contact.id), eq(contacts.userId, userId)));
    reactivated++;
  }
  return reactivated;
}

export async function addToSuppressionList(userId: number, email: string, reason: "unsubscribed" | "bounced" | "blocked"): Promise<void> {
  const db = await getDb();
  if (!db) return;
  try {
    await db.insert(suppressionList).values({ userId, email: email.toLowerCase(), reason });
  } catch (e) {
    // Ignore duplicate entries
  }
}
