// Runs realistic questions through the TypeSafe-backed query compiler and prints the Gmail query. Run: pnpm smoke:search
import { compileSearch } from "@/lib/search/compile";
const known = [
  { domain: "uber.com", name: "Uber Receipts" }, { domain: "em.target.com", name: "Target" }, { domain: "chase.com", name: "Chase" },
  { domain: "coastalrecruiting.io", name: "Coastal Recruiting" }, { domain: "liuyusei7@gmail.com", name: "Mom" }, { domain: "united.com", name: "United Airlines" },
];
const labels = new Set(["Receipts", "Recruiting", "Banking & Finance", "Trips & Travel", "Accounts & Security", "Marketing & Deals", "Newsletters", "Social Media", "Dev Notifications", "Work", "Personal", "Events", "School"]);
async function main() {
  for (const q of [
    "receipts from uber last month", "unread mail from real people this week", "recruiters I never answered", "what can I trash",
    "flights to tokyo in march", "emails from mom about the game", "bank statements from 2025", "security codes from today",
    "large attachments older than 6 months", "anything about the apartment lease", "starred mail from chase",
  ]) {
    const c = await compileSearch(q, { knownSenders: known, hasLabel: (n) => labels.has(n), now: new Date() });
    console.log(`${q.padEnd(40)} -> ${c.gmail}\n${" ".repeat(43)}${c.parts.map((p) => `${p.label}=${p.value}`).join(" | ")}  [${c.usage.inputTokens} tok]`);
  }
}
main();
