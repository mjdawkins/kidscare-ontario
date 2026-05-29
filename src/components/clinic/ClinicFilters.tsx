"use client";

import { useRouter, useSearchParams } from "next/navigation";

const FILTERS = [
  { key: "open_now", label: "Open now" },
  { key: "sees_children", label: "Sees children" },
  { key: "open_saturday", label: "Open Saturday" },
  { key: "open_sunday", label: "Open Sunday" },
  { key: "open_after_6pm", label: "Open after 6pm" },
] as const;

export function ClinicFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();

  function toggleFilter(key: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (params.get(key) === "true") {
      params.delete(key);
    } else {
      params.set(key, "true");
    }
    router.push(`/urgent?${params.toString()}`);
  }

  return (
    <div className="flex flex-wrap gap-2">
      {FILTERS.map(({ key, label }) => {
        const active = searchParams.get(key) === "true";
        return (
          <button
            key={key}
            onClick={() => toggleFilter(key)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              active
                ? "bg-blue-600 text-white shadow-sm"
                : "bg-zinc-100 text-neutral-700 hover:bg-zinc-200"
            }`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
