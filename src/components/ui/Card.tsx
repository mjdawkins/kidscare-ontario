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
      className={`w-full rounded-xl border border-zinc-200 bg-white p-4 text-left shadow-sm transition-shadow hover:shadow-md ${className}`}
    >
      {children}
    </Component>
  );
}
