/**
 * Minimal Gmail REST client over fetch. Only the handful of endpoints the engine needs, with token refresh, pacing
 * under the per-user quota, 429/5xx backoff, and no message bodies ever requested.
 */
export type GmailLabel = { id: string; name: string; type: "system" | "user"; threadsTotal?: number; threadsUnread?: number; messagesTotal?: number; messagesUnread?: number };
export type GmailMessageMeta = {
  id: string;
  threadId: string;
  labelIds: string[];
  snippet: string;
  internalDate: string;
  headers: Record<string, string>;
};

export type GmailThreadMessage = { id: string; from: string; to: string; date: string; internalDate: string; labelIds: string[] };
export type GmailThreadMeta = { id: string; messages: GmailThreadMessage[] };

export class GmailAuthError extends Error {}
export class GmailRateLimit extends Error {}

export type GmailFilterCriteria = { from?: string; to?: string; subject?: string; query?: string; negatedQuery?: string; hasAttachment?: boolean; size?: number; sizeComparison?: string; excludeChats?: boolean };
export type GmailFilterAction = { addLabelIds?: string[]; removeLabelIds?: string[]; forward?: string };
export type GmailFilter = { id: string; criteria: GmailFilterCriteria; action: GmailFilterAction };

/**
 * Gmail meters each user per minute: 15,000 quota units, and a separate "Total Query Cost" of 6,000. Reading is what
 * the second one prices: measured on a real mailbox, about 320 metadata reads fit in a fresh minute, while 1,800
 * searches in 75 seconds drew no refusal. Sustained work past the budget earns 403s whose retries back off for seconds
 * at a time, so the client paces itself instead: 100 units a second (the 6,000 a minute), halved whenever Gmail pushes
 * back and eased back up as calls succeed. The burst covers one interactive request (a search reads ~60 messages and
 * ~30 threads) without waiting.
 */
const UNITS_PER_SECOND = 100;
const MIN_UNITS_PER_SECOND = 10;
const BURST_UNITS = 2000;
/** What a call costs against the tighter budget: reads as measured, everything else at Google's published rate. */
export function quotaCost(path: string, method = "GET"): number {
  if (path.startsWith("/messages/batchModify")) return 50;
  if (/^\/(messages|threads)\/[^/?]+/.test(path)) return 20; // one message or thread read
  if (path.startsWith("/messages")) return 5; // a search page
  if (path.startsWith("/settings/filters") || path.startsWith("/labels")) return method === "GET" ? 1 : 5;
  if (path.startsWith("/history")) return 2;
  return 1;
}

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const API = "https://gmail.googleapis.com/gmail/v1/users/me";

export async function refreshAccessToken(refreshToken: string): Promise<{ accessToken: string; expiresAt: number }> {
  const body = new URLSearchParams({
    client_id: process.env.AUTH_GOOGLE_ID ?? "",
    client_secret: process.env.AUTH_GOOGLE_SECRET ?? "",
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });
  const res = await fetch(TOKEN_URL, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body });
  const json = (await res.json()) as { access_token?: string; expires_in?: number; error?: string; error_description?: string };
  if (!res.ok || !json.access_token) {
    // invalid_grant means the user revoked access or the token expired: the mailbox needs a fresh consent.
    throw new GmailAuthError(json.error_description ?? json.error ?? `token refresh failed (${res.status})`);
  }
  return { accessToken: json.access_token, expiresAt: Math.floor(Date.now() / 1000) + (json.expires_in ?? 3600) - 60 };
}

export async function revokeToken(token: string): Promise<void> {
  await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token)}`, { method: "POST" }).catch(() => undefined);
}

export class GmailClient {
  private tokens = BURST_UNITS;
  private refilled = Date.now();
  private rate = UNITS_PER_SECOND;
  private cutAt = 0;
  private turn: Promise<void> = Promise.resolve();

  /** `refresh` mints a new access token; long runs outlive the hour a token lasts, so a 401 refreshes once and retries. */
  constructor(private accessToken: string, private refresh?: () => Promise<string>) {}

  /** Wait until `units` of quota are free. Concurrent callers take turns, so mapLimit workers share one budget. */
  private pace(units: number): Promise<void> {
    const mine = this.turn.then(async () => {
      const refill = () => {
        const now = Date.now();
        this.tokens = Math.min(BURST_UNITS, this.tokens + ((now - this.refilled) * this.rate) / 1000);
        this.refilled = now;
      };
      refill();
      if (this.tokens < units) {
        await new Promise((r) => setTimeout(r, ((units - this.tokens) * 1000) / this.rate));
        refill();
      }
      this.tokens -= units;
    });
    this.turn = mine.catch(() => undefined);
    return mine;
  }

  private async call<T>(path: string, init: RequestInit = {}, attempt = 0, refreshed = false): Promise<T> {
    await this.pace(quotaCost(path, init.method));
    const res = await fetch(`${API}${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${this.accessToken}`, "Content-Type": "application/json", ...(init.headers ?? {}) },
    });
    if (res.status === 401 && this.refresh && !refreshed) {
      this.accessToken = await this.refresh();
      return this.call<T>(path, init, attempt, true);
    }
    if (res.status === 401) throw new GmailAuthError("Gmail rejected the access token");
    // Gmail signals per-user quota as 403 rateLimitExceeded / userRateLimitExceeded, not only as 429.
    const body = res.status === 403 ? await res.text() : "";
    const rateLimited = res.status === 429 || (res.status === 403 && /rateLimitExceeded|userRateLimitExceeded|Quota exceeded/i.test(body));
    if (rateLimited) {
      // Back off for everyone sharing this client, not just this call: halve the pace (once for a wave of concurrent
      // refusals, not once per refusal) and spend what is banked.
      if (Date.now() - this.cutAt > 2000) { this.rate = Math.max(MIN_UNITS_PER_SECOND, this.rate / 2); this.cutAt = Date.now(); }
      this.tokens = Math.min(this.tokens, 0);
    } else if (res.ok && this.rate < UNITS_PER_SECOND) {
      this.rate = Math.min(UNITS_PER_SECOND, this.rate + 1);
    }
    if ((rateLimited || res.status >= 500) && attempt < 6) {
      const retryAfter = Number(res.headers.get("retry-after")) || 0;
      await new Promise((r) => setTimeout(r, Math.max(retryAfter * 1000, 700 * 2 ** attempt + Math.random() * 300)));
      return this.call<T>(path, init, attempt + 1, refreshed);
    }
    if (rateLimited) throw new GmailRateLimit("Gmail rate limit: try again in a minute");
    if (!res.ok) throw new Error(`Gmail ${init.method ?? "GET"} ${path} failed: ${res.status} ${(body || (await res.text())).slice(0, 300)}`);
    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  }

  async profile(): Promise<{ emailAddress: string; messagesTotal: number; threadsTotal: number; historyId: string }> {
    return this.call("/profile");
  }

  /**
   * What people took back since `startHistoryId`: messages restored from Trash and messages moved back into the inbox.
   * Mailroom itself only does either when someone clicks Undo or restore, so every such change is a person's (or their
   * agent's) decision. Returns null when Gmail no longer keeps history that far back.
   */
  async takenBack(startHistoryId: string): Promise<{ restored: string[]; inboxed: string[] } | null> {
    const records: HistoryRecord[] = [];
    let pageToken: string | undefined;
    try {
      do {
        const params = new URLSearchParams({ startHistoryId, maxResults: "500" });
        params.append("historyTypes", "labelRemoved");
        params.append("historyTypes", "labelAdded");
        if (pageToken) params.set("pageToken", pageToken);
        const page = await this.call<{ history?: HistoryRecord[]; nextPageToken?: string }>(`/history?${params}`);
        records.push(...(page.history ?? []));
        pageToken = page.nextPageToken;
      } while (pageToken);
    } catch (err) {
      if (err instanceof Error && / 404 /.test(err.message)) return null;
      throw err;
    }
    return takenBackFrom(records);
  }

  async listLabels(): Promise<GmailLabel[]> {
    const r = await this.call<{ labels: GmailLabel[] }>("/labels");
    return r.labels ?? [];
  }

  async getLabel(id: string): Promise<GmailLabel> {
    return this.call(`/labels/${id}`);
  }

  async createLabel(name: string): Promise<GmailLabel> {
    return this.call("/labels", {
      method: "POST",
      body: JSON.stringify({ name, labelListVisibility: "labelShow", messageListVisibility: "show" }),
    });
  }

  /** Ensure every label name exists (nested names like "Receipts/Uber" need their parent first). Returns name -> id. */
  async ensureLabels(names: string[]): Promise<Record<string, string>> {
    const existing = await this.listLabels();
    const map: Record<string, string> = {};
    for (const l of existing) map[l.name] = l.id;
    const wanted = new Set<string>();
    for (const n of names) {
      const parts = n.split("/");
      for (let i = 1; i <= parts.length; i++) wanted.add(parts.slice(0, i).join("/"));
    }
    for (const n of [...wanted].sort((a, b) => a.split("/").length - b.split("/").length)) {
      if (!map[n]) {
        const created = await this.createLabel(n);
        map[n] = created.id;
      }
    }
    return map;
  }

  /** All message ids matching a query, up to maxIds (500 per page). */
  async listMessageIds(q: string, maxIds = 30000): Promise<string[]> {
    const ids: string[] = [];
    let pageToken: string | undefined;
    do {
      const params = new URLSearchParams({ q, maxResults: "500" });
      if (pageToken) params.set("pageToken", pageToken);
      const page = await this.call<{ messages?: { id: string }[]; nextPageToken?: string }>(`/messages?${params}`);
      for (const m of page.messages ?? []) ids.push(m.id);
      pageToken = page.nextPageToken;
    } while (pageToken && ids.length < maxIds);
    return ids.slice(0, maxIds);
  }

  /** Who said what when in a thread: headers only, oldest first. Used to tell who spoke last. */
  async getThreadMeta(threadId: string): Promise<GmailThreadMeta> {
    const params = new URLSearchParams({ format: "metadata" });
    for (const h of ["From", "To", "Date"]) params.append("metadataHeaders", h);
    const t = await this.call<{ id: string; messages?: { id: string; internalDate: string; labelIds?: string[]; payload?: { headers?: { name: string; value: string }[] } }[] }>(`/threads/${threadId}?${params}`);
    const messages = (t.messages ?? []).map((m) => {
      const hs: Record<string, string> = {};
      for (const h of m.payload?.headers ?? []) hs[h.name.toLowerCase()] = h.value;
      return { id: m.id, from: hs["from"] ?? "", to: hs["to"] ?? "", date: hs["date"] ?? "", internalDate: m.internalDate, labelIds: m.labelIds ?? [] };
    });
    messages.sort((a, b) => Number(a.internalDate) - Number(b.internalDate));
    return { id: t.id, messages };
  }

  async getMessageMeta(id: string, headers = ["From", "To", "Cc", "Subject", "Date", "In-Reply-To", "List-Unsubscribe", "Precedence", "Auto-Submitted"]): Promise<GmailMessageMeta> {
    const params = new URLSearchParams({ format: "metadata" });
    for (const h of headers) params.append("metadataHeaders", h);
    const m = await this.call<{ id: string; threadId: string; labelIds?: string[]; snippet?: string; internalDate: string; payload?: { headers?: { name: string; value: string }[] } }>(`/messages/${id}?${params}`);
    const hs: Record<string, string> = {};
    for (const h of m.payload?.headers ?? []) hs[h.name.toLowerCase()] = h.value;
    return { id: m.id, threadId: m.threadId, labelIds: m.labelIds ?? [], snippet: m.snippet ?? "", internalDate: m.internalDate, headers: hs };
  }

  /** Gmail caps batchModify at 1000 ids per call. */
  async batchModify(ids: string[], addLabelIds: string[], removeLabelIds: string[]): Promise<void> {
    for (let i = 0; i < ids.length; i += 1000) {
      await this.call("/messages/batchModify", {
        method: "POST",
        body: JSON.stringify({ ids: ids.slice(i, i + 1000), addLabelIds, removeLabelIds }),
      });
    }
  }

  async listFilters(): Promise<GmailFilter[]> {
    const r = await this.call<{ filter?: GmailFilter[] }>("/settings/filters");
    return r.filter ?? [];
  }

  /** Create a filter and return it with its id. */
  async createFilter(criteria: GmailFilterCriteria, action: GmailFilterAction): Promise<GmailFilter> {
    return this.call<GmailFilter>("/settings/filters", { method: "POST", body: JSON.stringify({ criteria, action }) });
  }

  /** Delete a filter. A filter that is already gone counts as deleted. */
  async deleteFilter(id: string): Promise<void> {
    try {
      await this.call(`/settings/filters/${encodeURIComponent(id)}`, { method: "DELETE" });
    } catch (err) {
      if (!(err instanceof Error && /\b404\b/.test(err.message))) throw err;
    }
  }
}

/** Run an async mapper with bounded concurrency, preserving order. */
export type HistoryRecord = {
  labelsAdded?: { message: { id: string }; labelIds: string[] }[];
  labelsRemoved?: { message: { id: string }; labelIds: string[] }[];
};

/** Messages restored from Trash, and messages moved back into the inbox, in a run of Gmail history records. */
export function takenBackFrom(records: HistoryRecord[]): { restored: string[]; inboxed: string[] } {
  const restored = new Set<string>();
  const inboxed = new Set<string>();
  for (const r of records) {
    for (const x of r.labelsRemoved ?? []) if (x.labelIds.includes("TRASH")) restored.add(x.message.id);
    for (const x of r.labelsAdded ?? []) if (x.labelIds.includes("INBOX")) inboxed.add(x.message.id);
  }
  return { restored: [...restored], inboxed: [...inboxed].filter((id) => !restored.has(id)) };
}

export async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return out;
}
