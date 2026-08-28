'use client';

import Editor from '@monaco-editor/react';
import { DEFAULT_CODE } from '@/lib/defaultCppCode';

export default function CppEditor({
  value,
  onChange,
}: {
  value?: string;
  onChange?: (value: string | undefined) => void;
}) {
  return (
    <div className="h-full w-full overflow-hidden">
      <Editor
        height="100%"
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
        loading={<div className="h-full w-full bg-[#0d1117] flex items-center justify-center text-gray-500">Loading editor...</div>}
      />
    </div>
  );
}
