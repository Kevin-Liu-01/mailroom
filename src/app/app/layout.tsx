import { AppNav } from "@/components/app/AppNav";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="app">
      <AppNav />
      {children}
    </div>
  );
}
