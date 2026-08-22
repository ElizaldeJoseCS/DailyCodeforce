import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { verifyCFHandle } from "@/lib/codeforces";

export async function POST(req: NextRequest) {
  const { email, password, username, cfHandle } = await req.json();

  if (!email || !password || !username || !cfHandle) {
    return NextResponse.json({ error: "All fields are required" }, { status: 400 });
  }

  if (username.length < 3 || username.length > 20) {
    return NextResponse.json({ error: "Username must be 3-20 characters" }, { status: 400 });
  }

  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    return NextResponse.json({ error: "Username can only contain letters, numbers, and underscores" }, { status: 400 });
  }

  if (password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
  }

  const cfCheck = await verifyCFHandle(cfHandle);
  if (!cfCheck.valid) {
    return NextResponse.json({ error: "Invalid Codeforces handle. Please check your handle and try again." }, { status: 400 });
  }

  const existing = await prisma.user.findFirst({
    where: { OR: [{ email }, { username }, { cfHandle }] },
  });

  if (existing) {
    const field = existing.email === email ? "Email" : existing.username === username ? "Username" : "Codeforces handle";
    return NextResponse.json({ error: `${field} already taken` }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const user = await prisma.user.create({
    data: {
      email,
      username,
      passwordHash,
      cfHandle,
      avatarUrl: cfCheck.avatar,
    },
  });

  return NextResponse.json({ message: "Account created", userId: user.id });
}
