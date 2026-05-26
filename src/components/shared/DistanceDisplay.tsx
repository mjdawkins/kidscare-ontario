export function DistanceDisplay({ km }: { km: number }) {
  if (km < 1) {
    return <span className="text-sm text-zinc-500">{(km * 1000).toFixed(0)}m away</span>;
  }
  return <span className="text-sm text-zinc-500">{km.toFixed(1)} km away</span>;
}
