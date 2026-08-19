import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

async function getLeaderboard() {
  const progress = await prisma.userProgress.groupBy({
    by: ["userId"],
    _count: { id: true },
    orderBy: { _count: { id: "desc" } },
    take: 50,
  });

  const userIds = progress.map((p) => p.userId);
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
  });

  return progress.map((p, i) => ({
    rank: i + 1,
    user: users.find((u) => u.id === p.userId),
    solved: p._count.id,
  }));
}

export default async function LeaderboardPage() {
  const leaderboard = await getLeaderboard();

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <Link
        href="/"
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-300 mb-8 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to today
      </Link>

      <h1 className="text-3xl font-bold mb-8">
        <span className="text-cyan-400">Leaderboard</span>
      </h1>

      {leaderboard.length === 0 ? (
        <div className="text-center py-20 text-gray-500">
          <p className="text-lg mb-2">No progress yet</p>
          <p className="text-sm">
            Solve problems to appear on the leaderboard!
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-gray-800 bg-gray-900/50 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-800 text-sm text-gray-500">
                <th className="text-left px-6 py-3 font-medium">Rank</th>
                <th className="text-left px-6 py-3 font-medium">User</th>
                <th className="text-right px-6 py-3 font-medium">Solved</th>
              </tr>
            </thead>
            <tbody>
              {leaderboard.map(({ rank, user, solved }) => (
                <tr
                  key={user?.id}
                  className="border-b border-gray-800/50 last:border-0 hover:bg-gray-800/30 transition-colors"
                >
                  <td className="px-6 py-4 font-mono text-sm">
                    {rank <= 3 ? (
                      <span className="text-yellow-400">
                        {rank === 1 ? "1st" : rank === 2 ? "2nd" : "3rd"}
                      </span>
                    ) : (
                      <span className="text-gray-500">{rank}th</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      {user?.avatarUrl && (
                        <img
                          src={user.avatarUrl}
                          alt=""
                          className="w-8 h-8 rounded-full"
                        />
                      )}
                      <span className="font-medium">{user?.username}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className="font-mono text-cyan-400 font-bold">
                      {solved}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
