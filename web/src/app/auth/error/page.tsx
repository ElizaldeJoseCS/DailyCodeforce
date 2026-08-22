"use client";

import Link from "next/link";
import { Code2 } from "lucide-react";

export default function AuthErrorPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="text-center">
        <Code2 className="w-12 h-12 text-cyan-400 mx-auto mb-4" />
        <h1 className="text-2xl font-bold mb-2">Authentication Error</h1>
        <p className="text-gray-400 mb-6">Something went wrong during authentication.</p>
        <Link
          href="/auth/signin"
          className="px-6 py-2.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 font-medium transition-colors"
        >
          Try again
        </Link>
      </div>
    </div>
  );
}
