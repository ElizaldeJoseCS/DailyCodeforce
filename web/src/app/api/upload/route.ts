import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import sharp from "sharp";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";

const UPLOAD_DIR = join(process.cwd(), "public", "uploads");

const LIMITS: Record<string, { width: number; height: number; maxBytes: number }> = {
  avatar: { width: 256, height: 256, maxBytes: 2 * 1024 * 1024 },
  banner: { width: 1200, height: 400, maxBytes: 5 * 1024 * 1024 },
};

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as Record<string, string> | undefined)?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const type = formData.get("type") as string | null;

  if (!file || !type) {
    return NextResponse.json({ error: "file and type required" }, { status: 400 });
  }

  if (!LIMITS[type]) {
    return NextResponse.json({ error: "Invalid upload type. Use 'avatar' or 'banner'." }, { status: 400 });
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: "Invalid file type. Use JPEG, PNG, WebP, or GIF." }, { status: 400 });
  }

  const limit = LIMITS[type];
  if (file.size > limit.maxBytes) {
    const maxMB = Math.round(limit.maxBytes / (1024 * 1024));
    return NextResponse.json({ error: `File too large. Max ${maxMB}MB.` }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  let processed: Buffer;
  try {
    if (type === "avatar") {
      processed = await sharp(buffer)
        .resize(limit.width, limit.height, { fit: "cover", position: "centre" })
        .png({ quality: 90 })
        .toBuffer();
    } else {
      processed = await sharp(buffer)
        .resize(limit.width, limit.height, { fit: "cover", position: "centre" })
        .jpeg({ quality: 85 })
        .toBuffer();
    }
  } catch {
    return NextResponse.json({ error: "Failed to process image" }, { status: 400 });
  }

  const userDir = join(UPLOAD_DIR, userId);
  await mkdir(userDir, { recursive: true });

  const ext = type === "avatar" ? "png" : "jpg";
  const filePath = join(userDir, `${type}.${ext}`);
  await writeFile(filePath, processed);

  const url = `/uploads/${userId}/${type}.${ext}`;

  const updateData: Record<string, string> = {};
  if (type === "avatar") {
    updateData.avatarUrl = url;
  } else {
    updateData.bannerUrl = url;
  }

  await prisma.user.update({
    where: { id: userId },
    data: updateData,
  });

  return NextResponse.json({ url });
}
