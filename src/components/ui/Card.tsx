interface CardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}

export function Card({ children, className = "", onClick }: CardProps) {
  const Component = onClick ? "button" : "div";
  return (
    <Component
      onClick={onClick as any}
      className={`w-full rounded-lg border border-slate-200 bg-white p-4 text-left transition-colors hover:border-slate-300 ${className}`}
    >
      {children}
    </Component>
  );
}
