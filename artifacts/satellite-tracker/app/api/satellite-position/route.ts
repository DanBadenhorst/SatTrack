import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSatellitePositions } from "@/lib/n2yo";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sp = request.nextUrl.searchParams;
  const norad = parseInt(sp.get("norad") ?? "0");
  const lat = parseFloat(sp.get("lat") ?? "0");
  const lng = parseFloat(sp.get("lng") ?? "0");
  const alt = parseFloat(sp.get("alt") ?? "0");

  if (!norad) return NextResponse.json({ error: "norad required" }, { status: 400 });

  try {
    const data = await getSatellitePositions(norad, lat, lng, alt, 1);
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: "Failed to fetch position" }, { status: 500 });
  }
}
