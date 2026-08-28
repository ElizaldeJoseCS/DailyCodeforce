"use client";

import { useState, useRef } from "react";
import {
  Upload,
  Globe,
  Save,
  Loader2,
  ChevronDown,
  ChevronUp,
  Lock,
} from "lucide-react";
import { getAllBadgeDefs, isBadgeEarned, type BadgeProgress } from "@/lib/badges";

interface SocialLinks {
  github?: string;
  twitter?: string;
  website?: string;
}

interface ProfileLayout {
  showStats: boolean;
  showSolves: boolean;
  bioPosition: "top" | "side";
}

interface ProfileData {
  displayName: string;
  bio: string;
  avatarUrl: string | null;
  bannerUrl: string | null;
  backgroundColor: string;
  accentColor: string;
  socialLinks: SocialLinks;
  profileLayout: ProfileLayout;
  avatarFrame: string;
  titleBadge: string | null;
}

const PRESET_COLORS = [
  "#030712", "#1e1b4b", "#172554", "#134e4a",
  "#1a2e05", "#422006", "#4a1d1d", "#2d1b3d",
  "#0f172a", "#18181b",
];

const ACCENT_COLORS = [
  "#22d3ee", "#3b82f6", "#8b5cf6", "#ec4899",
  "#ef4444", "#f97316", "#eab308", "#22c55e",
  "#14b8a6", "#f43f5e",
];

function Section({
  expanded,
  onToggle,
  title,
  children,
}: {
  expanded: boolean;
  onToggle: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border border-gray-800 rounded-xl overflow-hidden mb-4">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-4 hover:bg-gray-800/50 transition-colors text-left"
      >
        <span className="font-medium">{title}</span>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-gray-500" />
        ) : (
          <ChevronDown className="w-4 h-4 text-gray-500" />
        )}
      </button>
      {expanded && <div className="px-4 pb-4 space-y-4">{children}</div>}
    </div>
  );
}

export default function ProfileEditor({
  profile,
  badgeProgress,
  isAdmin,
  onSave,
}: {
  profile: ProfileData;
  badgeProgress: BadgeProgress;
  isAdmin?: boolean;
  onSave: (data: Record<string, unknown>) => Promise<void>;
}) {
  const [form, setForm] = useState(profile);
  const [saving, setSaving] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(profile.avatarUrl);
  const [bannerPreview, setBannerPreview] = useState<string | null>(profile.bannerUrl);
  const [uploading, setUploading] = useState<"avatar" | "banner" | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    appearance: true,
    cosmetics: true,
    social: true,
    layout: false,
  });
  const avatarRef = useRef<HTMLInputElement>(null);
  const bannerRef = useRef<HTMLInputElement>(null);

  const toggle = (section: string) =>
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));

  const handleUpload = async (file: File, type: "avatar" | "banner") => {
    setUploading(type);
    setError("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("type", type);

      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Upload failed");
        return;
      }

      const cacheBust = `?t=${Date.now()}`;
      if (type === "avatar") {
        setAvatarPreview(data.url + cacheBust);
        setForm((f) => ({ ...f, avatarUrl: data.url }));
      } else {
        setBannerPreview(data.url + cacheBust);
        setForm((f) => ({ ...f, bannerUrl: data.url }));
      }
    } catch {
      setError("Upload failed. Try again.");
    } finally {
      setUploading(null);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: "avatar" | "banner") => {
    const file = e.target.files?.[0];
    if (file) handleUpload(file, type);
  };

  const handleSave = async () => {
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      await onSave({
        displayName: form.displayName || undefined,
        bio: form.bio || undefined,
        backgroundColor: form.backgroundColor,
        accentColor: form.accentColor,
        socialLinks: form.socialLinks,
        profileLayout: form.profileLayout,
        avatarFrame: form.avatarFrame,
        titleBadge: form.titleBadge,
      });
      setSuccess("Profile updated!");
      setTimeout(() => setSuccess(""), 3000);
    } catch {
      setError("Failed to save changes");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {error && (
        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          {error}
        </div>
      )}
      {success && (
        <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400 text-sm">
          {success}
        </div>
      )}

      {/* Banner */}
      <div className="relative">
        <div
          className="w-full h-48 rounded-xl overflow-hidden border border-gray-800"
          style={{ backgroundColor: form.backgroundColor }}
        >
          {bannerPreview ? (
            <img src={bannerPreview} alt="Banner" className="w-full h-full object-cover" />
          ) : (
            <div
              className="w-full h-full"
              style={{
                background: `linear-gradient(135deg, ${form.accentColor}22, ${form.accentColor}08)`,
              }}
            />
          )}
        </div>
        <input
          ref={bannerRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => handleFileChange(e, "banner")}
        />
        <button
          onClick={() => bannerRef.current?.click()}
          disabled={uploading === "banner"}
          className="absolute bottom-3 right-3 flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-900/80 backdrop-blur-sm border border-gray-700 hover:bg-gray-800 text-sm transition-colors"
        >
          {uploading === "banner" ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Upload className="w-4 h-4" />
          )}
          {uploading === "banner" ? "Uploading..." : "Banner"}
        </button>
      </div>

      {/* Avatar */}
      <div className="flex items-end gap-6 -mt-16 relative z-10 px-4">
        <div className="relative group">
          <div
            className="w-28 h-28 rounded-full border-4 overflow-hidden"
            style={{ borderColor: form.backgroundColor, backgroundColor: "#1f2937" }}
          >
            {avatarPreview ? (
              <img src={avatarPreview} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-3xl font-bold text-gray-500">
                {(form.displayName || "?")[0].toUpperCase()}
              </div>
            )}
          </div>
          <input
            ref={avatarRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => handleFileChange(e, "avatar")}
          />
          <button
            onClick={() => avatarRef.current?.click()}
            disabled={uploading === "avatar"}
            className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
          >
            {uploading === "avatar" ? (
              <Loader2 className="w-6 h-6 animate-spin text-white" />
            ) : (
              <Upload className="w-6 h-6 text-white" />
            )}
          </button>
        </div>
      </div>

      {/* Appearance */}
      <Section expanded={expandedSections.appearance} onToggle={() => toggle("appearance")} title="Appearance">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Display Name</label>
          <input
            type="text"
            value={form.displayName}
            onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))}
            className="w-full px-4 py-2.5 rounded-lg bg-gray-800 border border-gray-700 text-gray-100 focus:outline-none focus:border-cyan-500 transition-colors"
            placeholder="Your display name"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Bio</label>
          <textarea
            value={form.bio}
            onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
            className="w-full px-4 py-2.5 rounded-lg bg-gray-800 border border-gray-700 text-gray-100 focus:outline-none focus:border-cyan-500 transition-colors h-24 resize-none"
            placeholder="Tell us about yourself..."
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Background Color</label>
          <div className="flex flex-wrap gap-2">
            {PRESET_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setForm((f) => ({ ...f, backgroundColor: c }))}
                className={`w-8 h-8 rounded-lg border-2 transition-colors ${
                  form.backgroundColor === c ? "border-cyan-400 scale-110" : "border-gray-700 hover:border-gray-500"
                }`}
                style={{ backgroundColor: c }}
              />
            ))}
            <div className="relative">
              <input
                type="color"
                value={form.backgroundColor}
                onChange={(e) => setForm((f) => ({ ...f, backgroundColor: e.target.value }))}
                className="w-8 h-8 rounded-lg border-2 border-gray-700 cursor-pointer"
              />
            </div>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Accent Color</label>
          <div className="flex flex-wrap gap-2">
            {ACCENT_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setForm((f) => ({ ...f, accentColor: c }))}
                className={`w-8 h-8 rounded-lg border-2 transition-colors ${
                  form.accentColor === c ? "border-white scale-110" : "border-gray-700 hover:border-gray-500"
                }`}
                style={{ backgroundColor: c }}
              />
            ))}
            <div className="relative">
              <input
                type="color"
                value={form.accentColor}
                onChange={(e) => setForm((f) => ({ ...f, accentColor: e.target.value }))}
                className="w-8 h-8 rounded-lg border-2 border-gray-700 cursor-pointer"
              />
            </div>
          </div>
        </div>
      </Section>

      {/* Cosmetics */}
      <Section expanded={expandedSections.cosmetics} onToggle={() => toggle("cosmetics")} title="Cosmetics">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Avatar Frame</label>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => setForm((f) => ({ ...f, avatarFrame: "none" }))}
              className={`flex flex-col items-center gap-1 ${form.avatarFrame === "none" ? "" : "opacity-70 hover:opacity-100"}`}
            >
              <div
                className={`w-12 h-12 rounded-full bg-gray-700 border-2 ${
                  form.avatarFrame === "none" ? "border-cyan-400" : "border-transparent"
                }`}
              />
              <span className="text-[10px] text-gray-500">None</span>
            </button>
            {getAllBadgeDefs()
              .filter((b) => b.unlocks?.frame)
              .map((b) => {
                const frame = b.unlocks!.frame!;
                return (
                  <button
                    key={b.id}
                    onClick={() => setForm((f) => ({ ...f, avatarFrame: b.id }))}
                    title={frame.label}
                    className={`flex flex-col items-center gap-1 ${
                      form.avatarFrame === b.id ? "" : "opacity-70 hover:opacity-100"
                    }`}
                  >
                    <div className="relative">
                      <div
                        className={`w-12 h-12 rounded-full bg-gray-700 ${frame.class} ${
                          form.avatarFrame === b.id ? "outline outline-2 outline-cyan-400 outline-offset-2" : ""
                        }`}
                      />
                      <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-gray-900 border border-gray-700 flex items-center justify-center text-[10px] leading-none">
                        {frame.icon}
                      </span>
                    </div>
                    <span className="text-[10px] text-gray-500">{frame.label}</span>
                  </button>
                );
              })}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Badge Name Colors</label>
          <div className="flex flex-wrap gap-2">
            {getAllBadgeDefs()
              .filter((b) => b.unlocks?.nameColor)
              .map((b) => {
                const color = b.unlocks!.nameColor!;
                return (
                  <button
                    key={b.id}
                    onClick={() => setForm((f) => ({ ...f, accentColor: color }))}
                    title={`${b.name} — ${color}`}
                    className={`w-8 h-8 rounded-lg border-2 transition-colors ${
                      form.accentColor === color ? "border-white scale-110" : "border-gray-700 hover:border-gray-500"
                    }`}
                    style={{ backgroundColor: color }}
                  />
                );
              })}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Profile Title</label>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setForm((f) => ({ ...f, titleBadge: null }))}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                !form.titleBadge ? "bg-cyan-600 border-cyan-500 text-white" : "border-gray-700 text-gray-400 hover:bg-gray-800"
              }`}
            >
              None
            </button>
            {getAllBadgeDefs()
              .filter((b) => b.unlocks?.title)
              .map((b) => {
                const earned = isAdmin || isBadgeEarned(b.id, badgeProgress);
                return (
                  <button
                    key={b.id}
                    disabled={!earned}
                    onClick={() => earned && setForm((f) => ({ ...f, titleBadge: b.id }))}
                    title={earned ? b.name : `Locked — ${b.description}`}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                      !earned
                        ? "border-gray-800 text-gray-600 cursor-not-allowed"
                        : form.titleBadge === b.id
                          ? "bg-cyan-600 border-cyan-500 text-white"
                          : "border-gray-700 text-gray-400 hover:bg-gray-800"
                    }`}
                  >
                    {!earned && <Lock className="w-3 h-3" />}
                    {b.unlocks!.title}
                  </button>
                );
              })}
          </div>
        </div>
      </Section>

      {/* Social Links */}
      <Section expanded={expandedSections.social} onToggle={() => toggle("social")} title="Social Links">
        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-gray-300 mb-2">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
            GitHub
          </label>
          <input
            type="text"
            value={form.socialLinks.github || ""}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                socialLinks: { ...f.socialLinks, github: e.target.value || undefined },
              }))
            }
            className="w-full px-4 py-2.5 rounded-lg bg-gray-800 border border-gray-700 text-gray-100 focus:outline-none focus:border-cyan-500 transition-colors"
            placeholder="username"
          />
        </div>
        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-gray-300 mb-2">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
            Twitter / X
          </label>
          <input
            type="text"
            value={form.socialLinks.twitter || ""}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                socialLinks: { ...f.socialLinks, twitter: e.target.value || undefined },
              }))
            }
            className="w-full px-4 py-2.5 rounded-lg bg-gray-800 border border-gray-700 text-gray-100 focus:outline-none focus:border-cyan-500 transition-colors"
            placeholder="@handle"
          />
        </div>
        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-gray-300 mb-2">
            <Globe className="w-4 h-4" /> Website
          </label>
          <input
            type="text"
            value={form.socialLinks.website || ""}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                socialLinks: { ...f.socialLinks, website: e.target.value || undefined },
              }))
            }
            className="w-full px-4 py-2.5 rounded-lg bg-gray-800 border border-gray-700 text-gray-100 focus:outline-none focus:border-cyan-500 transition-colors"
            placeholder="https://..."
          />
        </div>
      </Section>

      {/* Layout */}
      <Section expanded={expandedSections.layout} onToggle={() => toggle("layout")} title="Profile Layout">
        <div className="space-y-3">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={form.profileLayout.showStats}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  profileLayout: { ...f.profileLayout, showStats: e.target.checked },
                }))
              }
              className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-cyan-500 focus:ring-cyan-500"
            />
            <span className="text-sm text-gray-300">Show stats cards (Rank, Solved, Streak)</span>
          </label>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={form.profileLayout.showSolves}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  profileLayout: { ...f.profileLayout, showSolves: e.target.checked },
                }))
              }
              className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-cyan-500 focus:ring-cyan-500"
            />
            <span className="text-sm text-gray-300">Show solved problems list</span>
          </label>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Bio Position</label>
            <div className="flex gap-3">
              {(["top", "side"] as const).map((pos) => (
                <button
                  key={pos}
                  onClick={() =>
                    setForm((f) => ({
                      ...f,
                      profileLayout: { ...f.profileLayout, bioPosition: pos },
                    }))
                  }
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    form.profileLayout.bioPosition === pos
                      ? "bg-cyan-600 text-white"
                      : "bg-gray-800 text-gray-400 hover:bg-gray-700"
                  }`}
                >
                  {pos === "top" ? "Top (full width)" : "Side (next to avatar)"}
                </button>
              ))}
            </div>
          </div>
        </div>
      </Section>

      {/* Save */}
      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full py-3 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors flex items-center justify-center gap-2"
      >
        {saving ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : (
          <Save className="w-5 h-5" />
        )}
        {saving ? "Saving..." : "Save Changes"}
      </button>
    </div>
  );
}
