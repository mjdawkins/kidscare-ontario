import { describe, it, expect } from "vitest";
import {
  calculateAcceptingStatus,
  calculateVerificationCount,
  isStale,
  shouldRevertToUnknown,
  staleDays,
} from "./verification";
import type { AcceptingStatus } from "./verification";

function makeVerification(
  status: AcceptingStatus,
  daysAgo: number,
) {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return { reportedStatus: status, createdAt: date };
}

describe("calculateAcceptingStatus", () => {
  it("returns accepting when 2+ recent verifications agree", () => {
    const result = calculateAcceptingStatus([
      makeVerification("accepting", 3),
      makeVerification("accepting", 5),
      makeVerification("waitlist", 10),
    ]);
    expect(result).toBe("accepting");
  });

  it("returns null when fewer than 2 verifications", () => {
    const result = calculateAcceptingStatus([
      makeVerification("accepting", 3),
    ]);
    expect(result).toBeNull();
  });

  it("returns null when verifications disagree", () => {
    const result = calculateAcceptingStatus([
      makeVerification("accepting", 3),
      makeVerification("waitlist", 4),
    ]);
    expect(result).toBeNull();
  });

  it("ignores verifications older than 30 days", () => {
    const result = calculateAcceptingStatus([
      makeVerification("accepting", 35),
      makeVerification("accepting", 40),
    ]);
    expect(result).toBeNull();
  });

  it("returns waitlist when that leads consensus", () => {
    const result = calculateAcceptingStatus([
      makeVerification("waitlist", 1),
      makeVerification("waitlist", 2),
      makeVerification("accepting", 3),
    ]);
    expect(result).toBe("waitlist");
  });
});

describe("calculateVerificationCount", () => {
  it("counts only verifications matching the current status within 60 days", () => {
    const count = calculateVerificationCount(
      [
        makeVerification("accepting", 5),
        makeVerification("accepting", 10),
        makeVerification("waitlist", 15),
        makeVerification("accepting", 65),
      ],
      "accepting",
    );
    expect(count).toBe(2);
  });
});

describe("isStale", () => {
  it("returns true when last verified is null", () => {
    expect(isStale(null)).toBe(true);
  });

  it("returns true when last verified >30 days ago", () => {
    const date = new Date();
    date.setDate(date.getDate() - 31);
    expect(isStale(date)).toBe(true);
  });

  it("returns false when last verified <30 days ago", () => {
    const date = new Date();
    date.setDate(date.getDate() - 5);
    expect(isStale(date)).toBe(false);
  });
});

describe("shouldRevertToUnknown", () => {
  it("returns true when >90 days with no verifications", () => {
    const date = new Date();
    date.setDate(date.getDate() - 91);
    expect(shouldRevertToUnknown(date)).toBe(true);
  });

  it("returns false when <90 days", () => {
    const date = new Date();
    date.setDate(date.getDate() - 30);
    expect(shouldRevertToUnknown(date)).toBe(false);
  });
});

describe("staleDays", () => {
  it("returns null for null date", () => {
    expect(staleDays(null)).toBeNull();
  });

  it("returns approximate day count", () => {
    const date = new Date();
    date.setDate(date.getDate() - 7);
    expect(staleDays(date)).toBe(7);
  });
});
