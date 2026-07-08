import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type") || undefined;
    const session = await auth();

    const items = await prisma.libraryItem.findMany({
      where: {
        ...(type ? { type: type as never } : {}),
        ...(session?.user?.id ? { ownerId: session.user.id } : {}),
      },
      orderBy: { updatedAt: "desc" },
      take: 100,
    });

    return NextResponse.json({ success: true, data: items });
  } catch (error) {
    console.warn("DB_OFFLINE_LIBRARY_LIST", error);
    return NextResponse.json({ success: true, data: [], dbOffline: true, message: "DB 연결이 없어 임시 빈 목록을 표시합니다." });
  }
}

export async function POST(req: Request) {
  try {
    const session = await auth();
    const body = await req.json();

    const item = await prisma.libraryItem.create({
      data: {
        title: body.title || "Untitled Content",
        type: body.type || "CARD_NEWS",
        status: body.status || "DRAFT",
        summary: body.summary || null,
        sourceUrl: body.sourceUrl || null,
        thumbnail: body.thumbnail || null,
        payload: body.payload || {},
        projectId: body.projectId || null,
        ownerId: session?.user?.id || null,
      },
    });

    return NextResponse.json({ success: true, data: item });
  } catch (error) {
    console.warn("DB_OFFLINE_LIBRARY_SAVE", error);
    const body = await req.json().catch(() => ({}));
    return NextResponse.json({
      success: true,
      dbOffline: true,
      data: { id: `offline-${Date.now()}`, ...body },
      message: "DB 연결이 없어 이번 저장은 임시 처리되었습니다. PostgreSQL/Docker를 켜면 영구 저장됩니다.",
    });
  }
}
