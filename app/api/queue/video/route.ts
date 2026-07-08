import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { enqueueStudioJob } from "@/lib/queue";

export async function POST(req: Request) {
  try {
    const session = await auth();
    const input = await req.json();
    const queueResult = await enqueueStudioJob("video", "video-storyboard", input);

    let job: unknown = { id: `offline-${Date.now()}`, type: "VIDEO_STORYBOARD", status: queueResult.queued ? "WAITING" : "COMPLETED", progress: queueResult.queued ? 0 : 100, input };
    try {
      job = await prisma.queueJob.create({
        data: {
          externalId: String(queueResult.id),
          type: "VIDEO_STORYBOARD",
          status: queueResult.queued ? "WAITING" : "COMPLETED",
          progress: queueResult.queued ? 0 : 100,
          input,
          output: queueResult.queued ? undefined : { mode: "local", message: queueResult.message },
          ownerId: session?.user?.id,
        },
      });
    } catch (dbError) {
      console.warn("DB_OFFLINE_QUEUE_SAVE_SKIPPED", dbError);
    }

    return NextResponse.json({ success: true, data: { job, queue: queueResult } });
  } catch (error) {
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "비디오 작업 등록 실패" }, { status: 500 });
  }
}
