import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const registerSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  email: z.string().email(),
  password: z.string().min(8),
});

export async function POST(req: Request) {
  try {
    const body = registerSchema.parse(await req.json());
    const email = body.email.toLowerCase().trim();

    const exists = await prisma.user.findUnique({ where: { email } });
    if (exists) {
      return NextResponse.json({ success: false, message: "이미 가입된 이메일입니다." }, { status: 409 });
    }

    const passwordHash = await bcrypt.hash(body.password, 12);
    const user = await prisma.user.create({
      data: { email, name: body.name, passwordHash },
      select: { id: true, email: true, name: true, createdAt: true },
    });

    return NextResponse.json({ success: true, data: user });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "회원가입 실패" },
      { status: 400 }
    );
  }
}
