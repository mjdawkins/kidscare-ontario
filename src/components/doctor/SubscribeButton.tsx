"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/components/auth/AuthProvider";
import { createBrowserClient } from "@supabase/ssr";

interface SubscribeButtonProps {
  doctorId: string;
  doctorName: string;
}

export function SubscribeButton({ doctorId, doctorName }: SubscribeButtonProps) {
  const { user } = useAuth();
  const [state, setState] = useState<"idle" | "subscribing" | "subscribed" | "error">("idle");
  const [error, setError] = useState("");

  if (!user) {
    return (
      <p className="text-sm text-zinc-500 text-center">
        Sign in to get notified when this doctor is accepting patients.
      </p>
    );
  }

  async function handleSubscribe() {
    setState("subscribing");
    setError("");

    try {
      const res = await fetch("/api/alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          alert_type: "doctor",
          target_id: doctorId,
        }),
      });

      if (res.ok) {
        setState("subscribed");
      } else {
        const data = await res.json();
        setError(data.error ?? "Something went wrong");
        setState("idle");
      }
    } catch {
      setError("Network error. Try again.");
      setState("idle");
    }
  }

  if (state === "subscribed") {
    return (
      <p className="text-sm font-medium text-green-700">
        You'll be notified when {doctorName} is accepting patients.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <Button
        onClick={handleSubscribe}
        disabled={state === "subscribing"}
        variant="primary"
      >
        {state === "subscribing"
          ? "Subscribing..."
          : `Alert me when ${doctorName} is accepting`}
      </Button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
