"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, FormEvent } from "react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { isValidPostalCode, normalizePostalCode } from "@/lib/utils";

async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  try {
    const url = new URL("https://nominatim.openstreetmap.org/reverse");
    url.searchParams.set("lat", lat.toString());
    url.searchParams.set("lon", lng.toString());
    url.searchParams.set("format", "json");
    url.searchParams.set("zoom", "16");

    const res = await fetch(url.toString(), {
      headers: { "User-Agent": "KidsCareOntario/1.0" },
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) return null;
    const data = await res.json();
    return data.display_name ?? null;
  } catch {
    return null;
  }
}

export function SearchBar({ basePath }: { basePath: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const hasLocation = searchParams.get("lat") && searchParams.get("lng");
  const [value, setValue] = useState(searchParams.get("postal") ?? "");
  const [error, setError] = useState("");
  const [locating, setLocating] = useState(false);
  const [locationName, setLocationName] = useState(
    hasLocation ? "Your current location" : ""
  );

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
    setLocationName("");
    const normalized = normalizePostalCode(trimmed);
    router.push(`${basePath}?postal=${normalized}`);
  }

  async function useMyLocation() {
    if (!navigator.geolocation) {
      setError("Geolocation not supported by your browser");
      return;
    }

    setLocating(true);
    setError("");

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;

        // Reverse geocode to show the user their location
        const name = await reverseGeocode(latitude, longitude);
        setLocationName(name ?? `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
        setLocating(false);

        router.push(
          `${basePath}?lat=${latitude.toFixed(6)}&lng=${longitude.toFixed(6)}`
        );
      },
      () => {
        setLocating(false);
        setError("Could not get your location. Enter a postal code instead.");
      },
      { timeout: 10000, maximumAge: 300000 }
    );
  }

  return (
    <div className="flex flex-col gap-2">
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

      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="secondary"
          onClick={useMyLocation}
          disabled={locating}
          className="font-semibold"
        >
          {locating ? "Finding your location..." : "Use my location"}
        </Button>
        {locationName && (
          <p className="text-sm text-slate-600 truncate">{locationName}</p>
        )}
      </div>
    </div>
  );
}
