import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
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

  return (
    <ProblemPageClient
      daily={JSON.parse(JSON.stringify(daily))}
    />
  );
}
