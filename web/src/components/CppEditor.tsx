'use client';

import Editor from '@monaco-editor/react';

const DEFAULT_CODE = `#include <iostream>
using namespace std;

int main() {
    // Your solution here
    return 0;
}`;

export default function CppEditor({
  value,
  onChange,
}: {
  value?: string;
  onChange?: (value: string | undefined) => void;
}) {
  return (
    <Editor
      height="400px"
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
      }}
      loading={<div className="h-[400px] bg-gray-900 rounded-lg flex items-center justify-center text-gray-500">Loading editor...</div>}
    />
  );
}
