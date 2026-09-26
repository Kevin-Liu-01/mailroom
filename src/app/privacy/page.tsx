import Link from "next/link";

export const metadata = { title: "mailroom · privacy" };

export default function Privacy() {
  return (
    <div className="section max-w-3xl space-y-8">
      <h1 className="text-[clamp(34px,4.6vw,64px)] leading-[1.05]">Privacy</h1>
      <div className="space-y-5 text-[16px] leading-relaxed">
        <p><strong>What Mailroom reads.</strong> Message metadata only: sender, subject, date, Gmail&apos;s short preview snippet, labels, and bulk-mail headers. Message bodies are never fetched, stored, or sent anywhere.</p>
        <p><strong>What Mailroom stores.</strong> Your Google account id and email, an encrypted refresh token, your policy settings, run receipts (which labels changed on which message ids), sender statistics, and cached AI judgments about individual messages. Data lives in a Postgres database hosted by Neon in the United States.</p>
        <p><strong>What leaves Google.</strong> For triage and search, the metadata above is sent to TypeSafe (typesafe.ai), which returns typed probabilities and does not train on requests. Nothing is sent to any other third party.</p>
        <p><strong>What Mailroom does to your mailbox.</strong> It adds and removes labels, archives, marks read, and moves messages to Gmail&apos;s Trash, where Gmail keeps them for 30 days. It never sends mail, never unsubscribes on your behalf, and never deletes anything permanently.</p>
        <p><strong>Deleting your data.</strong> Disconnect from the dashboard. That revokes the Google token and deletes every row Mailroom holds about you. Labels already in your Gmail stay yours.</p>
        <p><strong>Google API Services.</strong> Mailroom&apos;s use of information received from Google APIs adheres to the <a className="underline" href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noreferrer">Google API Services User Data Policy</a>, including the Limited Use requirements.</p>
        <p><strong>Contact.</strong> Kevin Liu, k.bowen.liu@gmail.com.</p>
      </div>
      <Link href="/" className="btn">Back</Link>
    </div>
  );
}
