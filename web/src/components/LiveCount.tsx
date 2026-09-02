"use client";

import { usePresence } from "@/lib/usePresence";
import { Users } from "lucide-react";

export default function LiveCount() {
  const count = usePresence();

  return (
    <div className="fixed bottom-6 left-6 z-40 flex items-center gap-2 px-3 py-1.5 bg-gray-800/90 border border-cyan-900 rounded-full text-xs text-gray-400 backdrop-blur-sm">
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
      </span>
      <Users className="w-3.5 h-3.5" />
      <span>{count} online</span>
    </div>
  );
}
