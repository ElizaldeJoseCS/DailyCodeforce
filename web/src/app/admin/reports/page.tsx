"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Flag, ArrowLeft, Loader2, Trash2, MessageSquare, ExternalLink } from "lucide-react";
import Link from "next/link";

interface Report {
  id: string;
  message: string | null;
  createdAt: string;
  userId: string | null;
  user: { username: string | null; displayName: string | null } | null;
  dailyProblem: {
    id: string;
    tier: string;
    date: string;
    problem: { id: string; name: string; rating: number; url: string; cfContestId: number; cfIndex: string };
  } | null;
}

const TIER_COLORS: Record<string, string> = {
  beginner: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  intermediate: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  advanced: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  expert: "bg-red-500/20 text-red-400 border-red-500/30",
};

export default function AdminReportsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (status === "loading") return;
    const role = (session?.user as Record<string, string> | undefined)?.role;
    if (!session || role !== "admin") {
      router.push("/");
      return;
    }
    fetch("/api/reports")
      .then((r) => r.json())
      .then((data) => {
        setReports(data.reports || []);
        setLoading(false);
      })
      .catch(() => {
        setError("Failed to load reports.");
        setLoading(false);
      });
  }, [session, status, router]);

  const handleDelete = async (reportId: string) => {
    if (!confirm("Delete this report?")) return;
    try {
      await fetch(`/api/reports?id=${reportId}`, { method: "DELETE" });
      setReports((prev) => prev.filter((r) => r.id !== reportId));
    } catch {
      // ignore
    }
  };

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  const role = (session?.user as Record<string, string> | undefined)?.role;
  if (!session || role !== "admin") return null;

  return (
    <div className="max-w-5xl mx-auto px-4 py-12">
      <Link href="/" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 mb-8 transition-colors">
        <ArrowLeft className="w-4 h-4" />
        Back to home
      </Link>

      <div className="flex items-center gap-3 mb-8">
        <Flag className="w-6 h-6 text-red-400" />
        <h1 className="text-2xl font-bold">Reports</h1>
        <span className="text-sm text-gray-500">({reports.length})</span>
      </div>

      {error && (
        <div className="p-4 rounded-sm bg-red-500/10 border border-red-500/20 text-red-400 text-sm mb-6">{error}</div>
      )}

      {reports.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <Flag className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p>No reports yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {reports.map((r) => (
            <div
              key={r.id}
              className="p-4 rounded-sm border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900/50"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  {r.dailyProblem ? (
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${TIER_COLORS[r.dailyProblem.tier] || ""}`}>
                        {r.dailyProblem.tier}
                      </span>
                      <Link
                        href={`/problem/${r.dailyProblem.id}`}
                        className="text-sm font-semibold hover:text-cyan-400 transition-colors truncate"
                      >
                        {r.dailyProblem.problem.name}
                      </Link>
                      <span className="text-xs text-gray-500 font-mono">
                        {r.dailyProblem.problem.cfContestId}{r.dailyProblem.problem.cfIndex}
                      </span>
                      <span className="text-xs text-gray-500">rating {r.dailyProblem.problem.rating}</span>
                      <a
                        href={r.dailyProblem.problem.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-gray-400 hover:text-cyan-400 transition-colors"
                      >
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  ) : (
                    <div className="text-xs text-gray-500 mb-1.5">General report (no specific problem)</div>
                  )}

                  {r.message && (
                    <div className="flex items-start gap-2 mt-2 p-3 rounded-sm bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700">
                      <MessageSquare className="w-3.5 h-3.5 text-gray-400 mt-0.5 shrink-0" />
                      <p className="text-sm text-gray-700 dark:text-gray-300">{r.message}</p>
                    </div>
                  )}

                  <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                    <span>{r.user ? `@${r.user.username}` : "Anonymous"}</span>
                    <span>{new Date(r.createdAt).toLocaleString()}</span>
                    <span>{r.dailyProblem?.date || "N/A"}</span>
                  </div>
                </div>

                <button
                  onClick={() => handleDelete(r.id)}
                  className="p-2 rounded-sm hover:bg-red-500/10 text-gray-400 hover:text-red-400 transition-colors shrink-0"
                  title="Delete report"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
