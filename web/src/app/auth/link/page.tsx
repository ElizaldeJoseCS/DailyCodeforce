"use client";

import { useState } from "react";
import Link from "next/link";
import { Code2 } from "lucide-react";

export default function LinkDiscordPage() {
  const [code, setCode] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("loading");

    try {
      const res = await fetch("/api/auth/link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        setStatus("error");
        setMessage(data.error || "Failed to link account");
      } else {
        setStatus("success");
        setMessage("Discord account linked successfully!");
      }
    } catch {
      setStatus("error");
      setMessage("Something went wrong");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 font-bold text-2xl mb-4">
            <Code2 className="w-8 h-8 text-cyan-400" />
            <span>DailyCodeforce</span>
          </Link>
          <h1 className="text-2xl font-bold">Link Discord Account</h1>
          <p className="text-gray-400 mt-2">Enter the code from the <code className="text-cyan-400">/link</code> command</p>
        </div>

        <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-8">
          {status === "success" ? (
            <div className="text-center">
              <div className="text-4xl mb-4">✅</div>
              <p className="text-green-400 font-medium mb-4">{message}</p>
              <p className="text-gray-400 text-sm mb-4">Your Discord is now linked. Use <code className="text-cyan-400">/stats</code> in Discord to see your progress!</p>
              <Link href="/" className="inline-block py-2.5 px-6 rounded-lg bg-cyan-600 hover:bg-cyan-500 font-medium transition-colors">
                Back to Home
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {status === "error" && (
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                  {message}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Link Code</label>
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="ABC123"
                  maxLength={6}
                  className="w-full px-4 py-2.5 rounded-lg bg-gray-800 border border-gray-700 text-gray-100 text-center text-2xl font-mono tracking-[0.5em] uppercase focus:outline-none focus:border-cyan-500 transition-colors"
                  required
                  autoFocus
                />
              </div>

              <button
                type="submit"
                disabled={status === "loading" || code.length < 6}
                className="w-full py-2.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
              >
                {status === "loading" ? "Linking..." : "Link Account"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
