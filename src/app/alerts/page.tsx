import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertList } from "@/components/alert/AlertList";
import { Button } from "@/components/ui/Button";
import { prisma } from "@/lib/db/prisma";
import { createClient } from "@/lib/supabase/server";

export default async function AlertsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/?error=sign_in_required");
  }

  const alerts = await prisma.alert.findMany({
    where: { userId: user.id },
    include: {
      doctor: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const mapped = alerts.map((a) => ({
    id: a.id,
    doctor_name: a.doctor?.name ?? null,
    postal_code: a.postalCode,
    radius_km: a.radiusKm,
    created_at: a.createdAt.toISOString(),
  }));

  const maxAlerts = 5;
  const remaining = Math.max(0, maxAlerts - alerts.length);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Your Alerts</h1>
          <p className="text-zinc-600">
            Get notified when a pediatrician opens their roster.
          </p>
          {alerts.length > 0 && (
            <p className="text-xs text-zinc-400 mt-1">
              {remaining} of {maxAlerts} alerts remaining
            </p>
          )}
        </div>
        {alerts.length < maxAlerts && (
          <Link href="/alerts/manage">
            <Button size="sm">New Alert</Button>
          </Link>
        )}
      </div>

      <AlertList alerts={mapped} />
    </div>
  );
}
