import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { PolicyEditor } from "@/components/PolicyEditor";

export const dynamic = "force-dynamic";

export default async function PolicyPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/");
  return (
    <div className="section space-y-6">
      <div>
        <Link href="/app" className="text-sm text-muted hover:text-ink">← Dashboard</Link>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">Your policy</h1>
        <p className="text-sm text-muted">The structure is fixed; every number, list, and switch is yours. Changes apply from the next run.</p>
      </div>
      <PolicyEditor />
    </div>
  );
}
