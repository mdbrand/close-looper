import { z } from "zod";
import { publicProcedure, protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { contactInquiries, inviteCodes, waitlistSignups, referrals, userProfiles, users } from "../../drizzle/schema";
import { eq, desc, and, lt, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { TRPCError } from "@trpc/server";

const publicSubmissionWindowMs = 60 * 60 * 1000;
const publicSubmissionLimit = 5;
const publicSubmissionAttempts = new Map<string, { count: number; resetAt: number }>();

function assertPublicSubmissionRate(req: { ip?: string; headers: Record<string, unknown> }, kind: string) {
  const forwarded = typeof req.headers["x-forwarded-for"] === "string"
    ? req.headers["x-forwarded-for"].split(",")[0].trim()
    : undefined;
  const key = `${kind}:${forwarded || req.ip || "unknown"}`;
  const now = Date.now();
  const current = publicSubmissionAttempts.get(key);
  if (!current || current.resetAt <= now) {
    publicSubmissionAttempts.set(key, { count: 1, resetAt: now + publicSubmissionWindowMs });
    return;
  }
  if (current.count >= publicSubmissionLimit) {
    throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Too many submissions. Please try again later." });
  }
  current.count += 1;
}

export const publicRouter = router({
  submitSignup: publicProcedure.input(z.object({
    firstName: z.string().min(1),
    lastName: z.string().optional(),
    email: z.string().email(),
    phone: z.string().optional(),
    companyName: z.string().optional(),
    website: z.string().optional(),
    industry: z.string().optional(),
    successMetric: z.string().min(1),
    inviteCode: z.string().optional(),
    referredByCode: z.string().optional(),
  })).mutation(async ({ input, ctx }) => {
    assertPublicSubmissionRate(ctx.req, "signup");
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    // Check if email already exists
    const existing = await db.select().from(waitlistSignups).where(eq(waitlistSignups.email, input.email)).limit(1);
    if (existing.length > 0) throw new TRPCError({ code: "CONFLICT", message: "This email is already on the waitlist." });
    // A valid code approves access immediately; applications without one stay
    // pending until an administrator explicitly approves them.
    let approvedByInvite = false;
    if (input.inviteCode) {
      const [code] = await db.select().from(inviteCodes).where(and(eq(inviteCodes.code, input.inviteCode), eq(inviteCodes.isActive, true))).limit(1);
      if (!code) throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid or expired invite code." });
      if (code.useCount >= code.maxUses) throw new TRPCError({ code: "BAD_REQUEST", message: "This invite code has already been used." });
      const result = await db.update(inviteCodes)
        .set({ useCount: sql`${inviteCodes.useCount} + 1`, usedAt: new Date() })
        .where(and(eq(inviteCodes.id, code.id), lt(inviteCodes.useCount, inviteCodes.maxUses)));
      const header = Array.isArray(result) ? result[0] : result;
      if (Number((header as any)?.affectedRows ?? (header as any)?.rowsAffected ?? 0) !== 1) {
        throw new TRPCError({ code: "CONFLICT", message: "This invite code has already been used." });
      }
      approvedByInvite = true;
    }
    await db.insert(waitlistSignups).values({
      firstName: input.firstName,
      lastName: input.lastName,
      email: input.email,
      phone: input.phone,
      companyName: input.companyName,
      website: input.website,
      industry: input.industry,
      successMetric: input.successMetric,
      inviteCode: input.inviteCode,
      referredByCode: input.referredByCode,
      status: approvedByInvite ? "approved" : "pending",
    });
    // Track referral if referredByCode provided
    if (input.referredByCode) {
      const [ref] = await db.select().from(referrals).where(eq(referrals.referralCode, input.referredByCode)).limit(1);
      if (ref) await db.update(referrals).set({ status: "signed_up", referredEmail: input.email }).where(eq(referrals.id, ref.id));
    }
    return { success: true };
  }),

  submitContactInquiry: publicProcedure.input(z.object({
    name: z.string().trim().min(1).max(200),
    email: z.string().trim().email().max(320),
    companyName: z.string().trim().max(200).optional(),
    subject: z.string().trim().min(1).max(200),
    message: z.string().trim().min(10).max(5000),
  })).mutation(async ({ input, ctx }) => {
    assertPublicSubmissionRate(ctx.req, "contact");
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    await db.insert(contactInquiries).values(input);
    return { success: true as const };
  }),

  getReferralCode: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    let [profile] = await db.select().from(userProfiles).where(eq(userProfiles.userId, ctx.user.id)).limit(1);
    if (!profile) {
      const code = nanoid(8).toUpperCase();
      await db.insert(userProfiles).values({ userId: ctx.user.id, referralCode: code });
      [profile] = await db.select().from(userProfiles).where(eq(userProfiles.userId, ctx.user.id)).limit(1);
    }
    if (!profile.referralCode) {
      const code = nanoid(8).toUpperCase();
      await db.update(userProfiles).set({ referralCode: code }).where(eq(userProfiles.userId, ctx.user.id));
      profile.referralCode = code;
    }
    const myReferrals = await db.select().from(referrals).where(eq(referrals.referrerUserId, ctx.user.id)).orderBy(desc(referrals.createdAt));
    return { referralCode: profile.referralCode, referrals: myReferrals, freeMonthsEarned: profile.freeMonthsEarned };
  }),
});

export const adminRouter = router({
  // Users
  listUsers: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
    const db = await getDb();
    if (!db) return [];
    const allUsers = await db.select().from(users).orderBy(desc(users.createdAt));
    const profiles = await db.select().from(userProfiles);
    return allUsers.map(u => ({ ...u, profile: profiles.find(p => p.userId === u.id) }));
  }),

  // Waitlist
  listWaitlist: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
    const db = await getDb();
    if (!db) return [];
    return db.select().from(waitlistSignups).orderBy(desc(waitlistSignups.createdAt));
  }),

  approveWaitlist: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
    if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    await db.update(waitlistSignups).set({ status: "approved" }).where(eq(waitlistSignups.id, input.id));
    return { success: true };
  }),

  rejectWaitlist: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
    if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    await db.update(waitlistSignups).set({ status: "rejected" }).where(eq(waitlistSignups.id, input.id));
    return { success: true };
  }),

  // Invite Codes
  listInviteCodes: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
    const db = await getDb();
    if (!db) return [];
    return db.select().from(inviteCodes).orderBy(desc(inviteCodes.createdAt));
  }),

  createInviteCode: protectedProcedure.input(z.object({ maxUses: z.number().default(1), note: z.string().optional() })).mutation(async ({ ctx, input }) => {
    if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const code = `${nanoid(4)}-${nanoid(4)}`.toUpperCase();
    await db.insert(inviteCodes).values({ code, createdByUserId: ctx.user.id, maxUses: input.maxUses, note: input.note });
    return { code };
  }),

  deactivateInviteCode: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
    if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    await db.update(inviteCodes).set({ isActive: false }).where(eq(inviteCodes.id, input.id));
    return { success: true };
  }),

  // Referrals
  listReferrals: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
    const db = await getDb();
    if (!db) return [];
    return db.select().from(referrals).orderBy(desc(referrals.createdAt));
  }),

  listContactInquiries: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
    const db = await getDb();
    if (!db) return [];
    return db.select().from(contactInquiries).orderBy(desc(contactInquiries.createdAt));
  }),

  updateContactInquiryStatus: protectedProcedure.input(z.object({
    id: z.number(),
    status: z.enum(["new", "read", "closed"]),
  })).mutation(async ({ ctx, input }) => {
    if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    await db.update(contactInquiries).set({ status: input.status }).where(eq(contactInquiries.id, input.id));
    return { success: true as const };
  }),

  // Admin stats
  stats: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
    const db = await getDb();
    if (!db) return {};
    const [totalUsers] = await db.select({ count: sql<number>`count(*)` }).from(users);
    const [totalWaitlist] = await db.select({ count: sql<number>`count(*)` }).from(waitlistSignups);
    const [pendingWaitlist] = await db.select({ count: sql<number>`count(*)` }).from(waitlistSignups).where(eq(waitlistSignups.status, "pending"));
    const [totalReferrals] = await db.select({ count: sql<number>`count(*)` }).from(referrals);
    const [activeInvites] = await db.select({ count: sql<number>`count(*)` }).from(inviteCodes).where(eq(inviteCodes.isActive, true));
    return {
      totalUsers: totalUsers?.count ?? 0,
      totalWaitlist: totalWaitlist?.count ?? 0,
      pendingWaitlist: pendingWaitlist?.count ?? 0,
      totalReferrals: totalReferrals?.count ?? 0,
      activeInvites: activeInvites?.count ?? 0,
    };
  }),
});
