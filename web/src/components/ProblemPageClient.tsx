"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ExternalLink,
  ArrowLeft,
  Calendar,
  Eye,
  EyeOff,
  Copy,
  Check,
} from "lucide-react";
import Markdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";

interface DailyProblem {
  id: string;
  tier: string;
  date: Date;
  editorialUrl: string | null;
  editorial: string | null;
  problem: {
    name: string;
    rating: number;
    tags: string[];
    url: string;
    cfContestId: number;
    cfIndex: string;
  };
}

const TIER_LABELS: Record<string, string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
  expert: "Expert",
};

function TierBadge({ tier }: { tier: string }) {
  const colors: Record<string, string> = {
    beginner: "text-emerald-400 border-emerald-500/30 bg-emerald-500/10",
    intermediate: "text-yellow-400 border-yellow-500/30 bg-yellow-500/10",
    advanced: "text-orange-400 border-orange-500/30 bg-orange-500/10",
    expert: "text-red-400 border-red-500/30 bg-red-500/10",
  };
  return (
    <span
      className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border ${colors[tier] || "text-gray-400 border-gray-600 bg-gray-800"}`}
    >
      {TIER_LABELS[tier] || tier}
    </span>
  );
}

function RatingBadge({ rating }: { rating: number }) {
  let color = "text-gray-400";
  if (rating < 1200) color = "text-gray-400";
  else if (rating < 1400) color = "text-green-400";
  else if (rating < 1600) color = "text-cyan-400";
  else if (rating < 1900) color = "text-blue-400";
  else if (rating < 2100) color = "text-purple-400";
  else if (rating < 2400) color = "text-yellow-400";
  else color = "text-red-400";
  return (
    <span className={`text-2xl font-mono font-bold ${color}`}>{rating}</span>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className="absolute top-2 right-2 p-1.5 rounded-md bg-gray-700/50 hover:bg-gray-600/50 text-gray-400 hover:text-gray-200 transition-colors"
      title="Copy code"
    >
      {copied ? (
        <Check className="w-4 h-4 text-green-400" />
      ) : (
        <Copy className="w-4 h-4" />
      )}
    </button>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CodeBlock({ children, className }: any) {
  const match = /language-(\w+)/.exec(className);
  const language = match ? match[1] : null;
  const code =
    typeof children === "string"
      ? children
      : typeof children === "object" && children !== null && "props" in children
        ? String((children as { props?: { children?: string } }).props?.children ?? "")
        : "";

  if (!language) {
    return (
      <code className={className}>
        {children}
      </code>
    );
  }

  return (
    <div className="relative group">
      <div className="absolute top-0 left-0 z-10 flex items-center">
        <span className="px-2.5 py-0.5 text-xs font-mono font-medium text-cyan-400 bg-cyan-500/10 rounded-br-lg border-b border-r border-cyan-500/20">
          {language.toUpperCase()}
        </span>
      </div>
      <CopyButton text={code} />
      <pre className={className}>
        <code className={className}>
          {children}
        </code>
      </pre>
    </div>
  );
}

export default function ProblemPageClient({ daily }: { daily: DailyProblem }) {
  const [showAnswer, setShowAnswer] = useState(false);

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <Link
        href="/"
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-300 mb-8 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to today
      </Link>

      <div className="rounded-xl border border-gray-800 bg-gray-900/50 overflow-hidden">
        <div className="p-8 border-b border-gray-800">
          <div className="flex items-center gap-3 mb-4">
            <TierBadge tier={daily.tier} />
            <RatingBadge rating={daily.problem.rating} />
          </div>

          <h1 className="text-3xl font-bold mb-4">{daily.problem.name}</h1>

          <div className="flex flex-wrap gap-2 mb-6">
            {daily.problem.tags.map((tag) => (
              <span
                key={tag}
                className="text-sm px-3 py-1 rounded-lg bg-gray-800 text-gray-300"
              >
                {tag}
              </span>
            ))}
          </div>

          <div className="flex items-center gap-4">
            <a
              href={daily.problem.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-medium text-sm transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              Solve on Codeforces
            </a>
          </div>
        </div>

        <div className="p-8 border-b border-gray-800">
          <h2 className="text-lg font-semibold mb-3">Problem Details</h2>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-500">Contest</span>
              <p className="font-mono">
                {daily.problem.cfContestId}
                {daily.problem.cfIndex}
              </p>
            </div>
            <div>
              <span className="text-gray-500">Date Assigned</span>
              <p className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {daily.date instanceof Date
                  ? daily.date.toISOString().split("T")[0]
                  : String(daily.date).split("T")[0]}
              </p>
            </div>
          </div>
        </div>

        <div className="border-t border-gray-800">
          <button
            onClick={() => setShowAnswer(!showAnswer)}
            className="w-full flex items-center justify-between p-6 text-left hover:bg-gray-800/50 transition-colors"
          >
            <div className="flex items-center gap-3">
              {showAnswer ? (
                <EyeOff className="w-5 h-5 text-gray-400" />
              ) : (
                <Eye className="w-5 h-5 text-cyan-400" />
              )}
              <span className="font-semibold text-lg">
                {showAnswer ? "Hide Editorial" : "Show Editorial & Solution"}
              </span>
            </div>
            <span className="text-sm text-gray-500">
              {showAnswer ? "Click to hide" : "Click to reveal"}
            </span>
          </button>

          {showAnswer && daily.editorial && (
            <div className="px-8 pb-8">
              <div className="prose prose-invert max-w-none">
                <Markdown
                  rehypePlugins={[rehypeHighlight]}
                  components={{
                    pre: ({ children }) => <>{children}</>,
                    code: CodeBlock,
                  }}
                >
                  {daily.editorial}
                </Markdown>
              </div>
              <div className="mt-6 pt-4 border-t border-gray-800">
                <a
                  href={daily.problem.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-sm text-cyan-400 hover:text-cyan-300 transition-colors"
                >
                  <ExternalLink className="w-4 h-4" />
                  View on Codeforces
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
