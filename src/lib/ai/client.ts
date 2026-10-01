import { AsyncLocalStorage } from "node:async_hooks";
import { eq } from "drizzle-orm";
import { TypeSafeClient } from "@typesafe-ai/sdk";
import { db, schema } from "@/db";
import { decryptSecret } from "@/lib/crypto";

/**
 * Bring your own key. Every Jev call runs inside a key context: the signed-in user's own TypeSafe key (stored
 * encrypted), or the house key for the one account named in OWNER_EMAIL. Without a key, Jev-backed features are
 * simply off; rules keep running for free.
 */
const keyStore = new AsyncLocalStorage<string>();
const clients = new Map<string, TypeSafeClient>();

export class NoKeyError extends Error {
  readonly code = "no_key" as const;
  constructor() { super("No TypeSafe key on this account. Add one in the dashboard to turn Jev on."); }
}

function clientFor(apiKey: string): TypeSafeClient {
  let c = clients.get(apiKey);
  if (!c) {
    c = new TypeSafeClient({ apiKey, defaultModel: process.env.TYPESAFE_MODEL || undefined, timeout: 20_000, retry: { maxRetries: 3 } });
    clients.set(apiKey, c);
  }
  return c;
}

/** The client for the key in scope. Throws NoKeyError outside a key context. */
export function jev(): TypeSafeClient {
  const key = keyStore.getStore();
  if (!key) throw new NoKeyError();
  return clientFor(key);
}

export type KeySource = "own" | "house";

/** Which key a user may use, if any: their own first, then the house key for the owner account. */
export async function resolveKey(userId: string): Promise<{ key: string; source: KeySource } | null> {
  const [u] = await db.select({ key: schema.users.typesafeKey, email: schema.users.email }).from(schema.users).where(eq(schema.users.id, userId)).limit(1);
  if (!u) return null;
  if (u.key) return { key: decryptSecret(u.key), source: "own" };
  const owner = process.env.OWNER_EMAIL?.trim().toLowerCase();
  if (owner && u.email?.toLowerCase() === owner && process.env.TYPESAFE_API_KEY) return { key: process.env.TYPESAFE_API_KEY, source: "house" };
  return null;
}

/** Run `fn` with a specific key in scope. */
export function withKey<T>(apiKey: string, fn: () => Promise<T>): Promise<T> {
  return keyStore.run(apiKey, fn);
}

/** Run `fn` with the user's key in scope, or throw NoKeyError before any Gmail work happens. */
export async function withUserKey<T>(userId: string, fn: () => Promise<T>): Promise<T> {
  const k = await resolveKey(userId);
  if (!k) throw new NoKeyError();
  return keyStore.run(k.key, fn);
}

/** Confirm a key works by listing the account's models. Returns the model names on success. */
export async function verifyKey(apiKey: string): Promise<string[]> {
  const cards = await new TypeSafeClient({ apiKey, timeout: 10_000, retry: { maxRetries: 1 } }).models.list();
  return cards.map((m) => m.name);
}
