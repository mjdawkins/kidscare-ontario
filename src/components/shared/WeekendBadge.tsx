interface WeekendBadgeProps {
  openSaturday: boolean;
  openSunday: boolean;
  openAfter6pm: boolean;
}

export function WeekendBadge({ openSaturday, openSunday, openAfter6pm }: WeekendBadgeProps) {
  const badges: string[] = [];

  if (openAfter6pm) badges.push("Open after 6pm");
  if (openSaturday) badges.push("Open Saturday");
  if (openSunday) badges.push("Open Sunday");

  return (
    <div className="flex flex-wrap gap-1">
      {badges.map((label) => (
        <span
          key={label}
          className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-600/20"
        >
          {label}
        </span>
      ))}
    </div>
  );
}
