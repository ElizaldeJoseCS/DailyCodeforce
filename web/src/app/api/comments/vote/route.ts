import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as Record<string, string> | undefined)?.id;
  if (!userId) {
    return NextResponse.json({ error: "Sign in to vote" }, { status: 401 });
  }

  const { commentId } = await req.json();
  if (!commentId) {
    return NextResponse.json({ error: "commentId required" }, { status: 400 });
  }

  const existing = await prisma.commentVote.findUnique({
    where: { userId_commentId: { userId, commentId } },
  });

  if (existing) {
    await prisma.commentVote.delete({ where: { id: existing.id } });
    await prisma.comment.update({ where: { id: commentId }, data: { upvotes: { decrement: 1 } } });
    return NextResponse.json({ voted: false });
  } else {
    await prisma.commentVote.create({ data: { userId, commentId } });
    await prisma.comment.update({ where: { id: commentId }, data: { upvotes: { increment: 1 } } });
    return NextResponse.json({ voted: true });
  }
}
