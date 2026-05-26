// Community-verification pure functions.
// These have NO database dependencies — just date math and counting.

/**
 * The four states a doctor's accepting status can be in.
 * Mirrors the Prisma enum so the caller does not need to import @prisma/client
 * just to work with this module's return values.
 */
export type AcceptingStatus =
  | "accepting"
  | "waitlist"
  | "not_accepting"
  | "unknown";

export const VERIFICATION_WINDOW_DAYS = 30;
export const VERIFICATION_CONSENSUS_THRESHOLD = 2;
export const VERIFICATION_COUNT_WINDOW_DAYS = 60;
export const STALE_THRESHOLD_DAYS = 30;
export const UNKNOWN_THRESHOLD_DAYS = 90;

/**
 * Data shape the caller must provide — intentionally lightweight so callers
 * can project only the columns they need from the Verification table.
 */
export interface VerificationInput {
  reportedStatus: AcceptingStatus;
  createdAt: Date;
}

/**
 * Determine if a doctor's accepting status should update based on
 * all verifications in the consensus window.
 *
 * Returns the new status if there's consensus, null if no change.
 */
export function calculateAcceptingStatus(
  recentVerifications: VerificationInput[],
): AcceptingStatus | null {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - VERIFICATION_WINDOW_DAYS);

  const inWindow = recentVerifications.filter(
    (v) => v.createdAt >= cutoff,
  );

  // Count by reported status
  const counts: Record<AcceptingStatus, number> = {
    accepting: 0,
    waitlist: 0,
    not_accepting: 0,
    unknown: 0,
  };

  for (const v of inWindow) {
    counts[v.reportedStatus]++;
  }

  // Find the status with the most verifications
  const leadingStatus = Object.entries(counts)
    .filter(([, count]) => count >= VERIFICATION_CONSENSUS_THRESHOLD)
    .sort(([, a], [, b]) => b - a)[0];

  return leadingStatus
    ? (leadingStatus[0] as AcceptingStatus)
    : null;
}

/**
 * Count how many verifications support the current status
 * within the count window (60 days).
 */
export function calculateVerificationCount(
  verifications: VerificationInput[],
  currentStatus: AcceptingStatus,
): number {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - VERIFICATION_COUNT_WINDOW_DAYS);

  return verifications.filter(
    (v) => v.reportedStatus === currentStatus && v.createdAt >= cutoff,
  ).length;
}

/**
 * Check if the current status is stale (>30 days since last verification).
 */
export function isStale(lastVerified: Date | null): boolean {
  if (!lastVerified) return true;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - STALE_THRESHOLD_DAYS);
  return lastVerified < cutoff;
}

/**
 * Check if the status should revert to unknown (>90 days with no verifications).
 */
export function shouldRevertToUnknown(lastVerified: Date | null): boolean {
  if (!lastVerified) return true;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - UNKNOWN_THRESHOLD_DAYS);
  return lastVerified < cutoff;
}

/**
 * Calculate stale days for display.
 */
export function staleDays(lastVerified: Date | null): number | null {
  if (!lastVerified) return null;
  const now = new Date();
  const diffMs = now.getTime() - lastVerified.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}
