import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(req: NextRequest) {
  const { email, code } = await req.json();

  if (!email || !code) {
    return NextResponse.json({ error: "Email and code are required" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return NextResponse.json({ error: "No account found with this email" }, { status: 400 });
  }

  if (user.emailVerified) {
    return NextResponse.json({ message: "Email already verified" });
  }

  if (!user.verificationCode || !user.verificationCodeExpires) {
    return NextResponse.json({ error: "No verification code found. Please sign up again." }, { status: 400 });
  }

  if (new Date(user.verificationCodeExpires) < new Date()) {
    return NextResponse.json({ error: "Code has expired. Please sign up again." }, { status: 400 });
  }

  if (user.verificationCode !== code.trim()) {
    return NextResponse.json({ error: "Invalid code" }, { status: 400 });
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      emailVerified: true,
      verificationCode: null,
      verificationCodeExpires: null,
    },
  });

  return NextResponse.json({ message: "Email verified successfully" });
}
