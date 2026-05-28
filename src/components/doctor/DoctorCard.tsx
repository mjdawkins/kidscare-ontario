import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { ReferralBadge } from "@/components/shared/ReferralBadge";
import { VerificationBadge } from "@/components/shared/VerificationBadge";
import { StalenessWarning } from "@/components/shared/StalenessWarning";
import { DistanceDisplay } from "@/components/shared/DistanceDisplay";

interface DoctorCardProps {
  doctor: {
    id: string;
    name: string;
    doctor_type: string;
    referral_required: boolean;
    accepting_status: "accepting" | "waitlist" | "not_accepting" | "unknown";
    languages: string[];
    address: string;
    distance_km: number;
    verification: {
      verification_count: number;
      stale_days: number | null;
    };
  };
}

export function DoctorCard({ doctor }: DoctorCardProps) {
  const googleSearchUrl = `https://www.google.com/search?q=${encodeURIComponent(doctor.name + " pediatrician")}`;

  return (
    <Link href={`/pediatricians/${doctor.id}`}>
      <Card className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-semibold text-zinc-900">{doctor.name}</h3>
          <StatusBadge status={doctor.accepting_status} />
          <ReferralBadge required={doctor.referral_required} />
        </div>
        <p className="text-sm text-zinc-600">{doctor.address}</p>
        <DistanceDisplay km={doctor.distance_km} />
        {doctor.languages.length > 0 && (
          <p className="text-sm text-zinc-500">
            {doctor.languages.join(", ")}
          </p>
        )}
        <VerificationBadge
          verificationCount={doctor.verification.verification_count}
          staleDays={doctor.verification.stale_days}
        />
        <StalenessWarning
          staleDays={doctor.verification.stale_days}
          lastVerified={null}
        />
        <div className="pt-1">
          <a
            href={googleSearchUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            Search Google &nearr;
          </a>
        </div>
      </Card>
    </Link>
  );
}
