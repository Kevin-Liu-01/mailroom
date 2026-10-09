import { AppNav } from "@/components/app/AppNav";
import { PrivacyProvider } from "@/components/app/Privacy";
import { emailsHidden } from "@/lib/privacy-server";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <PrivacyProvider initial={await emailsHidden()}>
      <div className="app">
        <AppNav />
        {children}
      </div>
    </PrivacyProvider>
  );
}
