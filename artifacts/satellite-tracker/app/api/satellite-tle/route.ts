import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getTLE } from "@/lib/n2yo";

// Returns the TLE orbital data for every satellite tracked by the given group.
// TLEs are fetched via the hourly-cached getTLE helper so the client can
// propagate satellite positions locally without ever hitting the rate-limited
// live-position endpoint.
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const groupId = request.nextUrl.searchParams.get("group_id");
  if (!groupId) {
    return NextResponse.json({ error: "group_id required" }, { status: 400 });
  }

  const { data: sats, error } = await supabase
    .from("tracked_satellites")
    .select("norad_id, name")
    .eq("group_id", groupId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const tracked = (sats ?? []) as { norad_id: number; name: string }[];

  const results = await Promise.allSettled(
    tracked.map(async (s) => {
      const data = await getTLE(s.norad_id);
      const lines = (data.tle ?? "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
      if (lines.length < 2) throw new Error("Incomplete TLE");
      return {
        norad_id: s.norad_id,
        name: s.name,
        line1: lines[0],
        line2: lines[1],
      };
    })
  );

  const satellites = results
    .filter((r): r is PromiseFulfilledResult<{ norad_id: number; name: string; line1: string; line2: string }> => r.status === "fulfilled")
    .map((r) => r.value);

  return NextResponse.json({ satellites });
}
