import { NextResponse } from "next/server";
import { promptPresets } from "@/lib/studio-presets";

export async function GET() {
  return NextResponse.json({ success: true, data: promptPresets });
}
