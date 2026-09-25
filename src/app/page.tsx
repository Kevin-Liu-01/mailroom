import Link from "next/link";
import { auth } from "@/auth";
import { SignInButton } from "@/components/SignInButton";
import { CATEGORIES, defaultPolicy } from "@/lib/policy/schema";
import { buildRules } from "@/lib/policy/rules";
import { ESTIMATED_TOKENS_PER_MESSAGE, USD_PER_INPUT_TOKEN } from "@/lib/ai/triage";

export default async function Landing({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const session = await auth();
  const { error } = await searchParams;
  const policy = defaultPolicy();
  const rules = buildRules(policy);
  const perThousand = 1000 * ESTIMATED_TOKENS_PER_MESSAGE * USD_PER_INPUT_TOKEN;

  return (
    <div className="space-y-20">
      <section className="space-y-6 pt-6">
        <p className="label">Opinionated Gmail suite</p>
        <h1 className="max-w-3xl text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
          Your inbox, sorted by rules you can read and AI judgments that cost pennies.
        </h1>
        <p className="max-w-2xl text-lg text-muted">
          Mailroom applies a fixed taxonomy of labels and filters to your Gmail, ages out noise on a schedule you
          control, and asks <a className="underline decoration-accent" href="https://typesafe.ai">TypeSafe</a>&apos;s Jev
          model four narrow questions about whatever the rules could not place. Every run previews first and can be undone.
        </p>
        {error === "scope" ? (
          <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
            Mailroom needs the Gmail permissions you unchecked. Sign in again and leave &quot;Read, compose, send, and permanently delete&quot; checked; Mailroom never sends or permanently deletes anything, but that is the scope Gmail labels and archiving live under.
          </p>
        ) : null}
        <div className="flex flex-wrap items-center gap-3">
          {session?.user ? <Link href="/app" className="btn-primary">Open your dashboard</Link> : <SignInButton />}
          <a href="#how" className="btn">See how it works</a>
        </div>
        <p className="text-xs text-muted">
          Google shows an &quot;unverified app&quot; notice until Mailroom finishes Google&apos;s review. The owner and up to 100 people can connect today; click Advanced, then continue.
        </p>
      </section>

      <section id="how" className="space-y-6">
        <h2 className="text-2xl font-semibold tracking-tight">How a run works</h2>
        <ol className="grid gap-4 sm:grid-cols-3">
          {[
            ["1. Deterministic rules", "Standing Gmail filters label mail as it arrives. Each run then re-checks a handful of searches: stragglers still in the inbox, codes older than 30 days, dev and social notifications older than 90 days, unread promotions older than two weeks. Search plus label change, nothing else."],
            ["2. Typed AI triage", "Primary-tab mail that no rule placed goes to TypeSafe with metadata only: sender, subject, preview, bulk headers. Jev returns a category with a probability distribution and three yes/no probabilities. Code applies thresholds you set."],
            ["3. Receipt and undo", "Every run records what it matched, what it changed, and what the AI cost. One click reverses a run: labels come off, archived mail returns to the inbox, trashed mail comes back within Gmail's 30-day window."],
          ].map(([title, body]) => (
            <li key={title} className="card space-y-2">
              <h3 className="font-medium">{title}</h3>
              <p className="text-sm text-muted">{body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section id="policy" className="space-y-6">
        <h2 className="text-2xl font-semibold tracking-tight">The policy, spelled out</h2>
        <p className="max-w-2xl text-muted">These are the defaults. Every threshold, list, and switch is editable per mailbox; the structure is not, which is the point.</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {CATEGORIES.filter((c) => c.label).map((c) => {
            const skips = policy.categories.skipInbox.includes(c.id);
            const never = policy.categories.neverImportant.includes(c.id);
            const prot = policy.categories.protected.includes(c.id);
            return (
              <div key={c.id} className="card space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-medium">{c.label}</h3>
                  <span className="text-[10px] uppercase tracking-wide text-muted">{skips ? "skips inbox" : prot ? "protected" : never ? "not important" : "stays"}</span>
                </div>
                <p className="text-sm text-muted">{c.description}</p>
              </div>
            );
          })}
        </div>
        <div className="card space-y-3">
          <h3 className="font-medium">Aging rules the engine runs every day</h3>
          <ul className="grid gap-2 text-sm sm:grid-cols-2">
            {rules.filter((r) => !r.id.startsWith("archive-stragglers")).map((r) => (
              <li key={r.id} className="flex gap-2">
                <span className="mono shrink-0 rounded bg-accent-soft px-1.5 py-0.5 text-[11px]">{r.kind}</span>
                <span className="text-muted">{r.why}</span>
              </li>
            ))}
            <li className="flex gap-2"><span className="mono shrink-0 rounded bg-accent-soft px-1.5 py-0.5 text-[11px]">archive</span><span className="text-muted">Dev, social, and receipt mail that a filter missed leaves the inbox after {policy.aging.archiveStragglersAfterDays} days.</span></li>
          </ul>
          <p className="text-xs text-muted">Trash means Gmail Trash with its 30-day recovery. Mailroom never permanently deletes, never sends, never unsubscribes, and never trashes Work, Personal, Finance, Travel, Events, Recruiting, or School mail.</p>
        </div>
      </section>

      <section id="ai" className="space-y-6">
        <h2 className="text-2xl font-semibold tracking-tight">What the AI is asked</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {[
            ["Category (Choice)", "Which of the fourteen buckets fits? Returns a full probability distribution; the label is applied only above your confidence threshold, 0.6 by default."],
            ["Automated? (Noul)", "Was this generated by a system or bulk mailer rather than written for you? Above 0.85, and in a noisy category, it leaves Primary."],
            ["Needs action? (Noul)", "Do you have to reply, decide, pay, sign, or schedule? Above 0.7 it gets the Action Needed label and shows up on your dashboard."],
            ["Time-sensitive? (Noul)", "Does it lose value within days? Kept as a signal on the dashboard so codes and deadlines float up."],
          ].map(([t, b]) => (
            <div key={t} className="card space-y-1.5"><h3 className="font-medium">{t}</h3><p className="text-sm text-muted">{b}</p></div>
          ))}
        </div>
        <p className="text-sm text-muted">Only metadata is sent: sender, subject, Gmail&apos;s preview snippet, date, and whether the mail carries bulk headers. Bodies never leave Google. Each message is judged once and cached.</p>
      </section>

      <section id="cost" className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">What it costs</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="card"><p className="label">Rules</p><p className="mt-1 text-2xl font-semibold">$0</p><p className="text-sm text-muted">Gmail searches and label changes are free API calls.</p></div>
          <div className="card"><p className="label">AI triage</p><p className="mt-1 text-2xl font-semibold">≈ ${perThousand.toFixed(2)} / 1,000 emails</p><p className="text-sm text-muted">Jev bills ${(USD_PER_INPUT_TOKEN * 1_000_000).toFixed(3)} per million input tokens; a message with four questions is about {ESTIMATED_TOKENS_PER_MESSAGE} tokens.</p></div>
          <div className="card"><p className="label">Per-run cap</p><p className="mt-1 text-2xl font-semibold">${policy.ai.budgetUsdPerRun.toFixed(2)}</p><p className="text-sm text-muted">Default budget per run, adjustable. The dashboard shows actual spend from token counts.</p></div>
        </div>
      </section>

      <section className="card flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Connect your Gmail</h2>
          <p className="text-sm text-muted">First run is a preview. Nothing changes until you press Apply.</p>
        </div>
        {session?.user ? <Link href="/app" className="btn-primary">Open your dashboard</Link> : <SignInButton label="Connect Gmail and preview" />}
      </section>
    </div>
  );
}
