"use client";

import { useRouter } from "next/navigation";
import { AlertCard } from "./AlertCard";

interface Alert {
  id: string;
  doctor_name: string | null;
  postal_code: string | null;
  radius_km: number;
  created_at: string;
}

interface AlertListProps {
  alerts: Alert[];
}

export function AlertList({ alerts }: AlertListProps) {
  const router = useRouter();

  async function handleDelete(id: string) {
    const res = await fetch(`/api/alerts/${id}`, { method: "DELETE" });
    if (res.ok) router.refresh();
  }

  if (alerts.length === 0) {
    return (
      <div className="py-12 text-center">
        <p className="text-slate-500">No alerts yet. Subscribe to get notified when a pediatrician opens their roster.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {alerts.map((alert) => (
        <AlertCard key={alert.id} alert={alert} onDelete={handleDelete} />
      ))}
    </div>
  );
}
