"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { isValidPostalCode, normalizePostalCode } from "@/lib/utils";

export function AlertForm() {
  const router = useRouter();
  const [postalCode, setPostalCode] = useState("");
  const [radius, setRadius] = useState(10);
  const [type, setType] = useState<"pediatrician_primary" | "family_doctor" | "">("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!isValidPostalCode(postalCode)) {
      setError("Enter a valid postal code");
      return;
    }

    setSubmitting(true);
    setError("");

    const res = await fetch("/api/alerts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        alert_type: "doctor",
        postal_code: normalizePostalCode(postalCode),
        radius_km: radius,
        doctor_type_filter: type || undefined,
      }),
    });

    if (res.ok) {
      router.push("/alerts");
      router.refresh();
    } else {
      const data = await res.json();
      setError(data.error ?? "Something went wrong");
    }

    setSubmitting(false);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <Input
        label="Postal code"
        placeholder="M5V 2T6"
        value={postalCode}
        onChange={(e) => { setPostalCode(e.target.value); setError(""); }}
        error={error}
      />

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-zinc-700">Radius (km)</label>
        <input
          type="range"
          min={5}
          max={50}
          step={5}
          value={radius}
          onChange={(e) => setRadius(parseInt(e.target.value))}
          className="w-full"
        />
        <span className="text-sm text-zinc-500">{radius} km</span>
      </div>

      <select
        value={type}
        onChange={(e) => setType(e.target.value as typeof type)}
        className="h-10 rounded-lg border border-zinc-300 px-3 text-sm"
      >
        <option value="">Any doctor type</option>
        <option value="pediatrician_primary">Primary care pediatrician</option>
        <option value="family_doctor">Family doctor</option>
      </select>

      <Button type="submit" disabled={submitting}>
        {submitting ? "Creating..." : "Create Alert"}
      </Button>
    </form>
  );
}
