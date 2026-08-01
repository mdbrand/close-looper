import { beforeEach, describe, expect, it, vi } from "vitest";

const { authenticateRequest } = vi.hoisted(() => ({ authenticateRequest: vi.fn() }));
vi.mock("../_core/sdk", () => ({ sdk: { authenticateRequest } }));

import { generateSequenceDraftsHandler } from "./generateSequenceDrafts";
import { sendWeeklyDigestHandler } from "./sendWeeklyDigest";

function response() {
  const res: any = {};
  res.status = vi.fn(() => res);
  res.json = vi.fn(() => res);
  return res;
}

describe("cron-only endpoints", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authenticateRequest.mockResolvedValue({ id: 1, isCron: false });
  });

  it("rejects a normal user from system-wide sequence generation", async () => {
    const res = response();
    await generateSequenceDraftsHandler({} as any, res);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("rejects a normal user from triggering the weekly digest", async () => {
    const res = response();
    await sendWeeklyDigestHandler({} as any, res);
    expect(res.status).toHaveBeenCalledWith(403);
  });
});
