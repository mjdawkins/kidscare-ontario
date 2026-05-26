import { Card } from "@/components/ui/Card";
import { OpenNowBadge } from "@/components/shared/OpenNowBadge";
import { WeekendBadge } from "@/components/shared/WeekendBadge";
import { DistanceDisplay } from "@/components/shared/DistanceDisplay";

interface ClinicCardProps {
  clinic: {
    id: string;
    name: string;
    address: string;
    distance_km: number;
    phone: string | null;
    sees_children: boolean;
    open_saturday: boolean;
    open_sunday: boolean;
    open_after_6pm: boolean;
    is_open_now: boolean;
  };
}

export function ClinicCard({ clinic }: ClinicCardProps) {
  return (
    <Card className="flex flex-col gap-2">
      <div className="flex items-start justify-between">
        <h3 className="font-semibold text-zinc-900">{clinic.name}</h3>
        <OpenNowBadge isOpen={clinic.is_open_now} />
      </div>
      <p className="text-sm text-zinc-600">{clinic.address}</p>
      <DistanceDisplay km={clinic.distance_km} />
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
