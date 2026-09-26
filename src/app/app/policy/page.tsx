import { Clock, Lock, SlidersHorizontal } from "lucide-react";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { PolicyEditor } from "@/components/PolicyEditor";
import { Meta, PageHead } from "@/components/app/Bits";

export const dynamic = "force-dynamic";

export default async function PolicyPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/");
  return (
    <div className="section space-y-8">
      <PageHead icon={<SlidersHorizontal size={26} />} title="Your policy">
        <Meta icon={Lock}>the structure is fixed</Meta>
        <Meta icon={SlidersHorizontal}>every number, list, and switch is yours</Meta>
        <Meta icon={Clock}>changes apply from the next run</Meta>
      </PageHead>
      <PolicyEditor />
    </div>
  );
}
