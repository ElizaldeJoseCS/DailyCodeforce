"use client";

import { useState, useEffect, useCallback } from "react";
import { X, Flag, Send, Loader2, CheckCircle2 } from "lucide-react";

export default function ReportModal({
  open,
  onClose,
  preselectedProblemId,
}: {
  open: boolean;
  onClose: () => void;
  preselectedProblemId?: string;
}) {
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setMessage("");
      setSubmitted(false);
      setError("");
    }
  }, [open]);

  const handleSubmit = useCallback(async () => {
    if (!message.trim()) {
      setError("Please describe the issue.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dailyProblemId: preselectedProblemId || null,
          message: message.trim(),
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setSubmitted(true);
      } else {
        setError(data.error || "Failed to submit report.");
      }
    } catch {
      setError("Failed to submit report. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [message, preselectedProblemId]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-lg mx-4 bg-gray-900 border border-cyan-800 rounded-sm shadow-2xl overflow-hidden">
        <div className="xp-titlebar flex items-center justify-between px-4 py-2">
          <div className="flex items-center gap-2 text-white">
            <Flag className="w-4 h-4" />
            <h2 className="text-sm font-bold">Report an Issue</h2>
          </div>
          <button
            onClick={onClose}
            className="w-6 h-5 flex items-center justify-center rounded-sm bg-gradient-to-b from-white to-cyan-200 hover:from-cyan-50 hover:to-cyan-300 text-cyan-900 border border-cyan-700 text-xs font-bold"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {submitted ? (
          <div className="p-8 text-center">
            <CheckCircle2 className="w-12 h-12 text-green-400 mx-auto mb-3" />
            <h3 className="text-lg font-medium text-white mb-1">Report Submitted</h3>
            <p className="text-sm text-gray-400 mb-6">Thanks for letting us know. We&apos;ll look into it.</p>
            <button
              onClick={onClose}
              className="px-6 py-2 xp-btn text-sm"
            >
              Close
            </button>
          </div>
        ) : (
          <div className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">
                What&apos;s wrong?
              </label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={5}
                placeholder="Describe the issue — include the problem name if relevant..."
                autoFocus
                className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-sm text-gray-200 text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500 resize-none"
              />
            </div>

            {error && (
              <div className="p-3 rounded-sm bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                {error}
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm text-gray-400 hover:text-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={loading || !message.trim()}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-b from-red-500 to-red-700 hover:from-red-400 hover:to-red-600 disabled:from-gray-700 disabled:to-gray-700 disabled:text-gray-500 text-white text-sm font-bold rounded-sm border border-red-800 shadow-[inset_0_1px_0_rgba(255,255,255,0.4)] active:shadow-inner transition-colors"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                Submit Report
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
