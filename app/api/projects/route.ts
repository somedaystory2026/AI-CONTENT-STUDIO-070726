import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const projects = await prisma.project.findMany({ orderBy: { updatedAt: "desc" }, take: 50 });
    return NextResponse.json({ success: true, data: projects });
  } catch (error) {
    console.warn("DB_OFFLINE_PROJECT_LIST", error);
    return NextResponse.json({ success: true, data: [], dbOffline: true });
  }
}

export async function POST(req: Request) {
  const body = await req.json();
  try {
    const project = await prisma.project.create({
      data: {
        title: body.title || "새 프로젝트",
        type: body.type || "GENERAL",
        status: body.status || "DRAFT",
        description: body.description || null,
        payload: body.payload || {},
      },
    });
    return NextResponse.json({ success: true, data: project });
  } catch (error) {
    console.warn("DB_OFFLINE_PROJECT_SAVE", error);
    return NextResponse.json({ success: true, dbOffline: true, data: { id: `offline-${Date.now()}`, ...body } });
  }
}
