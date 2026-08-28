import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isBadgeEarned, getFrameForBadgeId, getTitleForBadgeId } from "@/lib/badges";

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as Record<string, string> | undefined)?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();

  const data: Record<string, unknown> = {};

  // avatarUrl/bannerUrl must be exactly what POST /api/upload just produced for
  // this user — otherwise a client could hotlink/set an arbitrary URL and skip
  // the upload endpoint's type/size validation and image processing entirely.
  const isOwnUpload = (url: string, kind: "avatar" | "banner") =>
    /^\/uploads\/[^/]+\/(avatar|banner)\.(png|jpg|jpeg|webp|gif)$/.test(url) &&
    url.startsWith(`/uploads/${userId}/${kind}.`);

  if ("displayName" in body) data.displayName = body.displayName || null;
  if ("bio" in body) data.bio = body.bio || null;
  if ("avatarUrl" in body) {
    if (body.avatarUrl && !isOwnUpload(body.avatarUrl, "avatar")) {
      return NextResponse.json({ error: "Invalid avatarUrl" }, { status: 400 });
    }
    data.avatarUrl = body.avatarUrl || null;
  }
  if ("bannerUrl" in body) {
    if (body.bannerUrl && !isOwnUpload(body.bannerUrl, "banner")) {
      return NextResponse.json({ error: "Invalid bannerUrl" }, { status: 400 });
    }
    data.bannerUrl = body.bannerUrl || null;
  }
  if ("backgroundColor" in body) data.backgroundColor = body.backgroundColor || null;
  if ("accentColor" in body) data.accentColor = body.accentColor || null;
  if ("socialLinks" in body) data.socialLinks = body.socialLinks || {};
  if ("profileLayout" in body) data.profileLayout = body.profileLayout || {};

  // Avatar frames and name colors are free for everyone to pick — only still
  // restricted to real catalog entries, not to ones actually earned. The
  // profile title is the one cosmetic that stays gated by earned badges,
  // re-checked here since a client could otherwise request any title.
  if ("avatarFrame" in body) {
    const requestedFrame: string = body.avatarFrame || "none";
    if (requestedFrame !== "none" && !getFrameForBadgeId(requestedFrame)) {
      return NextResponse.json({ error: "Invalid avatarFrame" }, { status: 400 });
    }
    data.avatarFrame = requestedFrame;
  }

  if ("titleBadge" in body) {
    const requestedTitle: string | null = body.titleBadge || null;
    if (requestedTitle) {
      if (!getTitleForBadgeId(requestedTitle)) {
        return NextResponse.json({ error: "Invalid titleBadge" }, { status: 400 });
      }
      const stats = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          role: true,
          totalSolved: true,
          currentStreak: true,
          longestStreak: true,
          progress: { select: { verified: true, dailyProblem: { select: { tier: true } } } },
        },
      });
      if (!stats) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }
      // Admins can equip any title without having earned the underlying badge.
      if (stats.role !== "admin" && !isBadgeEarned(requestedTitle, stats)) {
        return NextResponse.json({ error: "Title not unlocked" }, { status: 400 });
      }
    }
    data.titleBadge = requestedTitle;
  }

  try {
    const user = await prisma.user.update({
      where: { id: userId },
      data,
      select: {
        id: true,
        username: true,
        displayName: true,
        bio: true,
        avatarUrl: true,
        bannerUrl: true,
        backgroundColor: true,
        accentColor: true,
        socialLinks: true,
        profileLayout: true,
        avatarFrame: true,
        titleBadge: true,
      },
    });

    return NextResponse.json(user);
  } catch (err) {
    console.error("Profile update error:", err);
    return NextResponse.json({ error: "Failed to update profile" }, { status: 500 });
  }
}
