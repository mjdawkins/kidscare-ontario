"use client";

import { useMemo } from "react";
import { Card } from "@/components/ui/Card";
import { OpenNowBadge } from "@/components/shared/OpenNowBadge";
import { WeekendBadge } from "@/components/shared/WeekendBadge";
import { DistanceDisplay } from "@/components/shared/DistanceDisplay";

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function formatTime(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const ampm = h >= 12 ? "pm" : "am";
  const hour = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return m === 0 ? `${hour}${ampm}` : `${hour}:${m.toString().padStart(2, "0")}${ampm}`;
}

function isOpenNow(hours: Record<string, { open: string; close: string }> | null): boolean {
  if (!hours) return false;
  const now = new Date();
  const today = now.getDay().toString();
  const currentTime = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;
  const todaySlot = hours[today];
  if (!todaySlot) return false;
  return todaySlot.open <= currentTime && todaySlot.close >= currentTime;
}

interface ClinicCardProps {
  clinic: {
    id: string;
    name: string;
    address: string;
    distance_km: number;
    phone: string | null;
    hours: Record<string, { open: string; close: string }> | null;
    sees_children: boolean;
    open_saturday: boolean;
    open_sunday: boolean;
    open_after_6pm: boolean;
  };
}

export function ClinicCard({ clinic }: ClinicCardProps) {
  const open = useMemo(() => isOpenNow(clinic.hours), [clinic.hours]);
  const hoursToday = useMemo(() => {
    if (!clinic.hours) return null;
    const today = new Date().getDay().toString();
    const slot = clinic.hours[today];
    if (!slot) return null;
    return `${formatTime(slot.open)} – ${formatTime(slot.close)}`;
  }, [clinic.hours]);

  const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(clinic.address)}`;

  return (
    <Card className="flex flex-col gap-2">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-semibold text-slate-900">{clinic.name}</h3>
          <p className="text-sm text-slate-600">{clinic.address}</p>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <OpenNowBadge isOpen={open} />
          {clinic.sees_children && (
            <span className="text-xs text-green-700 font-medium">Sees children</span>
          )}
        </div>
      </div>

      <DistanceDisplay km={clinic.distance_km} />

      {hoursToday && (
        <p className="text-sm text-slate-700">
          <span className="font-medium">{DAY_NAMES[new Date().getDay()]}:</span>{" "}
          {hoursToday}
        </p>
      )}

      <WeekendBadge
        openSaturday={clinic.open_saturday}
        openSunday={clinic.open_sunday}
        openAfter6pm={clinic.open_after_6pm}
      />

      <div className="flex items-center gap-4 pt-1">
        {clinic.phone && (
          <a href={`tel:${clinic.phone}`} className="text-sm font-medium text-blue-600 hover:underline">
            {clinic.phone}
          </a>
        )}
        <a
          href={directionsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:underline"
        >
          Get Directions &#8599;
        </a>
      </div>
    </Card>
  );
}
