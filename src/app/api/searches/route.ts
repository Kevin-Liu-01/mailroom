import { NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUserId } from "@/lib/session";

export async function GET() {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const rows = await db.select().from(schema.savedSearches).where(eq(schema.savedSearches.userId, userId)).orderBy(desc(schema.savedSearches.createdAt));
  return NextResponse.json({ searches: rows });
}

export async function POST(req: Request) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { name?: string; naturalQuery?: string; gmailQuery?: string };
  if (!body.name || !body.naturalQuery || !body.gmailQuery) return NextResponse.json({ error: "name, naturalQuery, gmailQuery required" }, { status: 400 });
  const [row] = await db.insert(schema.savedSearches).values({ userId, name: body.name.slice(0, 80), naturalQuery: body.naturalQuery.slice(0, 500), gmailQuery: body.gmailQuery.slice(0, 1000) }).returning();
  return NextResponse.json({ search: row });
}

export async function DELETE(req: Request) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = (await req.json().catch(() => ({}))) as { id?: string };
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  await db.delete(schema.savedSearches).where(and(eq(schema.savedSearches.userId, userId), eq(schema.savedSearches.id, id)));
  return NextResponse.json({ ok: true });
}
