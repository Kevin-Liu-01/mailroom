// Smoke test for the TypeSafe triage questions against realistic metadata. Run: pnpm smoke:triage
import { withKey } from "@/lib/ai/client";
import { triageMessage } from "@/lib/ai/triage";
const samples = [
  { from: "Coastal Recruiting <hello@coastalrecruiting.io>", subject: "Senior Frontend Engineer role - $210k - remote", snippet: "Hi Kevin, I came across your profile and think you'd be a great fit for a Senior Frontend role at a Series B fintech. Are you open to a quick chat this week?", list: "<mailto:unsub@coastalrecruiting.io>" },
  { from: "Chase <no.reply.alerts@chase.com>", subject: "Your statement is ready", snippet: "Your Chase Sapphire statement for September is now available. Minimum payment due Oct 15.", list: "" },
  { from: "Mom <liuyusei7@gmail.com>", subject: "dinner sunday?", snippet: "are you coming home sunday? dad wants to know if we should get the tickets for the game, let me know by tomorrow", list: "" },
  { from: "Google <no-reply@accounts.google.com>", subject: "Security alert", snippet: "A new sign-in on Windows. We noticed a new sign-in to your Google Account. If this was you, you don't need to do anything.", list: "" },
  { from: "Sweetgreen <hello@email.sweetgreen.com>", subject: "20% off your next order", snippet: "This week only: get 20% off any bowl when you order through the app. Use code GREEN20.", list: "<https://sweetgreen.com/unsub>" },
];
async function main() {
for (const s of samples) {
  const meta = { id: "x", threadId: "x", labelIds: ["INBOX", "CATEGORY_PERSONAL"], snippet: s.snippet, internalDate: String(Date.now()), headers: { from: s.from, subject: s.subject, date: new Date().toUTCString(), ...(s.list ? { "list-unsubscribe": s.list } : {}) } };
  const r = await triageMessage(meta, "k.bowen.liu@gmail.com");
  const j = r.judgment;
  console.log(`${s.subject.padEnd(48)} -> ${j.category.padEnd(11)} conf ${j.categoryConfidence.toFixed(2)}  automated ${j.automated.toFixed(2)}  action ${j.needsAction.toFixed(2)}  time ${j.timeSensitive.toFixed(2)}  tokens ${r.inputTokens} model ${r.model}`);
}
}
withKey(process.env.TYPESAFE_API_KEY ?? "", main);
