/**
 * Minimal Gmail REST client over fetch. Only the handful of endpoints the engine needs,
 * with token refresh, 429/5xx backoff, and no message bodies ever requested.
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
  constructor(private accessToken: string) {}

  private async call<T>(path: string, init: RequestInit = {}, attempt = 0): Promise<T> {
    const res = await fetch(`${API}${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${this.accessToken}`, "Content-Type": "application/json", ...(init.headers ?? {}) },
    });
    if (res.status === 401) throw new GmailAuthError("Gmail rejected the access token");
    if ((res.status === 429 || res.status >= 500) && attempt < 5) {
      const retryAfter = Number(res.headers.get("retry-after")) || 0;
      await new Promise((r) => setTimeout(r, Math.max(retryAfter * 1000, 500 * 2 ** attempt)));
      return this.call<T>(path, init, attempt + 1);
    }
    if (res.status === 429) throw new GmailRateLimit("Gmail rate limit");
    if (!res.ok) throw new Error(`Gmail ${init.method ?? "GET"} ${path} failed: ${res.status} ${(await res.text()).slice(0, 300)}`);
    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  }

  async profile(): Promise<{ emailAddress: string; messagesTotal: number; threadsTotal: number }> {
    return this.call("/profile");
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

  async listFilters(): Promise<{ id: string; criteria: Record<string, string>; action: { addLabelIds?: string[]; removeLabelIds?: string[] } }[]> {
    const r = await this.call<{ filter?: { id: string; criteria: Record<string, string>; action: { addLabelIds?: string[]; removeLabelIds?: string[] } }[] }>("/settings/filters");
    return r.filter ?? [];
  }

  async createFilter(criteria: Record<string, string>, action: { addLabelIds?: string[]; removeLabelIds?: string[] }): Promise<void> {
    await this.call("/settings/filters", { method: "POST", body: JSON.stringify({ criteria, action }) });
  }

  async deleteFilter(id: string): Promise<void> {
    await this.call(`/settings/filters/${encodeURIComponent(id)}`, { method: "DELETE" });
  }
}

/** Run an async mapper with bounded concurrency, preserving order. */
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
