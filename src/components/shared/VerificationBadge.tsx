import { Badge } from "@/components/ui/Badge";

interface VerificationBadgeProps {
  verificationCount: number;
  staleDays: number | null;
}

export function VerificationBadge({ verificationCount, staleDays }: VerificationBadgeProps) {
  if (verificationCount === 0) {
    return <Badge variant="neutral">No community data yet</Badge>;
  }

  if (staleDays === null) {
    return <Badge variant="neutral">Not verified</Badge>;
  }

  const variant = staleDays > 30 ? "red" : "green";
  const parentWord = verificationCount === 1 ? "parent" : "parents";

  return (
    <Badge variant={variant}>
      Confirmed by {verificationCount} {parentWord} · {staleDays} {staleDays === 1 ? "day" : "days"} ago
    </Badge>
  );
}
