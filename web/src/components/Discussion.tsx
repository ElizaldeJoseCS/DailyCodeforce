"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { MessageSquare, ChevronUp, Reply, Send, Loader2, CornerDownRight } from "lucide-react";

interface User {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  discordAvatar: string | null;
}

interface CommentData {
  id: string;
  content: string;
  upvotes: number;
  createdAt: string;
  user: User;
  userVote: boolean;
  replies: CommentData[];
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

function CommentItem({
  comment,
  onVote,
  onReply,
  depth,
}: {
  comment: CommentData;
  onVote: (id: string) => void;
  onReply: (parentId: string, content: string) => void;
  depth: number;
}) {
  const { data: session } = useSession();
  const [showReplyBox, setShowReplyBox] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const user = comment.user;
  const avatar = user.avatarUrl || user.discordAvatar;

  const handleReply = async () => {
    if (!replyText.trim()) return;
    setSubmitting(true);
    await onReply(comment.id, replyText.trim());
    setReplyText("");
    setShowReplyBox(false);
    setSubmitting(false);
  };

  return (
    <div className={depth > 0 ? "ml-6 pl-4 border-l border-gray-800" : ""}>
      <div className="py-3">
        <div className="flex items-center gap-2 mb-1.5">
          {avatar ? (
            <img src={avatar} alt="" className="w-6 h-6 rounded-full" />
          ) : (
            <div className="w-6 h-6 rounded-full bg-gray-700 flex items-center justify-center text-[10px] font-bold text-gray-300">
              {(user.displayName || user.username)[0].toUpperCase()}
            </div>
          )}
          <span className="text-sm font-medium text-gray-200">
            {user.displayName || user.username}
          </span>
          <span className="text-xs text-gray-500">{timeAgo(comment.createdAt)}</span>
        </div>

        <p className="text-sm text-gray-300 whitespace-pre-wrap leading-relaxed ml-8">
          {comment.content}
        </p>

        <div className="flex items-center gap-4 ml-8 mt-2">
          <button
            onClick={() => session && onVote(comment.id)}
            className={`flex items-center gap-1 text-xs transition-colors ${
              comment.userVote
                ? "text-cyan-400"
                : "text-gray-500 hover:text-cyan-400"
            }`}
          >
            <ChevronUp className="w-3.5 h-3.5" />
            <span>{comment.upvotes}</span>
          </button>
          {session && depth === 0 && (
            <button
              onClick={() => setShowReplyBox(!showReplyBox)}
              className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-300 transition-colors"
            >
              <Reply className="w-3.5 h-3.5" />
              Reply
            </button>
          )}
        </div>

        {showReplyBox && (
          <div className="ml-8 mt-2 flex gap-2">
            <input
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleReply()}
              placeholder="Write a reply..."
              autoFocus
              className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-cyan-500/50"
            />
            <button
              onClick={handleReply}
              disabled={submitting || !replyText.trim()}
              className="px-3 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:bg-gray-700 text-white rounded-lg text-sm transition-colors"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </div>
        )}
      </div>

      {comment.replies?.map((reply) => (
        <CommentItem
          key={reply.id}
          comment={{ ...reply, replies: [] }}
          onVote={onVote}
          onReply={onReply}
          depth={depth + 1}
        />
      ))}
    </div>
  );
}

export default function Discussion({ dailyProblemId }: { dailyProblemId: string }) {
  const { data: session } = useSession();
  const [comments, setComments] = useState<CommentData[]>([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchComments = useCallback(async () => {
    try {
      const res = await fetch(`/api/comments?dailyProblemId=${dailyProblemId}`);
      const data = await res.json();
      setComments(data.comments || []);
    } catch {}
    setLoading(false);
  }, [dailyProblemId]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  const handlePost = async () => {
    if (!newComment.trim() || submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dailyProblemId, content: newComment.trim() }),
      });
      if (res.ok) {
        const comment = await res.json();
        setComments((prev) => [comment, ...prev]);
        setNewComment("");
      }
    } catch {}
    setSubmitting(false);
  };

  const handleVote = async (commentId: string) => {
    try {
      const res = await fetch("/api/comments/vote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commentId }),
      });
      if (!res.ok) return;
      const data = await res.json();
      setComments((prev) =>
        prev.map((c) => {
          if (c.id === commentId) {
            return { ...c, upvotes: c.upvotes + (data.voted ? 1 : -1), userVote: data.voted };
          }
          return {
            ...c,
            replies: c.replies.map((r) =>
              r.id === commentId
                ? { ...r, upvotes: r.upvotes + (data.voted ? 1 : -1), userVote: data.voted }
                : r
            ),
          };
        })
      );
    } catch {}
  };

  const handleReply = async (parentId: string, content: string) => {
    try {
      const res = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dailyProblemId, content, parentId }),
      });
      if (res.ok) {
        const reply = await res.json();
        setComments((prev) =>
          prev.map((c) =>
            c.id === parentId ? { ...c, replies: [...c.replies, reply] } : c
          )
        );
      }
    } catch {}
  };

  return (
    <div className="p-6">
      <div className="flex items-center gap-2 mb-4">
        <MessageSquare className="w-5 h-5 text-gray-400" />
        <h3 className="text-lg font-semibold">Discussion</h3>
        <span className="text-sm text-gray-500">({comments.length})</span>
      </div>

      {session ? (
        <div className="flex gap-3 mb-6">
          <textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            rows={3}
            placeholder="Share your thoughts, approach, or ask a question..."
            className="flex-1 px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-cyan-500/50 resize-none"
          />
          <button
            onClick={handlePost}
            disabled={submitting || !newComment.trim()}
            className="self-end px-4 py-2.5 bg-cyan-600 hover:bg-cyan-500 disabled:bg-gray-700 disabled:text-gray-500 text-white text-sm font-medium rounded-lg transition-colors"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
      ) : (
        <div className="mb-6 p-4 rounded-lg bg-gray-800/50 border border-gray-700 text-sm text-gray-400 text-center">
          <a href="/auth/signin" className="text-cyan-400 hover:text-cyan-300 underline">Sign in</a> to join the discussion.
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      ) : comments.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <CornerDownRight className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">No comments yet. Be the first to share your approach!</p>
        </div>
      ) : (
        <div className="divide-y divide-gray-800">
          {comments.map((c) => (
            <CommentItem key={c.id} comment={c} onVote={handleVote} onReply={handleReply} depth={0} />
          ))}
        </div>
      )}
    </div>
  );
}
