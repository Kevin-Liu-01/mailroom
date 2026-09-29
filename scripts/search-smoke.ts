// Runs realistic questions through the TypeSafe-backed query compiler and prints the Gmail query.
// Run: set -a; . ./.env.local; set +a; ./node_modules/.bin/tsx --tsconfig tsconfig.json scripts/search-smoke.ts [extra queries...]
import { compileSearch } from "@/lib/search/compile";
const known = [
  { domain: "uber.com", name: "Uber Receipts" }, { domain: "em.target.com", name: "Target" }, { domain: "chase.com", name: "Chase" },
  { domain: "coastalrecruiting.io", name: "Coastal Recruiting" }, { domain: "liuyusei7@gmail.com", name: "Mom" }, { domain: "united.com", name: "United Airlines" },
  { domain: "vercel.com", name: "Vercel" }, { domain: "princeton.edu", name: "Princeton University" }, { domain: "amazon.com", name: "Amazon.com" }, { domain: "linkedin.com", name: "LinkedIn" },
];
const labels = new Set(["Receipts", "Recruiting", "Banking & Finance", "Trips & Travel", "Accounts & Security", "Marketing & Deals", "Newsletters", "Social Media", "Dev Notifications", "Work", "Personal", "Events", "School"]);
const DEFAULT = [
  "receipts from uber last month", "unread mail from real people this week", "recruiters I never answered", "what can I trash",
  "flights to tokyo in march", "emails from mom about the game", "bank statements from 2025", "security codes from today",
  "large attachments older than 6 months", "anything about the apartment lease", "starred mail from chase",
  "what did chase send me this month", "invoices from vercel", "messages i sent last week that got no reply", "everything from princeton",
  "newsletters i never open", "old promotions", "linkedin", "things due this week", "job offers", "tax forms 2025", "amazon orders in august",
  "how many emails did i get today", "unread newsletters", "mail from real people that still needs my reply", "verification codes and sign-in alerts",
  "flights this year", "who emailed me the most this month", "emails with pdfs from my bank", "waiting on a reply from anish",
];
async function main() {
  const qs = process.argv.slice(2).length ? process.argv.slice(2) : DEFAULT;
  let tokens = 0;
  for (const q of qs) {
    const c = await compileSearch(q, { knownSenders: known, hasLabel: (n) => labels.has(n), now: new Date() });
    tokens += c.usage.inputTokens;
    console.log(`${q}\n  -> ${c.gmail}${c.count ? "  [COUNT]" : ""}\n     ${c.parts.map((p) => `${p.label}=${p.value}`).join(" | ") || "(no parts)"}`);
  }
  console.log(`\n${qs.length} queries, ${tokens} input tokens`);
}
main();
