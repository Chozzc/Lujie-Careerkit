import { NextResponse } from "next/server";
import { campusQuerySchema, queryCampus } from "@/lib/campus";
import { readCampusDataset } from "@/lib/campus-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const query = campusQuerySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!query.success) return NextResponse.json({ error: "INVALID_QUERY" }, { status: 400 });
  try {
    return NextResponse.json(queryCampus(await readCampusDataset(), query.data), { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "CAMPUS_DATA_UNAVAILABLE" }, { status: 503 });
  }
}
