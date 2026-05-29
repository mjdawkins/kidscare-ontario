export function DistanceDisplay({ km }: { km: number }) {
  if (km < 0.1) {
    return <span className="text-sm text-slate-600">{(km * 1000).toFixed(0)} m away</span>;
  }
  return <span className="text-sm text-slate-600">{km.toFixed(1)} km away</span>;
}
