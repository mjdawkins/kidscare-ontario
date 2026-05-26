import { Badge } from "@/components/ui/Badge";

type AcceptingStatus = "accepting" | "waitlist" | "not_accepting" | "unknown";

const config: Record<AcceptingStatus, { label: string; variant: "green" | "amber" | "red" | "neutral" }> = {
  accepting: { label: "Accepting patients", variant: "green" },
  waitlist: { label: "Waitlist only", variant: "amber" },
  not_accepting: { label: "Not accepting", variant: "red" },
  unknown: { label: "Status unknown", variant: "neutral" },
};

export function StatusBadge({ status }: { status: AcceptingStatus }) {
  const { label, variant } = config[status];
  return <Badge variant={variant}>{label}</Badge>;
}
