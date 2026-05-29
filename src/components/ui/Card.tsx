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
      className={`w-full rounded-2xl border border-zinc-200/80 bg-white p-4 text-left shadow-sm transition-all duration-150 hover:shadow-md hover:border-zinc-300 ${className}`}
    >
      {children}
    </Component>
  );
}
