"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Code2, ExternalLink, Copy, Check, Loader2 } from "lucide-react";

type Step = "input" | "token" | "done";

export default function SetupPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("input");
  const [cfHandle, setCfHandle] = useState("");
  const [token, setToken] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [verified, setVerified] = useState<{ handle: string; rating: number; rank: string } | null>(null);

  const handleStartVerification = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const res = await fetch("/api/users/verify-start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cfHandle }),
    });

    const data = await res.json();

    if (!res.ok) {
      setError(data.error || "Failed to start verification");
      setLoading(false);
      return;
    }

    setToken(data.token);
    setStep("token");
    setLoading(false);
  };

  const handleConfirm = async () => {
    setError("");
    setLoading(true);

    const res = await fetch("/api/users/verify-confirm", { method: "POST" });
    const data = await res.json();

    if (!res.ok) {
      setError(data.error || "Verification failed");
      setLoading(false);
      return;
    }

    setVerified(data);
    setStep("done");
    setLoading(false);

    setTimeout(() => {
      router.push("/");
      router.refresh();
    }, 2000);
  };

  const copyToken = () => {
    navigator.clipboard.writeText(token);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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

        <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900/50 p-8">
          {error && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm mb-4">
              {error}
            </div>
          )}

          {step === "input" && (
            <form onSubmit={handleStartVerification} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Codeforces Handle</label>
                <input
                  type="text"
                  value={cfHandle}
                  onChange={(e) => setCfHandle(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:border-cyan-500 transition-colors"
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
                className="w-full py-2.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {loading ? "Checking..." : "Start Verification"}
              </button>
            </form>
          )}

          {step === "token" && (
            <div className="space-y-4">
              <div className="p-3 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-600 dark:text-cyan-400 text-sm">
                Your verification token is ready. Follow the steps below.
              </div>

              <ol className="space-y-3 text-sm text-gray-700 dark:text-gray-300">
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-cyan-600 text-white text-xs flex items-center justify-center font-bold">1</span>
                  <span>
                    Go to{" "}
                    <a
                      href="https://codeforces.com/settings/profile"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-cyan-500 hover:text-cyan-400 underline"
                    >
                      Codeforces Settings
                      <ExternalLink className="w-3 h-3 inline ml-0.5" />
                    </a>
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-cyan-600 text-white text-xs flex items-center justify-center font-bold">2</span>
                  <span>Set your <strong>First name</strong> to exactly:</span>
                </li>
              </ol>

              <div className="flex items-center gap-2 bg-gray-100 dark:bg-gray-800 rounded-lg p-3 border border-gray-300 dark:border-gray-700">
                <code className="flex-1 text-center font-mono text-lg text-cyan-600 dark:text-cyan-400 select-all">{token}</code>
                <button
                  onClick={copyToken}
                  className="flex-shrink-0 p-1.5 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                  title="Copy token"
                >
                  {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4 text-gray-500" />}
                </button>
              </div>

              <ol className="space-y-3 text-sm text-gray-700 dark:text-gray-300" start={3}>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-cyan-600 text-white text-xs flex items-center justify-center font-bold">3</span>
                  <span>Save changes on Codeforces</span>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-cyan-600 text-white text-xs flex items-center justify-center font-bold">4</span>
                  <span>Come back here and click the button below</span>
                </li>
              </ol>

              <p className="text-xs text-gray-500">Token expires in 15 minutes. You can revert your name after verification.</p>

              <button
                onClick={handleConfirm}
                disabled={loading}
                className="w-full py-2.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {loading ? "Verifying..." : "I've set it — Verify me"}
              </button>

              <button
                onClick={() => { setStep("input"); setError(""); }}
                className="w-full py-2 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
              >
                Use a different handle
              </button>
            </div>
          )}

          {step === "done" && verified && (
            <div className="text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center mx-auto">
                <Check className="w-8 h-8 text-green-500" />
              </div>
              <div>
                <p className="text-lg font-bold text-green-500">Verified!</p>
                <p className="text-gray-600 dark:text-gray-400 mt-1">
                  Linked to <strong>{verified.handle}</strong> (Rating: {verified.rating}, {verified.rank})
                </p>
              </div>
              <p className="text-xs text-gray-500">You can now revert your Codeforces name back to normal. Redirecting...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
