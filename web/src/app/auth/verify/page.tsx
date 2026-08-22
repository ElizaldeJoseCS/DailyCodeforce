"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Code2 } from "lucide-react";
import { Suspense } from "react";

function VerifyForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const prefillEmail = searchParams.get("email") || "";
  const [email, setEmail] = useState(prefillEmail);
  const [code, setCode] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("loading");

    try {
      const res = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code: code.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        setStatus("error");
        setMessage(data.error || "Verification failed");
      } else {
        setStatus("success");
        setMessage("Email verified! Redirecting to sign in...");
        setTimeout(() => router.push("/auth/signin"), 2000);
      }
    } catch {
      setStatus("error");
      setMessage("Something went wrong");
    }
  };

  return (
    <div className="w-full max-w-md">
      <div className="text-center mb-8">
        <Link href="/" className="inline-flex items-center gap-2 font-bold text-2xl mb-4">
          <Code2 className="w-8 h-8 text-cyan-400" />
          <span>DailyCodeforce</span>
        </Link>
        <h1 className="text-2xl font-bold">Verify your email</h1>
        <p className="text-gray-400 mt-2">Enter the 6-digit code sent to your email</p>
      </div>

      <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-8">
        {status === "success" ? (
          <div className="text-center">
            <div className="text-4xl mb-4">✅</div>
            <p className="text-green-400 font-medium">{message}</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {status === "error" && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                {message}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg bg-gray-800 border border-gray-700 text-gray-100 focus:outline-none focus:border-cyan-500 transition-colors"
                required
                disabled={!!prefillEmail}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Verification Code</label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="123456"
                maxLength={6}
                className="w-full px-4 py-2.5 rounded-lg bg-gray-800 border border-gray-700 text-gray-100 text-center text-2xl font-mono tracking-[0.5em] focus:outline-none focus:border-cyan-500 transition-colors"
                required
                autoFocus
              />
            </div>

            <button
              type="submit"
              disabled={loading || code.length < 6}
              className="w-full py-2.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
            >
              {status === "loading" ? "Verifying..." : "Verify Email"}
            </button>
          </form>
        )}

        <p className="mt-6 text-center text-sm text-gray-500">
          <Link href="/auth/signin" className="text-cyan-400 hover:text-cyan-300">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function VerifyPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <Suspense fallback={<div className="text-gray-400">Loading...</div>}>
        <VerifyForm />
      </Suspense>
    </div>
  );
}
