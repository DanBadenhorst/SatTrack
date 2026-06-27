import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getPasses, getRadioPasses } from "@/lib/n2yo";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { lat, lng, alt, days, minElevation, satellites, mode } = body;

  if (lat == null || lng == null || !satellites?.length) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const fetchPasses = mode === "all" ? getRadioPasses : getPasses;

  const results = await Promise.allSettled(
    satellites.map(async (sat: { norad_id: number; name: string }) => {
      try {
        const data = await fetchPasses(sat.norad_id, lat, lng, alt ?? 0, days ?? 3, minElevation ?? 10);
        return {
          satellite: sat,
          passes: data.passes ?? [],
        };
      } catch (err) {
        return {
          satellite: sat,
          passes: [],
          error: err instanceof Error ? err.message : "Failed to fetch passes",
        };
      }
    })
  );

  const output = results.map((r) =>
    r.status === "fulfilled" ? r.value : { satellite: { name: "Unknown" }, passes: [], error: "Failed" }
  );

  return NextResponse.json({ results: output });
}
