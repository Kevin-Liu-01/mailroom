import { TypeSafeClient } from "@typesafe-ai/sdk";

/**
 * One TypeSafe client for the whole app. Model, timeout, and retries live here so every judgment
 * (search compile, rerank, triage, sender scan) behaves the same and can be tuned from the environment.
 */
let client: TypeSafeClient | null = null;
export function jev(): TypeSafeClient {
  if (!process.env.TYPESAFE_API_KEY) throw new Error("TYPESAFE_API_KEY is not set");
  return (client ??= new TypeSafeClient({
    apiKey: process.env.TYPESAFE_API_KEY,
    defaultModel: process.env.TYPESAFE_MODEL || undefined,
    timeout: 20_000,
    retry: { maxRetries: 3 },
  }));
}
