import Link from "next/link";
import { AlertList } from "@/components/alert/AlertList";
import { Button } from "@/components/ui/Button";

export default function AlertsPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Your Alerts</h1>
          <p className="text-zinc-600">Get notified when a pediatrician opens their roster.</p>
        </div>
        <Link href="/alerts/manage">
          <Button size="sm">New Alert</Button>
        </Link>
      </div>

      <AlertList alerts={[]} />
    </div>
  );
}
