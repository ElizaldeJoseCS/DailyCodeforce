"use client";

import { useState, useRef, useCallback } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import {
  ExternalLink,
  ArrowLeft,
  Calendar,
  Eye,
  EyeOff,
  Copy,
  Check,
  CheckCircle2,
  ShieldCheck,
  Loader2,
  Code,
  BookOpen,
  Clipboard,
  Flag,
  MessageSquare,
} from "lucide-react";
import Markdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import SubmitClient from "./SubmitClient";
import ReportModal from "./ReportModal";
import Discussion from "./Discussion";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ExampleBlock({ ex }: { ex: { input: string; output: string } }) {
  const inputRef = useRef<HTMLDivElement>(null);
  const outputRef = useRef<HTMLDivElement>(null);
  const [copiedInput, setCopiedInput] = useState(false);
  const [copiedOutput, setCopiedOutput] = useState(false);

  const copyInput = useCallback(async () => {
    await navigator.clipboard.writeText(ex.input);
    setCopiedInput(true);
    setTimeout(() => setCopiedInput(false), 1500);
  }, [ex.input]);

  const copyOutput = useCallback(async () => {
    await navigator.clipboard.writeText(ex.output);
    setCopiedOutput(true);
    setTimeout(() => setCopiedOutput(false), 1500);
  }, [ex.output]);

  return (
    <table className="w-full border-collapse text-sm my-2">
      <tbody>
        <tr>
          <td className="align-top pr-4 pb-1 w-1/2">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold text-gray-500 dark:text-gray-400">Input</span>
              <button onClick={copyInput} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors" title="Copy input">
                {copiedInput ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
            <div ref={inputRef} className="bg-gray-50 dark:bg-[#0d1117] border border-gray-200 dark:border-gray-700 rounded p-3 font-mono text-xs leading-relaxed whitespace-pre-wrap break-all text-gray-800 dark:text-gray-200">
              {ex.input}
            </div>
          </td>
          <td className="align-top pb-1 w-1/2">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold text-gray-500 dark:text-gray-400">Output</span>
              <button onClick={copyOutput} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors" title="Copy output">
                {copiedOutput ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
            <div ref={outputRef} className="bg-gray-50 dark:bg-[#0d1117] border border-gray-200 dark:border-gray-700 rounded p-3 font-mono text-xs leading-relaxed whitespace-pre-wrap break-all text-gray-800 dark:text-gray-200">
              {ex.output}
            </div>
          </td>
        </tr>
      </tbody>
    </table>
  );
}

interface DailyProblem {
  id: string;
  tier: string;
  date: Date;
  editorialUrl: string | null;
  editorial: string | null;
  problem: {
    id: string;
    name: string;
    rating: number;
    tags: string[];
    url: string;
    cfContestId: number;
    cfIndex: string;
    testCases: { input: string; output: string }[] | null;
  };
  statement?: {
    statement: string;
    inputSpec: string;
    outputSpec: string;
    examples: { input: string; output: string }[];
    note: string;
    timeLimit: string;
    memoryLimit: string;
  } | null;
}

const TIER_LABELS: Record<string, string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
  expert: "Expert",
};

function TierBadge({ tier }: { tier: string }) {
  const colors: Record<string, string> = {
    beginner: "text-emerald-600 dark:text-emerald-400 border-emerald-500/30 bg-emerald-500/10",
    intermediate: "text-yellow-600 dark:text-yellow-400 border-yellow-500/30 bg-yellow-500/10",
    advanced: "text-orange-600 dark:text-orange-400 border-orange-500/30 bg-orange-500/10",
    expert: "text-red-600 dark:text-red-400 border-red-500/30 bg-red-500/10",
  };
  return (
    <span
      className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border ${colors[tier] || "text-gray-500 dark:text-gray-400 border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-800"}`}
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CodeBlock({ children, className, ...props }: any) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);
  const match = className ? /language-(\w+)/.exec(className) : null;
  const language = match ? match[1] : null;

  const handleCopy = useCallback(async () => {
    const codeEl = wrapperRef.current?.querySelector("code");
    const text = codeEl?.textContent || "";
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, []);

  if (!language) {
    return (
      <code className={className} {...props}>
        {children}
      </code>
    );
  }

  return (
    <div ref={wrapperRef} className="relative group">
      <div className="absolute top-0 left-0 z-10 flex items-center">
        <span className="px-2.5 py-0.5 text-xs font-mono font-medium text-cyan-400 bg-cyan-500/10 rounded-br-lg border-b border-r border-cyan-500/20">
          {language.toUpperCase()}
        </span>
      </div>
      <button
        onClick={handleCopy}
        className="absolute top-2 right-2 z-10 p-1.5 rounded-md bg-gray-700/50 hover:bg-gray-600/50 text-gray-400 hover:text-gray-200 transition-colors"
        title="Copy code"
      >
        {copied ? (
          <Check className="w-4 h-4 text-green-400" />
        ) : (
          <Copy className="w-4 h-4" />
        )}
      </button>
      <pre className={className}>
        <code className={className} {...props}>
          {children}
        </code>
      </pre>
    </div>
  );
}

export default function ProblemPageClient({
  daily,
  isSolved: initialSolved,
  isVerified: initialVerified,
}: {
  daily: DailyProblem;
  isSolved: boolean;
  isVerified: boolean;
}) {
  const { data: session } = useSession();
  const [showAnswer, setShowAnswer] = useState(false);
  const [activeTab, setActiveTab] = useState<"editorial" | "submit" | "discussion">("editorial");
  const [solved, setSolved] = useState(initialSolved);
  const [verified, setVerified] = useState(initialVerified);
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState("");
  const [testCasesCopied, setTestCasesCopied] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);

  const handleCopyTestCases = useCallback(async () => {
    const testCases = daily.problem.testCases;
    if (!testCases || testCases.length === 0) return;
    const text = testCases
      .map((tc, i) => `Input ${i + 1}:\n${tc.input}\n\nOutput ${i + 1}:\n${tc.output}`)
      .join("\n\n");
    await navigator.clipboard.writeText(text);
    setTestCasesCopied(true);
    setTimeout(() => setTestCasesCopied(false), 2000);
  }, [daily.problem.testCases]);

  const handleVerify = async () => {
    if (!session || solved || verifying) return;
    setVerifying(true);
    setVerifyError("");
    try {
      const res = await fetch("/api/progress/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dailyProblemId: daily.id }),
      });
      const data = await res.json();
      if (res.ok) {
        setSolved(true);
        setVerified(true);
      } else {
        setVerifyError(data.error || "Verification failed");
      }
    } catch {
      setVerifyError("Failed to verify. Try again.");
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <Link
        href="/"
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-300 mb-8 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to today
      </Link>

      <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900/50 overflow-hidden">
        <div className="p-8 border-b border-gray-200 dark:border-gray-800">
          <div className="flex items-center gap-3 mb-4">
            <TierBadge tier={daily.tier} />
            <RatingBadge rating={daily.problem.rating} />
            {solved && verified && (
              <span className="inline-flex items-center gap-1 text-xs text-green-500 dark:text-green-400">
                <ShieldCheck className="w-4 h-4" />
                Verified
              </span>
            )}
            {solved && !verified && (
              <span className="inline-flex items-center gap-1 text-xs text-yellow-500 dark:text-yellow-400">
                <CheckCircle2 className="w-4 h-4" />
                Solved
              </span>
            )}
          </div>

          <h1 className="text-3xl font-bold mb-4">{daily.problem.name}</h1>

          <div className="flex flex-wrap gap-2 mb-6">
            {daily.problem.tags.map((tag) => (
              <span
                key={tag}
                className="text-sm px-3 py-1 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300"
              >
                {tag}
              </span>
            ))}
          </div>

          <div className="flex items-center gap-4 flex-wrap">
            <a
              href={daily.problem.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-medium text-sm transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              Solve on Codeforces
            </a>

            {daily.problem.testCases && daily.problem.testCases.length > 0 && (
              <button
                onClick={handleCopyTestCases}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-200 font-medium text-sm transition-colors"
              >
                {testCasesCopied ? (
                  <Check className="w-4 h-4 text-green-400" />
                ) : (
                  <Clipboard className="w-4 h-4" />
                )}
                {testCasesCopied ? "Copied!" : "Copy Test Cases"}
              </button>
            )}

            {session && !solved && (
              <button
                onClick={handleVerify}
                disabled={verifying}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-green-600/20 border border-green-500/30 hover:bg-green-600/30 text-green-400 font-medium text-sm transition-colors disabled:opacity-50"
              >
                {verifying ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <ShieldCheck className="w-4 h-4" />
                )}
                {verifying ? "Checking Codeforces..." : "Verify Submission"}
              </button>
            )}

            {solved && (
              <span className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400 font-medium text-sm">
                {verified ? (
                  <ShieldCheck className="w-4 h-4" />
                ) : (
                  <CheckCircle2 className="w-4 h-4" />
                )}
                {verified ? "Verified on Codeforces" : "Marked as Solved"}
              </span>
            )}
          </div>

          {verifyError && (
            <div className="mt-3 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              {verifyError}
            </div>
          )}
        </div>

        {daily.statement && (
          <div className="p-8 border-b border-gray-200 dark:border-gray-800">
            <div className="flex items-center gap-4 mb-4 text-xs text-gray-400 dark:text-gray-500">
              {daily.statement.timeLimit && (
                <span>Time: {daily.statement.timeLimit}</span>
              )}
              {daily.statement.memoryLimit && (
                <span>Memory: {daily.statement.memoryLimit}</span>
              )}
            </div>

            <div className="prose prose-sm dark:prose-invert max-w-none">
              {daily.statement.statement.split("\n").map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>

            {daily.statement.inputSpec && (
              <div className="mt-6">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Input</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">{daily.statement.inputSpec}</p>
              </div>
            )}

            {daily.statement.outputSpec && (
              <div className="mt-4">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Output</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">{daily.statement.outputSpec}</p>
              </div>
            )}

            {daily.statement.examples.length > 0 && (
              <div className="mt-6">
                <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-3">Examples</h3>
                {daily.statement.examples.map((ex, i) => (
                  <ExampleBlock key={i} ex={ex} />
                ))}
              </div>
            )}

            {daily.statement.note && (
              <div className="mt-6 p-4 rounded-lg bg-gray-50 dark:bg-gray-800/30 border border-gray-200 dark:border-gray-800">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Note</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-line">{daily.statement.note}</p>
              </div>
            )}
          </div>
        )}

        <div className="p-8 border-b border-gray-200 dark:border-gray-800">
          <h2 className="text-lg font-semibold mb-3">Problem Details</h2>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-400 dark:text-gray-500">Contest</span>
              <p className="font-mono">
                {daily.problem.cfContestId}
                {daily.problem.cfIndex}
              </p>
            </div>
            <div>
              <span className="text-gray-400 dark:text-gray-500">Date Assigned</span>
              <p className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {daily.date instanceof Date
                  ? daily.date.toISOString().split("T")[0]
                  : String(daily.date).split("T")[0]}
              </p>
            </div>
          </div>
        </div>

        <div className="border-t border-gray-200 dark:border-gray-800">
          <div className="flex border-b border-gray-200 dark:border-gray-800">
            <button
              onClick={() => { setActiveTab("editorial"); setShowAnswer(false); }}
              className={`flex-1 flex items-center justify-center gap-2 p-4 text-sm font-medium transition-colors ${
                activeTab === "editorial"
                  ? "text-cyan-600 dark:text-cyan-400 border-b-2 border-cyan-500 bg-cyan-50 dark:bg-gray-800/30"
                  : "text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/20"
              }`}
            >
              <BookOpen className="w-4 h-4" />
              Editorial
            </button>
            <button
              onClick={() => { setActiveTab("submit"); setShowAnswer(false); }}
              className={`flex-1 flex items-center justify-center gap-2 p-4 text-sm font-medium transition-colors ${
                activeTab === "submit"
                  ? "text-emerald-600 dark:text-emerald-400 border-b-2 border-emerald-500 bg-emerald-50 dark:bg-gray-800/30"
                  : "text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/20"
              }`}
            >
              <Code className="w-4 h-4" />
              Submit
            </button>
            <button
              onClick={() => { setActiveTab("discussion"); setShowAnswer(false); }}
              className={`flex-1 flex items-center justify-center gap-2 p-4 text-sm font-medium transition-colors ${
                activeTab === "discussion"
                  ? "text-purple-600 dark:text-purple-400 border-b-2 border-purple-500 bg-purple-50 dark:bg-gray-800/30"
                  : "text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/20"
              }`}
            >
              <MessageSquare className="w-4 h-4" />
              Discussion
            </button>
          </div>

          {activeTab === "editorial" && (
            <>
              <button
                onClick={() => setShowAnswer(!showAnswer)}
                className="w-full flex items-center justify-between p-6 text-left hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  {showAnswer ? (
                    <EyeOff className="w-5 h-5 text-gray-400" />
                  ) : (
                    <Eye className="w-5 h-5 text-cyan-500 dark:text-cyan-400" />
                  )}
                  <span className="font-semibold text-lg">
                    {showAnswer ? "Hide Editorial" : "Show Editorial"}
                  </span>
                </div>
                <span className="text-sm text-gray-400 dark:text-gray-500">
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
                  <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-800 flex items-center justify-between">
                    <a
                      href={daily.problem.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-sm text-cyan-400 hover:text-cyan-300 transition-colors"
                    >
                      <ExternalLink className="w-4 h-4" />
                      View on Codeforces
                    </a>
                    <button
                      onClick={() => setReportOpen(true)}
                      className="inline-flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500 hover:text-red-400 dark:hover:text-red-400 transition-colors"
                      title="Report incorrect editorial"
                    >
                      <Flag className="w-3.5 h-3.5" />
                      Report issue
                    </button>
                    <ReportModal
                      open={reportOpen}
                      onClose={() => setReportOpen(false)}
                      preselectedProblemId={daily.id}
                    />
                  </div>
                </div>
              )}
            </>
          )}

          {activeTab === "submit" && (
            <div className="p-6">
              <div className="mb-4 p-3 rounded-lg bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 text-amber-700 dark:text-amber-400 text-sm">
                This judge only runs the visible sample test cases from Codeforces.
                Once your solution passes here, submit it on{" "}
                <a
                  href={daily.problem.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:text-amber-300"
                >
                  Codeforces
                </a>{" "}
                to verify against the full test suite.
              </div>
              <SubmitClient problemId={daily.problem.id} />
            </div>
          )}

          {activeTab === "discussion" && (
            <Discussion dailyProblemId={daily.id} />
          )}
        </div>
      </div>
    </div>
  );
}
