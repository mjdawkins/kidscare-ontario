"use client";

interface ErWaitProps {
  hospitalName: string;
  waitMinutes: number;
  patientsInED: number;
  patientsWaiting: number;
  distanceKm: number;
}

function formatWait(minutes: number): string {
  if (minutes === 0) return "Unknown";
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hrs === 0) return `${mins} min`;
  if (mins === 0) return `${hrs} hr`;
  return `${hrs} hr ${mins} min`;
}

function waitColor(minutes: number): string {
  if (minutes === 0) return "text-zinc-500";
  if (minutes < 60) return "text-green-600";
  if (minutes < 120) return "text-amber-600";
  return "text-red-600";
}

export function ErWaitCard({ hospitalName, waitMinutes, patientsInED, patientsWaiting, distanceKm }: ErWaitProps) {
  return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-4">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-semibold text-zinc-900">{hospitalName}</h3>
          <p className="text-sm text-zinc-500">{distanceKm.toFixed(1)} km away</p>
        </div>
        <div className="text-right">
          <p className={`text-lg font-bold ${waitColor(waitMinutes)}`}>
            {formatWait(waitMinutes)}
          </p>
          <p className="text-xs text-zinc-500">estimated wait</p>
        </div>
      </div>
      <div className="mt-2 flex gap-4 text-xs text-zinc-600">
        <span>{patientsInED} in ED</span>
        <span>{patientsWaiting} waiting</span>
      </div>
    </div>
  );
}

interface ErWaitListProps {
  erWaits: ErWaitProps[];
}

export function ErWaitList({ erWaits }: ErWaitListProps) {
  if (erWaits.length === 0) return null;

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold text-zinc-900">ER Wait Times Near You</h2>
      <p className="text-xs text-zinc-500">
        Wait times are estimates. Patients are seen by priority, not first-come-first-served.
        Always call 911 in an emergency.
      </p>
      {erWaits.map((er) => (
        <ErWaitCard key={er.hospitalName} {...er} />
      ))}
      <p className="text-xs text-zinc-400">
        Data: Halton Healthcare · Updated every 15 min
      </p>
    </div>
  );
}
