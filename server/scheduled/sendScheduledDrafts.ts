import type { Request, Response } from "express";
import { sdk } from "../_core/sdk";
import { getDueScheduledDrafts } from "../db";
import { sendDraft } from "../sendDraft";

/** Delivers approved drafts whose scheduled time has arrived. */
export async function sendScheduledDraftsHandler(req: Request, res: Response) {
  try {
    const user = await sdk.authenticateRequest(req);
    if (!user.isCron) return res.status(403).json({ error: "cron-only" });

    const dueDrafts = await getDueScheduledDrafts(new Date());
    let sent = 0;
    let failed = 0;

    for (const draft of dueDrafts) {
      try {
        await sendDraft(draft.id, draft.userId);
        sent++;
      } catch (error) {
        failed++;
        console.error(`[ScheduledSend] Draft ${draft.id} failed:`, error);
      }
    }

    return res.json({ success: true, checked: dueDrafts.length, sent, failed });
  } catch (error) {
    console.error("[ScheduledSend] Cron error:", error);
    return res.status(500).json({ success: false, error: "Scheduled delivery failed" });
  }
}
