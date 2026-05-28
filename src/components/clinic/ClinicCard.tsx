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

function todayHours(hours: Record<string, { open: string; close: string }> | null): string | null {
  if (!hours) return null;
  const today = new Date().getDay().toString();
  const todaySlot = hours[today];
  if (!todaySlot) return null;
  return `${formatTime(todaySlot.open)} – ${formatTime(todaySlot.close)}`;
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
    is_open_now: boolean;
  };
}

export function ClinicCard({ clinic }: ClinicCardProps) {
  const hoursToday = todayHours(clinic.hours);

  return (
    <Card className="flex flex-col gap-2">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-semibold text-zinc-900">{clinic.name}</h3>
          <p className="text-sm text-zinc-600">{clinic.address}</p>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <OpenNowBadge isOpen={clinic.is_open_now} />
          {!clinic.sees_children && (
            <span className="text-xs text-amber-600 font-medium">May not see children</span>
          )}
        </div>
      </div>

      <DistanceDisplay km={clinic.distance_km} />

      {hoursToday && (
        <p className="text-sm text-zinc-700">
          <span className="font-medium">{DAY_NAMES[new Date().getDay()]}:</span>{" "}
          {hoursToday}
        </p>
      )}

      <WeekendBadge
        openSaturday={clinic.open_saturday}
        openSunday={clinic.open_sunday}
        openAfter6pm={clinic.open_after_6pm}
      />

      {clinic.phone && (
        <a href={`tel:${clinic.phone}`} className="text-sm font-medium text-blue-600 hover:underline">
          {clinic.phone}
        </a>
      )}
    </Card>
  );
}
