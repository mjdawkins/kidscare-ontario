"use client";

interface ErWaitProps {
  hospitalName: string;
  waitMinutes: number;
  patientsInED: number;
  patientsWaiting: number;
  distanceKm: number;
  isLive?: boolean;
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
  if (minutes === 0) return "text-gray-700";
  if (minutes < 60) return "text-green-700";
  if (minutes < 120) return "text-amber-700";
  return "text-red-700";
}

export function ErWaitCard({ hospitalName, waitMinutes, patientsInED, patientsWaiting, distanceKm, isLive }: ErWaitProps) {
  const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(hospitalName + " Hospital, Ontario")}`;

  return (
    <div className={`rounded-xl border p-4 ${isLive ? "border-red-200 bg-red-50" : "border-zinc-200 bg-white"}`}>
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-semibold text-gray-900">{hospitalName}</h3>
          <p className="text-sm text-gray-700">{distanceKm.toFixed(1)} km away</p>
        </div>
        <div className="text-right">
          <p className={`text-lg font-bold ${waitColor(waitMinutes)}`}>
            {formatWait(waitMinutes)}
          </p>
          <div className="flex items-center gap-1 justify-end">
            {isLive && (
              <span className="text-xs font-semibold text-green-800 bg-green-100 rounded-full px-1.5 py-0.5">Live</span>
            )}
            <p className="text-xs text-gray-700">
              {isLive ? "current" : "avg wait"}
            </p>
          </div>
        </div>
      </div>
      {patientsInED > 0 && (
        <div className="mt-2 flex items-center gap-4 text-xs text-gray-800">
          <span>{patientsInED} in emergency dept</span>
          {patientsWaiting > 0 && <span>{patientsWaiting} waiting</span>}
        </div>
      )}
      <div className="mt-2">
        <a
          href={directionsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm font-medium text-blue-700 hover:underline"
        >
          Get Directions &#8599;
        </a>
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
      <h2 className="text-lg font-semibold text-gray-900">ER Wait Times Near You</h2>
      <p className="text-xs text-gray-700">
        Wait times are estimates. Patients are seen by priority, not first-come-first-served.
        Always call 911 in an emergency.
      </p>
      {erWaits.map((er) => (
        <ErWaitCard key={er.hospitalName} {...er} />
      ))}
      <p className="text-xs text-gray-700">
        Data: Halton Healthcare &middot; Updated every 15 min
      </p>
    </div>
  );
}
