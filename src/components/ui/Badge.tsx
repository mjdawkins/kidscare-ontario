interface BadgeProps {
  variant?: "green" | "amber" | "red" | "neutral" | "blue";
  children: React.ReactNode;
}

const variants: Record<string, string> = {
  green: "bg-emerald-100 text-emerald-800 ring-emerald-600/30",
  amber: "bg-amber-100 text-amber-800 ring-amber-600/30",
  red: "bg-rose-100 text-rose-800 ring-rose-600/30",
  neutral: "bg-zinc-100 text-zinc-700 ring-zinc-400/20",
  blue: "bg-blue-100 text-blue-800 ring-blue-600/30",
};

export function Badge({ variant = "neutral", children }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${variants[variant]}`}
    >
      {children}
    </span>
  );
}
