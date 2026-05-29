interface StalenessWarningProps {
  staleDays: number | null;
  lastVerified: string | null;
}

export function StalenessWarning({ staleDays, lastVerified }: StalenessWarningProps) {
  if (lastVerified === null) {
    return (
      <p className="text-sm text-gray-600">
        No community data yet — be the first to verify
      </p>
    );
  }

  if (staleDays !== null && staleDays > 90) {
    return (
      <p className="text-sm text-red-600">
        Last confirmed {staleDays} days ago — may be outdated. Tap to verify.
      </p>
    );
  }

  if (staleDays !== null && staleDays > 30) {
    return (
      <p className="text-sm text-amber-600">
        Last confirmed {staleDays} days ago — may be outdated
      </p>
    );
  }

  return null;
}
