import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("password123", 12);

  const user = await prisma.user.upsert({
    where: { email: "demo@aics.local" },
    update: {},
    create: {
      email: "demo@aics.local",
      name: "Demo User",
      passwordHash,
      role: "ADMIN",
    },
  });

  const project = await prisma.project.upsert({
    where: { id: "demo-project" },
    update: {},
    create: {
      id: "demo-project",
      name: "Demo Content Pipeline",
      description: "News AI → Card News → Image Studio → Video Studio 데모 프로젝트",
      ownerId: user.id,
    },
  });

  await prisma.libraryItem.create({
    data: {
      title: "Welcome to AI Content Studio v0.9",
      type: "CARD_NEWS",
      status: "DRAFT",
      summary: "Prisma, Auth, Queue, Image Studio, Video Studio 통합 완료",
      projectId: project.id,
      ownerId: user.id,
      payload: {
        cards: ["뉴스 수집", "AI 생성", "카드뉴스", "이미지", "영상", "발행"],
      },
    },
  });
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
