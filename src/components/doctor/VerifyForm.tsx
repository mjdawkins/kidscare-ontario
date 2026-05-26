"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";

interface VerifyFormProps {
  doctorId: string;
}

export function VerifyForm({ doctorId }: VerifyFormProps) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<"accepting" | "waitlist" | "not_accepting">("accepting");
  const [method, setMethod] = useState<"called_office" | "visited_in_person" | "received_appointment" | "told_by_receptionist">("called_office");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);

    const res = await fetch(`/api/doctors/${doctorId}/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reported_status: status, how_confirmed: method, notes: notes || undefined }),
    });

    if (res.ok) {
      setOpen(false);
      window.location.reload();
    }

    setSubmitting(false);
  }

  if (!open) {
    return (
      <Button variant="secondary" onClick={() => setOpen(true)}>
        Is this accurate? Tap to verify
      </Button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 rounded-xl border border-zinc-200 p-4">
      <h3 className="font-semibold">How did you confirm this?</h3>

      <select value={status} onChange={(e) => setStatus(e.target.value as typeof status)} className="h-10 rounded-lg border border-zinc-300 px-3 text-sm">
        <option value="accepting">Doctor is accepting new patients</option>
        <option value="waitlist">Doctor has a waitlist</option>
        <option value="not_accepting">Doctor is not accepting</option>
      </select>

      <select value={method} onChange={(e) => setMethod(e.target.value as typeof method)} className="h-10 rounded-lg border border-zinc-300 px-3 text-sm">
        <option value="called_office">I called the office</option>
        <option value="visited_in_person">I visited in person</option>
        <option value="received_appointment">I received an appointment</option>
        <option value="told_by_receptionist">Receptionist told me</option>
      </select>

      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Optional: any notes (e.g., 'they said call back in January')"
        className="min-h-[60px] rounded-lg border border-zinc-300 p-3 text-sm"
        maxLength={500}
      />

      <div className="flex gap-2">
        <Button type="submit" disabled={submitting}>
          {submitting ? "Submitting..." : "Submit Verification"}
        </Button>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
