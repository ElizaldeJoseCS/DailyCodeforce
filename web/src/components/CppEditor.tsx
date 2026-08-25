'use client';

import { useState, useRef, useCallback } from 'react';
import Editor from '@monaco-editor/react';
import { GripVertical } from 'lucide-react';

const DEFAULT_CODE = `#include <bits/stdc++.h>
using namespace std;

#define int long long
#define pb push_back
#define all(x) (x).begin(), (x).end()
#define sz(x) (int)(x).size()
#define MOD 1000000007

typedef vector<int> vi;
typedef pair<int, int> pii;
typedef vector<pii> vpii;

void solve() {
    // Your solution here
}

signed main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);

    int t = 1;
    // cin >> t;  // uncomment for multi-test-case problems
    while (t--) {
        solve();
    }

    return 0;
}`;

const MIN_HEIGHT = 200;
const MAX_HEIGHT = 800;

export default function CppEditor({
  value,
  onChange,
}: {
  value?: string;
  onChange?: (value: string | undefined) => void;
}) {
  const [height, setHeight] = useState(400);
  const dragging = useRef(false);
  const startY = useRef(0);
  const startHeight = useRef(0);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    dragging.current = true;
    startY.current = e.clientY;
    startHeight.current = height;
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';

    const onMouseMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      const delta = e.clientY - startY.current;
      const newHeight = Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, startHeight.current + delta));
      setHeight(newHeight);
    };

    const onMouseUp = () => {
      dragging.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, [height]);

  return (
    <div className="rounded-lg overflow-hidden border border-gray-700">
      <Editor
        height={`${height}px`}
        language="cpp"
        theme="vs-dark"
        value={value}
        onChange={onChange}
        defaultValue={DEFAULT_CODE}
        options={{
          minimap: { enabled: false },
          fontSize: 14,
          automaticLayout: true,
          scrollBeyondLastLine: false,
          wordWrap: 'on',
          tabSize: 4,
          renderLineHighlight: 'gutter',
          bracketPairColorization: { enabled: true },
          padding: { top: 8, bottom: 8 },
        }}
        loading={<div style={{ height: `${height}px` }} className="bg-gray-900 flex items-center justify-center text-gray-500">Loading editor...</div>}
      />
      {/* Drag handle */}
      <div
        onMouseDown={onMouseDown}
        className="flex items-center justify-center h-6 bg-gray-800 hover:bg-gray-700 cursor-row-resize border-t border-gray-700 select-none transition-colors"
      >
        <GripVertical className="w-4 h-4 text-gray-500" />
        <span className="text-[10px] text-gray-500 ml-1">{height}px</span>
      </div>
    </div>
  );
}
