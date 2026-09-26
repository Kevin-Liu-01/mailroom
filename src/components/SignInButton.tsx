import { signIn } from "@/auth";
import { GmailMark } from "@/components/GmailMark";

function GoogleG() {
  return (
    <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.5l6.7-6.7C35.6 2.6 30.2 0 24 0 14.6 0 6.6 5.4 2.7 13.2l7.8 6.1C12.4 13.3 17.7 9.5 24 9.5z"/><path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4.1 7.1-10.1 7.1-17.5z"/><path fill="#FBBC05" d="M10.5 28.7A14.5 14.5 0 0 1 9.5 24c0-1.6.3-3.2.8-4.7l-7.8-6.1A24 24 0 0 0 0 24c0 3.9.9 7.5 2.6 10.8l7.9-6.1z"/><path fill="#34A853" d="M24 48c6.2 0 11.6-2 15.4-5.6l-7.5-5.8c-2.1 1.4-4.8 2.3-7.9 2.3-6.3 0-11.6-3.8-13.5-9.2l-7.9 6.1C6.6 42.6 14.6 48 24 48z"/></svg>
  );
}

export function SignInButton({ label = "Connect Gmail", redirectTo = "/app", icon = "gmail", className = "btn-primary" }: { label?: string; redirectTo?: string; icon?: "gmail" | "google"; className?: string }) {
  return (
    <form action={async () => { "use server"; await signIn("google", { redirectTo }); }}>
      <button className={className} type="submit">
        {icon === "gmail" ? <GmailMark size={16} /> : <GoogleG />}
        {label}
      </button>
    </form>
  );
}
