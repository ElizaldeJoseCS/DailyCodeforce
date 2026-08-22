"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Code2, ExternalLink } from "lucide-react";

export default function SetupPage() {
  const router = useRouter();
  const [cfHandle, setCfHandle] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const res = await fetch("/api/users/link-cf", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cfHandle }),
    });

    const data = await res.json();

    if (!res.ok) {
      setError(data.error || "Failed to link handle");
      setLoading(false);
      return;
    }

    router.push("/");
    router.refresh();
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Code2 className="w-12 h-12 text-cyan-400 mx-auto mb-4" />
          <h1 className="text-2xl font-bold">Link your Codeforces account</h1>
          <p className="text-gray-400 mt-2">
            Connect your Codeforces handle to verify your submissions automatically.
          </p>
        </div>

        <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Codeforces Handle</label>
              <input
                type="text"
                value={cfHandle}
                onChange={(e) => setCfHandle(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg bg-gray-800 border border-gray-700 text-gray-100 focus:outline-none focus:border-cyan-500 transition-colors"
                required
                placeholder="e.g. tourist"
                autoFocus
              />
              <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                Find your handle on your
                <a
                  href="https://codeforces.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-cyan-500 hover:text-cyan-400"
                >
                  Codeforces profile
                  <ExternalLink className="w-3 h-3 inline ml-0.5" />
                </a>
              </p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
            >
              {loading ? "Linking..." : "Link Account"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
