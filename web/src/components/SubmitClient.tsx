'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';

const CppEditor = dynamic(() => import('./CppEditor'), {
  ssr: false,
  loading: () => <div className="h-[400px] bg-gray-900 rounded-lg flex items-center justify-center text-gray-500">Loading editor...</div>,
});

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

export default function SubmitClient({ problemId }: { problemId: string }) {
  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<SubmissionResult | null>(null);

  const handleSubmit = async () => {
    if (!code.trim()) return;
    setSubmitting(true);
    setResult(null);
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

  return (
    <div className="space-y-4">
      <CppEditor value={code} onChange={(v) => setCode(v || '')} />

      <div className="flex items-center gap-4">
        <button
          onClick={handleSubmit}
          disabled={submitting || !code.trim()}
          className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-lg font-medium transition-colors"
        >
          {submitting ? 'Judging...' : 'Submit'}
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
        <div className="p-4 bg-red-900/30 border border-red-800 rounded-lg text-red-300">
          {result.error}
        </div>
      )}

      {result?.compileOutput && (
        <div className="p-4 bg-purple-900/30 border border-purple-800 rounded-lg">
          <div className="text-sm font-medium text-purple-400 mb-2">Compilation Error</div>
          <pre className="text-sm text-purple-200 whitespace-pre-wrap font-mono">{result.compileOutput}</pre>
        </div>
      )}

      {result?.results && result.results.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-gray-400">Test Results</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="text-left py-2 px-3 text-gray-500">#</th>
                  <th className="text-left py-2 px-3 text-gray-500">Verdict</th>
                  <th className="text-left py-2 px-3 text-gray-500">Input</th>
                  <th className="text-left py-2 px-3 text-gray-500">Expected</th>
                  <th className="text-left py-2 px-3 text-gray-500">Your Output</th>
                </tr>
              </thead>
              <tbody>
                {result.results.map((r) => (
                  <tr key={r.test} className="border-b border-gray-800/50">
                    <td className="py-2 px-3 text-gray-500">{r.test}</td>
                    <td className={`py-2 px-3 font-medium ${VERDICT_COLORS[r.verdict] || 'text-gray-400'}`}>
                      {r.verdict === 'Accepted' ? '✓' : '✗'} {r.verdict}
                    </td>
                    <td className="py-2 px-3 text-gray-300 font-mono text-xs max-w-[200px] truncate">{r.input}</td>
                    <td className="py-2 px-3 text-gray-300 font-mono text-xs max-w-[200px] truncate">{r.expected}</td>
                    <td className="py-2 px-3 text-gray-300 font-mono text-xs max-w-[200px] truncate">{r.actual}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
