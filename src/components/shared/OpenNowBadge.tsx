import { Badge } from "@/components/ui/Badge";

export function OpenNowBadge({ isOpen }: { isOpen: boolean }) {
  return isOpen
    ? <Badge variant="green">Open now</Badge>
    : <Badge variant="red">Closed</Badge>;
}
