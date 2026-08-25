"use client";

import { useState } from "react";
import { Flag } from "lucide-react";
import ReportModal from "./ReportModal";

export default function ReportButton({ preselectedProblemId }: { preselectedProblemId?: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-40 flex items-center gap-2 px-4 py-2.5 bg-gray-800 hover:bg-gray-700 border border-gray-600 hover:border-gray-500 text-gray-300 hover:text-white rounded-full shadow-lg transition-all group"
        title="Report an issue"
      >
        <Flag className="w-4 h-4 text-red-400 group-hover:text-red-300" />
        <span className="text-sm font-medium hidden sm:inline">Report</span>
      </button>
      <ReportModal open={open} onClose={() => setOpen(false)} preselectedProblemId={preselectedProblemId} />
    </>
  );
}
