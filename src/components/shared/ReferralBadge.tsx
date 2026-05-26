import { Badge } from "@/components/ui/Badge";

export function ReferralBadge({ required }: { required: boolean }) {
  if (required) {
    return <Badge variant="amber">Referral required</Badge>;
  }
  return <Badge variant="green">No referral needed</Badge>;
}
