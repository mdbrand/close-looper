import { eq, gte, sql, and } from "drizzle-orm";
import { getDb } from "./db";
import { aiUsageLog, type InsertAiUsageLog } from "../drizzle/schema";

/**
 * Logs an AI usage event (LLM call) for credit tracking.
 * Called after every invokeLLM response that includes usage data.
 */
export async function logAiUsage(data: Omit<InsertAiUsageLog, "id" | "createdAt">): Promise<void> {
  const db = await getDb();
  if (!db) return;
  try {
    await db.insert(aiUsageLog).values(data);
  } catch (err) {
    console.error("[UsageTracker] Failed to log usage:", err);
  }
}

export type UsageStats = {
  thisMonth: { calls: number; totalTokens: number; promptTokens: number; completionTokens: number };
  lastMonth: { calls: number; totalTokens: number; promptTokens: number; completionTokens: number };
  allTime: { calls: number; totalTokens: number; promptTokens: number; completionTokens: number };
  dailyBreakdown: Array<{ date: string; calls: number; totalTokens: number }>;
  byAction: Array<{ action: string; calls: number; totalTokens: number }>;
};

export async function getUsageStats(userId: number): Promise<UsageStats> {
  const db = await getDb();
  if (!db) return {
    thisMonth: { calls: 0, totalTokens: 0, promptTokens: 0, completionTokens: 0 },
    lastMonth: { calls: 0, totalTokens: 0, promptTokens: 0, completionTokens: 0 },
    allTime: { calls: 0, totalTokens: 0, promptTokens: 0, completionTokens: 0 },
    dailyBreakdown: [],
    byAction: [],
  };

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  // This month
  const thisMonthRows = await db
    .select({
      calls: sql<number>`COUNT(*)`,
      totalTokens: sql<number>`COALESCE(SUM(totalTokens), 0)`,
      promptTokens: sql<number>`COALESCE(SUM(promptTokens), 0)`,
      completionTokens: sql<number>`COALESCE(SUM(completionTokens), 0)`,
    })
    .from(aiUsageLog)
    .where(and(eq(aiUsageLog.userId, userId), gte(aiUsageLog.createdAt, startOfMonth)));

  // Last month
  const lastMonthRows = await db
    .select({
      calls: sql<number>`COUNT(*)`,
      totalTokens: sql<number>`COALESCE(SUM(totalTokens), 0)`,
      promptTokens: sql<number>`COALESCE(SUM(promptTokens), 0)`,
      completionTokens: sql<number>`COALESCE(SUM(completionTokens), 0)`,
    })
    .from(aiUsageLog)
    .where(and(
      eq(aiUsageLog.userId, userId),
      gte(aiUsageLog.createdAt, startOfLastMonth),
      sql`${aiUsageLog.createdAt} < ${startOfMonth}`
    ));

  // All time
  const allTimeRows = await db
    .select({
      calls: sql<number>`COUNT(*)`,
      totalTokens: sql<number>`COALESCE(SUM(totalTokens), 0)`,
      promptTokens: sql<number>`COALESCE(SUM(promptTokens), 0)`,
      completionTokens: sql<number>`COALESCE(SUM(completionTokens), 0)`,
    })
    .from(aiUsageLog)
    .where(eq(aiUsageLog.userId, userId));

  // Daily breakdown (last 30 days)
  const dailyRows = await db
    .select({
      date: sql<string>`DATE(createdAt)`,
      calls: sql<number>`COUNT(*)`,
      totalTokens: sql<number>`COALESCE(SUM(totalTokens), 0)`,
    })
    .from(aiUsageLog)
    .where(and(eq(aiUsageLog.userId, userId), gte(aiUsageLog.createdAt, thirtyDaysAgo)))
    .groupBy(sql`DATE(createdAt)`)
    .orderBy(sql`DATE(createdAt)`);

  // By action type
  const byActionRows = await db
    .select({
      action: aiUsageLog.action,
      calls: sql<number>`COUNT(*)`,
      totalTokens: sql<number>`COALESCE(SUM(totalTokens), 0)`,
    })
    .from(aiUsageLog)
    .where(eq(aiUsageLog.userId, userId))
    .groupBy(aiUsageLog.action);

  return {
    thisMonth: thisMonthRows[0] ?? { calls: 0, totalTokens: 0, promptTokens: 0, completionTokens: 0 },
    lastMonth: lastMonthRows[0] ?? { calls: 0, totalTokens: 0, promptTokens: 0, completionTokens: 0 },
    allTime: allTimeRows[0] ?? { calls: 0, totalTokens: 0, promptTokens: 0, completionTokens: 0 },
    dailyBreakdown: dailyRows.map(r => ({ date: String(r.date), calls: Number(r.calls), totalTokens: Number(r.totalTokens) })),
    byAction: byActionRows.map(r => ({ action: r.action, calls: Number(r.calls), totalTokens: Number(r.totalTokens) })),
  };
}
