import Link from "next/link";

export const metadata = { title: "Mailroom · Terms" };

export default function Terms() {
  return (
    <div className="section max-w-3xl space-y-8">
      <h1 className="text-[clamp(34px,4.6vw,64px)] leading-[1.05]">Terms</h1>
      <div className="space-y-5 text-[16px] leading-relaxed">
        <p>Mailroom is a personal project by Kevin Liu, offered as is, without warranty. It changes labels in your Gmail on your instruction and on the schedule you enable. You are responsible for the policy you configure.</p>
        <p>Every change Mailroom makes is recorded and can be undone from the dashboard. Trash follows Gmail&apos;s 30-day recovery window. Mailroom cannot restore messages that Gmail has already purged.</p>
        <p>You may stop using Mailroom at any time by disconnecting, which deletes your data as described in the <Link className="underline" href="/privacy">privacy page</Link>.</p>
        <p>Usage is limited by Google&apos;s OAuth policies and by the free tiers of the services Mailroom runs on. Access may be paused if those limits are reached.</p>
      </div>
      <Link href="/" className="btn">Back</Link>
    </div>
  );
}
