import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getTLE } from "@/lib/n2yo";

// Looks up a satellite's name (and confirms it exists) from its NORAD ID via
// N2YO, so the user only has to enter the ID when adding a satellite.
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const raw = request.nextUrl.searchParams.get("norad_id");
  const noradId = raw && /^\d+$/.test(raw) ? Number(raw) : null;
  if (noradId == null) {
    return NextResponse.json({ error: "A valid NORAD ID is required" }, { status: 400 });
  }

  try {
    const data = await getTLE(noradId);
    const name = data.info?.satname?.trim();
    if (!name) {
      return NextResponse.json(
        { error: `No satellite found for NORAD ID ${noradId}` },
        { status: 404 }
      );
    }
    return NextResponse.json({ norad_id: noradId, name });
  } catch {
    return NextResponse.json(
      { error: "Could not look up that NORAD ID. Check the ID and try again." },
      { status: 502 }
    );
  }
}
