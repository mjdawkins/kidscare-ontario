"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, FormEvent } from "react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { isValidPostalCode, normalizePostalCode } from "@/lib/utils";

export function SearchBar({ basePath }: { basePath: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(searchParams.get("postal") ?? "");
  const [error, setError] = useState("");

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = value.trim();

    if (!trimmed) {
      setError("Enter a postal code");
      return;
    }

    if (!isValidPostalCode(trimmed)) {
      setError("Enter a valid postal code (e.g., M5V 2T6)");
      return;
    }

    setError("");
    const normalized = normalizePostalCode(trimmed);
    router.push(`${basePath}?postal=${normalized}`);
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <Input
        placeholder="Postal code (e.g., M5V 2T6)"
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setError("");
        }}
        error={error}
        className="flex-1"
      />
      <Button type="submit">Search</Button>
    </form>
  );
}
