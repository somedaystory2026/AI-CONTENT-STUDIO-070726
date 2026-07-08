import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET() {
  try {
    const jobs = await prisma.queueJob.findMany({
      where: { type: "RSS_COLLECT" },
      orderBy: { updatedAt: "desc" },
      take: 20,
    });
    return NextResponse.json({ success: true, data: jobs });
  } catch (error) {
    console.warn("DB_OFFLINE_AUTOMATION_JOBS", error);
    return NextResponse.json({ success: true, data: [], dbOffline: true });
  }
}
