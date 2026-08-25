import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const dailyProblemId = req.nextUrl.searchParams.get("dailyProblemId");
  if (!dailyProblemId) {
    return NextResponse.json({ error: "dailyProblemId required" }, { status: 400 });
  }

  const session = await getServerSession(authOptions);
  const userId = (session?.user as Record<string, string> | undefined)?.id;

  const comments = await prisma.comment.findMany({
    where: { dailyProblemId, parentId: null },
    orderBy: { upvotes: "desc" },
    include: {
      user: { select: { id: true, username: true, displayName: true, avatarUrl: true, discordAvatar: true } },
      replies: {
        orderBy: { createdAt: "asc" },
        include: {
          user: { select: { id: true, username: true, displayName: true, avatarUrl: true, discordAvatar: true } },
          votes: userId ? { where: { userId } } : false,
        },
      },
      votes: userId ? { where: { userId } } : false,
    },
  });

  return NextResponse.json({
    comments: comments.map((c) => ({
      ...c,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
      userVote: c.votes.length > 0,
      replies: c.replies.map((r) => ({
        ...r,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
        userVote: Array.isArray(r.votes) && r.votes.length > 0,
      })),
    })),
  });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as Record<string, string> | undefined)?.id;
  if (!userId) {
    return NextResponse.json({ error: "Sign in to comment" }, { status: 401 });
  }

  const { dailyProblemId, content, parentId } = await req.json();
  if (!dailyProblemId || !content?.trim()) {
    return NextResponse.json({ error: "dailyProblemId and content required" }, { status: 400 });
  }

  if (parentId) {
    const parent = await prisma.comment.findUnique({ where: { id: parentId } });
    if (!parent || parent.parentId !== null) {
      return NextResponse.json({ error: "Invalid parent comment" }, { status: 400 });
    }
  }

  const comment = await prisma.comment.create({
    data: {
      dailyProblemId,
      userId,
      parentId: parentId || null,
      content: content.trim(),
    },
    include: {
      user: { select: { id: true, username: true, displayName: true, avatarUrl: true, discordAvatar: true } },
    },
  });

  return NextResponse.json({
    ...comment,
    createdAt: comment.createdAt.toISOString(),
    updatedAt: comment.updatedAt.toISOString(),
    upvotes: 0,
    userVote: false,
    replies: [],
  });
}
