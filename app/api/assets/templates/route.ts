import { NextResponse } from "next/server";
import { brandKits, cardTemplates } from "@/lib/studio-presets";

export async function GET() {
  return NextResponse.json({ success: true, data: { cardTemplates, brandKits } });
}
