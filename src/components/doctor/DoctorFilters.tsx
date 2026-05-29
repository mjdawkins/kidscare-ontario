"use client";

import { useRouter, useSearchParams } from "next/navigation";

export function DoctorFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();

  function setParam(key: string, value: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    router.push(`/pediatricians?${params.toString()}`);
  }

  const activeType = searchParams.get("doctor_type");
  const activeStatus = searchParams.get("accepting_status");
  const activeReferral = searchParams.get("referral_required");

  return (
    <div className="flex flex-col gap-3">
      <select
        value={activeType ?? ""}
        onChange={(e) => setParam("doctor_type", e.target.value || null)}
        className="h-10 rounded-lg border border-slate-300 px-3 text-sm"
      >
        <option value="">All doctor types</option>
        <option value="pediatrician_primary">Primary care pediatrician</option>
        <option value="pediatrician_specialist">Specialist pediatrician</option>
        <option value="family_doctor">Family doctor</option>
      </select>

      <select
        value={activeStatus ?? ""}
        onChange={(e) => setParam("accepting_status", e.target.value || null)}
        className="h-10 rounded-lg border border-slate-300 px-3 text-sm"
      >
        <option value="">Any status</option>
        <option value="accepting">Accepting patients</option>
        <option value="waitlist">Waitlist only</option>
        <option value="not_accepting">Not accepting</option>
      </select>

      <select
        value={activeReferral ?? ""}
        onChange={(e) => setParam("referral_required", e.target.value || null)}
        className="h-10 rounded-lg border border-slate-300 px-3 text-sm"
      >
        <option value="">Any referral requirement</option>
        <option value="false">No referral needed</option>
        <option value="true">Referral required</option>
      </select>
    </div>
  );
}
