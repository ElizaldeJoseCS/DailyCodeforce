import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/db";
import { authOptions } from "@/lib/auth";
import ProblemPageClient from "@/components/ProblemPageClient";

export const dynamic = "force-dynamic";

export default async function ProblemPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const daily = await prisma.dailyProblem.findUnique({
    where: { id },
    include: { problem: true },
  });

  if (!daily) notFound();

  let isSolved = false;
  const session = await getServerSession(authOptions);
  const userId = (session?.user as Record<string, string> | undefined)?.id;
  if (userId) {
    const progress = await prisma.userProgress.findUnique({
      where: {
        userId_dailyProblemId: {
          userId,
          dailyProblemId: daily.id,
        },
      },
    });
    isSolved = !!progress;
  }

  return (
    <ProblemPageClient
      daily={JSON.parse(JSON.stringify(daily))}
      isSolved={isSolved}
    />
  );
}
