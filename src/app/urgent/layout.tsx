import { Header } from "@/components/layout/Header";
import { MobileNav } from "@/components/layout/MobileNav";

export default function UrgentLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Header />
      <main className="flex-1 px-4 py-6 pb-20 md:pb-6">{children}</main>
      <MobileNav />
    </>
  );
}
