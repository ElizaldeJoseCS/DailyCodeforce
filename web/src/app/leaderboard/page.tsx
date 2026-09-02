import { ArrowLeft, Flame } from "lucide-react";
import Link from "next/link";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

async function getLeaderboard() {
  const users = await prisma.user.findMany({
    where: { totalSolved: { gt: 0 } },
    orderBy: { totalSolved: "desc" },
    take: 50,
    select: {
      id: true,
      username: true,
      displayName: true,
      avatarUrl: true,
      discordAvatar: true,
      totalSolved: true,
      currentStreak: true,
      longestStreak: true,
    },
  });

  return users.map((u, i) => ({ rank: i + 1, ...u }));
}

export default async function LeaderboardPage() {
  const leaderboard = await getLeaderboard();

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <Link
        href="/"
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 mb-8 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to today
      </Link>

      <h1 className="text-3xl font-bold mb-8 [text-shadow:1px_1px_0_rgba(0,0,0,0.15)] dark:[text-shadow:1px_1px_0_rgba(0,0,0,0.5)]">
        <span className="text-cyan-500 dark:text-cyan-400">Leaderboard</span>
      </h1>

      {leaderboard.length === 0 ? (
        <div className="text-center py-20 text-gray-500">
          <p className="text-lg mb-2">No progress yet</p>
          <p className="text-sm">
            Solve problems to appear on the leaderboard!
          </p>
        </div>
      ) : (
        <div className="xp-panel overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-gradient-to-b from-cyan-500 to-cyan-700 border-b border-cyan-800 text-sm text-white">
                <th className="text-left px-6 py-3 font-bold">Rank</th>
                <th className="text-left px-6 py-3 font-bold">User</th>
                <th className="text-center px-6 py-3 font-bold">Streak</th>
                <th className="text-right px-6 py-3 font-bold">Solved</th>
              </tr>
            </thead>
            <tbody>
              {leaderboard.map((entry) => (
                <tr
                  key={entry.id}
                  className="border-b border-cyan-100 dark:border-cyan-900/50 last:border-0 odd:bg-cyan-50/40 dark:odd:bg-gray-800/30 hover:bg-cyan-100/60 dark:hover:bg-gray-800/60 transition-colors"
                >
                  <td className="px-6 py-4 font-mono text-sm">
                    {entry.rank <= 3 ? (
                      <span className="text-yellow-400">
                        {entry.rank === 1 ? "🥇" : entry.rank === 2 ? "🥈" : "🥉"} {entry.rank === 1 ? "1st" : entry.rank === 2 ? "2nd" : "3rd"}
                      </span>
                    ) : (
                      <span className="text-gray-500">{entry.rank}th</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <Link
                      href={`/profile/${entry.username}`}
                      className="flex items-center gap-3 hover:opacity-80 transition-opacity"
                    >
                      <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-xs font-bold overflow-hidden flex-shrink-0">
                        {entry.avatarUrl || entry.discordAvatar ? (
                          <img
                            src={entry.avatarUrl || entry.discordAvatar || ""}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          entry.username[0].toUpperCase()
                        )}
                      </div>
                      <div>
                        <span className="font-medium block">
                          {entry.displayName || entry.username}
                        </span>
                        <span className="text-xs text-gray-500">
                          @{entry.username}
                        </span>
                      </div>
                    </Link>
                  </td>
                  <td className="px-6 py-4 text-center">
                    {entry.currentStreak > 0 && (
                      <span className="inline-flex items-center gap-1 text-sm">
                        <Flame className="w-4 h-4 text-orange-400" />
                        <span className="text-orange-400 font-medium">{entry.currentStreak}</span>
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className="font-mono text-cyan-400 font-bold">
                      {entry.totalSolved}
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
