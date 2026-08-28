"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import {
  ExternalLink,
  ArrowLeft,
  Eye,
  EyeOff,
  Copy,
  Check,
  CheckCircle2,
  ShieldCheck,
  Loader2,
  Code,
  BookOpen,
  Flag,
  GripVertical,
} from "lucide-react";
import Markdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import dynamic from "next/dynamic";
import SubmitClient from "./SubmitClient";
import ReportModal from "./ReportModal";
import Discussion from "./Discussion";
import { DEFAULT_CODE } from "@/lib/defaultCppCode";

const CppEditor = dynamic(() => import("./CppEditor"), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full bg-[#0d1117] flex items-center justify-center text-gray-500">
      Loading editor...
    </div>
  ),
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ExampleBlock({ ex }: { ex: { input: string; output: string } }) {
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
    <div className="mb-4">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs font-bold text-gray-500 dark:text-gray-400">
          Input
        </span>
        <button
          onClick={copyInput}
          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
          title="Copy input"
        >
          {copiedInput ? (
            <Check className="w-3.5 h-3.5 text-green-400" />
          ) : (
            <Copy className="w-3.5 h-3.5" />
          )}
        </button>
      </div>
      <div className="bg-gray-50 dark:bg-[#0d1117] border border-gray-200 dark:border-gray-700 rounded p-3 font-mono text-xs leading-relaxed whitespace-pre-wrap break-all text-gray-800 dark:text-gray-200">
        {ex.input}
      </div>
      <div className="flex items-center justify-between mb-1.5 mt-3">
        <span className="text-xs font-bold text-gray-500 dark:text-gray-400">
          Output
        </span>
        <button
          onClick={copyOutput}
          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
          title="Copy output"
        >
          {copiedOutput ? (
            <Check className="w-3.5 h-3.5 text-green-400" />
          ) : (
            <Copy className="w-3.5 h-3.5" />
          )}
        </button>
      </div>
      <div className="bg-gray-50 dark:bg-[#0d1117] border border-gray-200 dark:border-gray-700 rounded p-3 font-mono text-xs leading-relaxed whitespace-pre-wrap break-all text-gray-800 dark:text-gray-200">
        {ex.output}
      </div>
    </div>
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
    beginner: "text-emerald-400 border-emerald-500/30 bg-emerald-500/10",
    intermediate: "text-blue-400 border-blue-500/30 bg-blue-500/10",
    advanced: "text-orange-400 border-orange-500/30 bg-orange-500/10",
    expert: "text-red-400 border-red-500/30 bg-red-500/10",
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
  let color = "text-emerald-400";
  if (rating < 1100) color = "text-emerald-400";
  else if (rating < 1600) color = "text-blue-400";
  else if (rating < 2100) color = "text-orange-400";
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
  const [leftTab, setLeftTab] = useState<"description" | "editorial">("description");
  const [solved, setSolved] = useState(initialSolved);
  const [verified, setVerified] = useState(initialVerified);
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState("");
  const [testCasesCopied, setTestCasesCopied] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [code, setCode] = useState(DEFAULT_CODE);

  // Resizable panels
  const [leftWidth, setLeftWidth] = useState(50);
  const isDraggingVertical = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const startX = useRef(0);
  const startLeftWidth = useRef(0);

  const onVerticalMouseDown = useCallback((e: React.MouseEvent) => {
    isDraggingVertical.current = true;
    startX.current = e.clientX;
    startLeftWidth.current = leftWidth;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    const onMouseMove = (e: MouseEvent) => {
      if (!isDraggingVertical.current || !containerRef.current) return;
      const containerWidth = containerRef.current.offsetWidth;
      const delta = ((e.clientX - startX.current) / containerWidth) * 100;
      const newWidth = Math.max(25, Math.min(75, startLeftWidth.current + delta));
      setLeftWidth(newWidth);
    };

    const onMouseUp = () => {
      isDraggingVertical.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  }, [leftWidth]);

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

  // Silently check for an existing Codeforces solve in the background, without
  // blocking initial page render on that external API call. This mirrors the
  // explicit Verify button — it just also fires automatically, once, on load.
  const autoVerifyAttempted = useRef(false);
  useEffect(() => {
    if (!session || solved || autoVerifyAttempted.current) return;
    autoVerifyAttempted.current = true;
    fetch("/api/progress/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dailyProblemId: daily.id }),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) {
          setSolved(true);
          setVerified(true);
        }
      })
      .catch(() => {});
  }, [session, solved, daily.id]);

  // Keyboard shortcut for submit
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        const btn = document.querySelector("[data-submit-btn]") as HTMLButtonElement;
        if (btn) btn.click();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <div
      ref={containerRef}
      className="flex flex-col"
      style={{ height: "calc(100vh - 56px)" }}
    >
      {/* Top bar: back link + problem meta */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 flex-shrink-0">
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-300 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="hidden sm:inline">Back</span>
        </Link>
        <div className="h-4 w-px bg-gray-200 dark:bg-gray-800" />
        <TierBadge tier={daily.tier} />
        <RatingBadge rating={daily.problem.rating} />
        <h1 className="text-sm font-semibold truncate">{daily.problem.name}</h1>
        {solved && verified && (
          <span className="inline-flex items-center gap-1 text-xs text-green-500 dark:text-green-400">
            <ShieldCheck className="w-3.5 h-3.5" />
            Verified
          </span>
        )}
        {solved && !verified && (
          <span className="inline-flex items-center gap-1 text-xs text-yellow-500 dark:text-yellow-400">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Solved
          </span>
        )}
        <div className="ml-auto flex items-center gap-2">
          <a
            href={daily.problem.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-medium transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Codeforces
          </a>
          {daily.problem.testCases && daily.problem.testCases.length > 0 && (
            <button
              onClick={handleCopyTestCases}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs font-medium transition-colors"
            >
              {testCasesCopied ? (
                <Check className="w-3.5 h-3.5 text-green-400" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
              {testCasesCopied ? "Copied!" : "Copy Tests"}
            </button>
          )}
          {session && !solved && (
            <button
              onClick={handleVerify}
              disabled={verifying}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-green-600/20 border border-green-500/30 hover:bg-green-600/30 text-green-400 text-xs font-medium transition-colors disabled:opacity-50"
            >
              {verifying ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <ShieldCheck className="w-3.5 h-3.5" />
              )}
              Verify
            </button>
          )}
          <button
            onClick={() => setReportOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-gray-400 dark:text-gray-500 hover:text-red-400 dark:hover:text-red-400 text-xs transition-colors"
            title="Report an issue"
          >
            <Flag className="w-3.5 h-3.5" />
          </button>
          <ReportModal
            open={reportOpen}
            onClose={() => setReportOpen(false)}
            preselectedProblemId={daily.id}
          />
        </div>
      </div>

      {verifyError && (
        <div className="px-4 py-2 bg-red-500/10 border-b border-red-500/20 text-red-400 text-sm flex-shrink-0">
          {verifyError}
        </div>
      )}

      {/* Main split view */}
      <div className="flex flex-1 min-h-0">
        {/* LEFT PANEL: Tabs (Description | Editorial) + Content */}
        <div
          className="flex flex-col overflow-hidden border-r border-gray-200 dark:border-gray-800"
          style={{ width: `${leftWidth}%` }}
        >
          {/* Left panel tabs */}
          <div className="flex border-b border-gray-200 dark:border-gray-800 flex-shrink-0">
            <button
              onClick={() => setLeftTab("description")}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-medium transition-colors ${
                leftTab === "description"
                  ? "text-cyan-600 dark:text-cyan-400 border-b-2 border-cyan-500 bg-cyan-50 dark:bg-gray-800/30"
                  : "text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/20"
              }`}
            >
              <Code className="w-3.5 h-3.5" />
              Description
            </button>
            <button
              onClick={() => { setLeftTab("editorial"); setShowAnswer(false); }}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-medium transition-colors ${
                leftTab === "editorial"
                  ? "text-cyan-600 dark:text-cyan-400 border-b-2 border-cyan-500 bg-cyan-50 dark:bg-gray-800/30"
                  : "text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/20"
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              Editorial
            </button>
          </div>

          {/* Left panel content */}
          <div className="flex-1 overflow-y-auto px-6 py-5">
            {leftTab === "description" && daily.statement && (
              <>
                <a
                  href={daily.problem.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 mb-4 rounded-md bg-cyan-600/10 border border-cyan-500/20 hover:bg-cyan-600/20 text-cyan-400 text-xs font-medium transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  View on Codeforces
                </a>

                <div className="flex items-center gap-4 mb-5 text-xs text-gray-400 dark:text-gray-500">
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
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                      Input
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {daily.statement.inputSpec}
                    </p>
                  </div>
                )}

                {daily.statement.outputSpec && (
                  <div className="mt-4">
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                      Output
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {daily.statement.outputSpec}
                    </p>
                  </div>
                )}

                {daily.statement.examples.length > 0 && (
                  <div className="mt-6">
                    <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-3">
                      Examples
                    </h3>
                    {daily.statement.examples.map((ex, i) => (
                      <ExampleBlock key={i} ex={ex} />
                    ))}
                  </div>
                )}

                {daily.statement.note && (
                  <div className="mt-6 p-4 rounded-lg bg-gray-50 dark:bg-gray-800/30 border border-gray-200 dark:border-gray-800">
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                      Note
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-line">
                      {daily.statement.note}
                    </p>
                  </div>
                )}

                <div className="flex flex-wrap gap-2 mt-6">
                  {daily.problem.tags.map((tag) => (
                    <span
                      key={tag}
                      className="text-xs px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400"
                    >
                      {tag}
                    </span>
                  ))}
                </div>

                <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-800">
                  <Discussion dailyProblemId={daily.id} />
                </div>
              </>
            )}

            {leftTab === "editorial" && (
              <>
                <button
                  onClick={() => setShowAnswer(!showAnswer)}
                  className="w-full flex items-center justify-between px-4 py-3 mb-4 rounded-lg border border-gray-200 dark:border-gray-800 text-left hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    {showAnswer ? (
                      <EyeOff className="w-4 h-4 text-gray-400" />
                    ) : (
                      <Eye className="w-4 h-4 text-cyan-500 dark:text-cyan-400" />
                    )}
                    <span className="text-sm font-medium">
                      {showAnswer ? "Hide Editorial" : "Show Editorial"}
                    </span>
                  </div>
                  <span className="text-xs text-gray-400 dark:text-gray-500">
                    {showAnswer ? "Click to hide" : "Click to reveal"}
                  </span>
                </button>

                {showAnswer && daily.editorial && (
                  <div>
                    <div className="prose prose-sm prose-invert max-w-none">
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
                        className="inline-flex items-center gap-1.5 text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        View on Codeforces
                      </a>
                      <button
                        onClick={() => setReportOpen(true)}
                        className="inline-flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500 hover:text-red-400 dark:hover:text-red-400 transition-colors"
                      >
                        <Flag className="w-3 h-3" />
                        Report issue
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* VERTICAL DIVIDER */}
        <div
          onMouseDown={onVerticalMouseDown}
          className="w-1.5 flex-shrink-0 bg-gray-200 dark:bg-gray-800 hover:bg-cyan-500/30 cursor-col-resize transition-colors flex items-center justify-center group"
        >
          <GripVertical className="w-3 h-3 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>

        {/* RIGHT PANEL: Editor + Bottom Tabs (Submit | Discussion) */}
        <div
          data-right-panel
          className="flex flex-col overflow-hidden"
          style={{ width: `${100 - leftWidth}%` }}
        >
          {/* Code Editor */}
          <div className="flex-1 min-h-0 overflow-hidden">
            <CppEditor value={code} onChange={(v) => setCode(v || "")} />
          </div>

          {/* Submit bar */}
          <div
            className="flex items-center gap-3 px-4 py-2 border-t border-gray-200 dark:border-gray-800 flex-shrink-0"
          >
            <SubmitClient
              problemId={daily.problem.id}
              code={code}
              compact
            />
          </div>
        </div>
      </div>
    </div>
  );
}
