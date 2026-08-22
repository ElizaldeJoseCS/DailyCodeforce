"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { ArrowLeft } from "lucide-react";
import ProfileEditor from "@/components/ProfileEditor";

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
}

export default function EditProfilePage() {
  const params = useParams();
  const router = useRouter();
  const { data: session, status } = useSession();
  const username = params.username as string;
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/signin");
      return;
    }
    if (status === "loading") return;

    const sessionUsername = (session?.user as Record<string, string>)?.username;
    if (sessionUsername !== username) {
      router.push(`/profile/${username}`);
      return;
    }

    fetch(`/api/users/${username}`)
      .then((r) => r.json())
      .then((data) => {
        setProfile({
          displayName: data.displayName || "",
          bio: data.bio || "",
          avatarUrl: data.avatarUrl,
          bannerUrl: data.bannerUrl,
          backgroundColor: data.backgroundColor || "#030712",
          accentColor: data.accentColor || "#22d3ee",
          socialLinks: data.socialLinks || {},
          profileLayout: data.profileLayout || { showStats: true, showSolves: true, bioPosition: "top" },
        });
        setLoading(false);
      })
      .catch(() => router.push("/"));
  }, [username, session, status, router]);

  const handleSave = async (data: Partial<ProfileData>) => {
    const res = await fetch("/api/users", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error("Failed to save");
    router.push(`/profile/${username}`);
    router.refresh();
  };

  if (loading || !profile) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12">
        <div className="animate-pulse space-y-6">
          <div className="h-48 rounded-xl bg-gray-800" />
          <div className="h-8 w-48 rounded bg-gray-800" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      <Link
        href={`/profile/${username}`}
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-300 mb-8 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to profile
      </Link>

      <h1 className="text-2xl font-bold mb-6">Edit Profile</h1>

      <ProfileEditor profile={profile} onSave={handleSave} />
    </div>
  );
}
