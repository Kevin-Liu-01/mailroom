import NextAuth, { type NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { encryptSecret } from "@/lib/crypto";
import { defaultPolicy } from "@/lib/policy/schema";

export const GMAIL_SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/gmail.modify",
  "https://www.googleapis.com/auth/gmail.settings.basic",
];

const base = DrizzleAdapter(db, {
  usersTable: schema.users,
  accountsTable: schema.accounts,
  sessionsTable: schema.sessions,
  verificationTokensTable: schema.verificationTokens,
});

// Tokens are encrypted before they touch the database.
const adapter: NextAuthConfig["adapter"] = {
  ...base,
  linkAccount: (account) =>
    base.linkAccount!({
      ...account,
      refresh_token: account.refresh_token ? encryptSecret(account.refresh_token) : account.refresh_token,
      access_token: account.access_token ? encryptSecret(account.access_token) : account.access_token,
      id_token: undefined,
    }),
};

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter,
  session: { strategy: "database", maxAge: 30 * 24 * 3600 },
  trustHost: true,
  providers: [
    Google({
      authorization: { params: { access_type: "offline", prompt: "consent", scope: GMAIL_SCOPES.join(" "), include_granted_scopes: "true" } },
    }),
  ],
  pages: { signIn: "/", error: "/" },
  callbacks: {
    async signIn({ account }) {
      if (account?.provider !== "google") return false;
      const granted = account.scope ?? "";
      if (!granted.includes("gmail.modify")) return "/?error=scope";
      // Re-consent replaces the stored refresh token (Auth.js does not update accounts on later sign-ins).
      if (account.refresh_token) {
        await db.update(schema.accounts)
          .set({ refresh_token: encryptSecret(account.refresh_token), scope: account.scope, access_token: account.access_token ? encryptSecret(account.access_token) : null, expires_at: account.expires_at ?? null })
          .where(and(eq(schema.accounts.provider, "google"), eq(schema.accounts.providerAccountId, account.providerAccountId)));
      }
      return true;
    },
    session({ session, user }) {
      session.user.id = user.id;
      return session;
    },
  },
  events: {
    async createUser({ user }) {
      if (!user.id || !user.email) return;
      await db.insert(schema.mailboxes).values({ userId: user.id, email: user.email, policy: defaultPolicy() }).onConflictDoNothing();
    },
    async signIn({ user }) {
      if (!user.id || !user.email) return;
      await db.insert(schema.mailboxes).values({ userId: user.id, email: user.email, policy: defaultPolicy() }).onConflictDoNothing();
      await db.update(schema.mailboxes).set({ status: "active", updatedAt: new Date() }).where(eq(schema.mailboxes.userId, user.id));
    },
  },
});
