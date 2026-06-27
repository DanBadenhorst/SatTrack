import { NextRequest, NextResponse } from "next/server";
import { geocodeLocation } from "@/lib/geocoding";

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q");
  if (!q) return NextResponse.json({ results: [] });

  try {
    const results = await geocodeLocation(q);
    return NextResponse.json({ results });
  } catch {
    return NextResponse.json({ results: [] }, { status: 500 });
  }
}
