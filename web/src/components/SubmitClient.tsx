'use client';

import { useState } from 'react';
import { Loader2, CheckCircle2, XCircle, ChevronDown, ChevronRight } from 'lucide-react';

interface TestResult {
  test: number;
  verdict: string;
  input: string;
  expected: string;
  actual: string;
}

interface SubmissionResult {
  verdict?: string;
  passed?: number;
  failed?: number;
  total?: number;
  results?: TestResult[];
  compileOutput?: string;
  error?: string;
}

const VERDICT_COLORS: Record<string, string> = {
  'Accepted': 'text-emerald-400',
  'Wrong Answer': 'text-red-400',
  'Time Limit Exceeded': 'text-yellow-400',
  'Runtime Error': 'text-orange-400',
  'Compilation Error': 'text-purple-400',
};

function CompileError({ output }: { output: string }) {
  const lines = output.split('\n');
  return (
    <div className="m-3 p-3 bg-purple-900/20 border border-purple-800/50 rounded-lg">
      <div className="text-xs font-medium text-purple-400 mb-2">Compilation Error</div>
      <pre className="text-xs whitespace-pre-wrap font-mono leading-relaxed">
        {lines.map((line, i) => {
          const m = line.match(/^([^:]+):(\d+):(\d+):\s*(error|warning|note):\s*(.*)$/);
          if (m) {
            const [, file, lineNum, col, severity, msg] = m;
            const sevColor = severity === 'error' ? 'text-red-400' : severity === 'warning' ? 'text-yellow-400' : 'text-gray-400';
            return (
              <div key={i}>
                <span className="text-purple-300">{file}</span>
                <span className="text-gray-500">:</span>
                <span className="text-cyan-400">{lineNum}</span>
                <span className="text-gray-500">:</span>
                <span className="text-cyan-400">{col}</span>
                <span className="text-gray-500">: </span>
                <span className={sevColor}>{severity}</span>
                <span className="text-gray-500">: </span>
                <span className="text-purple-200">{msg}</span>
              </div>
            );
          }
          if (line.match(/^\s*(in |from )/)) {
            return <div key={i} className="text-gray-500">{line}</div>;
          }
          return <div key={i} className="text-purple-200">{line || '\u00A0'}</div>;
        })}
      </pre>
    </div>
  );
}

function TestDetail({ label, content, color }: { label: string; content: string; color: string }) {
  return (
    <div className="mb-2">
      <div className={`text-[10px] font-medium ${color} mb-0.5`}>{label}</div>
      <pre className="text-[11px] text-gray-300 bg-gray-900/60 rounded p-2 font-mono whitespace-pre-wrap max-h-32 overflow-y-auto">{content || '(empty)'}</pre>
    </div>
  );
}

function TestResultRow({ r }: { r: TestResult }) {
  const [open, setOpen] = useState(false);
  const passed = r.verdict === 'Accepted';

  return (
    <div className="rounded bg-gray-800/50 overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 text-xs p-2 hover:bg-gray-800/80 transition-colors text-left"
      >
        <span className="text-gray-500 w-6">#{r.test}</span>
        {passed ? (
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
        ) : (
          <XCircle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
        )}
        <span className={`font-medium ${VERDICT_COLORS[r.verdict] || 'text-gray-400'}`}>
          {r.verdict}
        </span>
        {!passed && (
          <span className="text-gray-500 ml-auto truncate max-w-[200px]">
            got: {r.actual?.slice(0, 40) || '(empty)'}
          </span>
        )}
        <span className="text-gray-600 ml-auto flex-shrink-0">
          {open ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        </span>
      </button>
      {open && (
        <div className="px-3 pb-2 border-t border-gray-700/50 pt-2">
          <TestDetail label="Input" content={r.input} color="text-blue-400" />
          <TestDetail label="Expected" content={r.expected} color="text-emerald-400" />
          <TestDetail label="Your Output" content={r.actual} color="text-orange-400" />
        </div>
      )}
    </div>
  );
}

export default function SubmitClient({
  problemId,
  code,
  compact,
}: {
  problemId: string;
  code: string;
  compact?: boolean;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<SubmissionResult | null>(null);
  const [showDetails, setShowDetails] = useState(true);

  const handleSubmit = async () => {
    if (!code.trim()) return;
    setSubmitting(true);
    setResult(null);
    setShowDetails(true);
    try {
      const res = await fetch('/api/submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ problemId, sourceCode: code }),
      });
      const data = await res.json();
      setResult(data);
    } catch {
      setResult({ error: 'Failed to submit. Please try again.' });
    } finally {
      setSubmitting(false);
    }
  };

  if (compact) {
    const hasDetails = !!(result && (result.error || result.compileOutput || (result.results && result.results.length > 0)));
    return (
      <div className="relative flex items-center gap-3 w-full">
        <button
          data-submit-btn
          onClick={handleSubmit}
          disabled={submitting || !code.trim()}
          className="px-5 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-md text-sm font-medium transition-colors"
        >
          {submitting ? (
            <span className="flex items-center gap-1.5">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Judging...
            </span>
          ) : 'Submit'}
        </button>
        {result && result.verdict && (
          <span className={`text-sm font-bold ${VERDICT_COLORS[result.verdict] || 'text-gray-400'}`}>
            {result.verdict}
            {result.total !== undefined && (
              <span className="text-xs font-normal text-gray-400 ml-1.5">
                {result.passed}/{result.total}
              </span>
            )}
          </span>
        )}
        {result && !result.verdict && result.error && (
          <span className="text-sm font-medium text-red-400">{result.error}</span>
        )}
        {hasDetails && (
          <button
            onClick={() => setShowDetails((s) => !s)}
            className="ml-auto text-xs text-gray-400 hover:text-gray-200 underline underline-offset-2"
          >
            {showDetails ? 'Hide details' : 'Show details'}
          </button>
        )}
        {hasDetails && showDetails && (
          <div className="absolute bottom-full left-0 right-0 mb-2 max-h-96 overflow-y-auto bg-gray-900 border border-gray-700 rounded-lg shadow-2xl z-20">
            {result?.error && (
              <div className="m-3 p-3 bg-red-900/30 border border-red-800 rounded-lg text-red-300 text-sm">
                {result.error}
              </div>
            )}
            {result?.compileOutput && <CompileError output={result.compileOutput} />}
            {result?.results && result.results.length > 0 && (
              <div className="p-3">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-medium text-gray-400">Test Results</span>
                  <span className="text-xs text-emerald-400">{result.passed}/{result.total} passed</span>
                </div>
                <div className="space-y-1">
                  {result.results.map((r) => (
                    <TestResultRow key={r.test} r={r} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 p-3 border-b border-gray-800">
        <button
          onClick={handleSubmit}
          disabled={submitting || !code.trim()}
          className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-lg text-sm font-medium transition-colors"
        >
          {submitting ? (
            <span className="flex items-center gap-1.5">
              <Loader2 className="w-4 h-4 animate-spin" />
              Judging...
            </span>
          ) : 'Submit'}
        </button>
        {result && result.verdict && (
          <div className={`text-lg font-bold ${VERDICT_COLORS[result.verdict] || 'text-gray-400'}`}>
            {result.verdict}
            {result.total !== undefined && (
              <span className="text-sm font-normal text-gray-400 ml-2">
                {result.passed}/{result.total} passed
              </span>
            )}
          </div>
        )}
      </div>

      {result?.error && (
        <div className="m-3 p-3 bg-red-900/30 border border-red-800 rounded-lg text-red-300 text-sm">
          {result.error}
        </div>
      )}

      {result?.compileOutput && <CompileError output={result.compileOutput} />}

      {result?.results && result.results.length > 0 && (
        <div className="flex-1 overflow-y-auto p-3">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-medium text-gray-400">Test Results</span>
            <span className="text-xs text-emerald-400">{result.passed}/{result.total} passed</span>
          </div>
          <div className="space-y-1">
            {result.results.map((r) => (
              <TestResultRow key={r.test} r={r} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
