"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase, Profile } from "@/lib/supabase";
import IconButton from "./ui/IconButton";
import Badge from "./ui/Badge";
import { X, Mail, Settings } from "lucide-react";
import { resolveName } from "@/lib/displayName";

export default function UserProfileCard({
  userId,
  currentUserId,
  onClose,
}: {
  userId: string;
  currentUserId: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const isSelf = userId === currentUserId;

  useEffect(() => {
    let active = true;
    setLoading(true);
    supabase
      .from("profiles")
      .select("id, username, full_name, email, avatar_url, created_at")
      .eq("id", userId)
      .single()
      .then(({ data, error }) => {
        if (!active) return;
        if (!error && data) setProfile(data as Profile);
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [userId]);

  return (
    <div
      className="fixed inset-0 bg-ink/45 flex items-center justify-center p-4 z-50 fade-in"
      onClick={onClose}
    >
      <div
        className="bg-paper border border-line rounded-lg shadow-modal max-w-xs w-full p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-end mb-1">
          <IconButton aria-label="إغلاق" onClick={onClose}>
            <X size={16} strokeWidth={1.75} />
          </IconButton>
        </div>

        {loading ? (
          <div className="flex flex-col items-center py-4">
            <div className="skeleton h-16 w-16 rounded-full mb-3" />
            <div className="skeleton h-4 w-28 rounded-sm mb-2" />
            <div className="skeleton h-3 w-20 rounded-sm" />
          </div>
        ) : !profile ? (
          <p className="text-sm text-inkSoft text-center py-6">تعذّر تحميل بيانات هذا المستخدم</p>
        ) : (
          <div className="flex flex-col items-center text-center -mt-2">
            {profile.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={profile.avatar_url}
                alt={resolveName(profile)}
                className="h-16 w-16 rounded-full object-cover border border-line mb-3"
              />
            ) : (
              <div className="h-16 w-16 rounded-full bg-tealSoft text-tealDark flex items-center justify-center font-display text-xl font-medium mb-3">
                {resolveName(profile).trim().charAt(0).toUpperCase() || "?"}
              </div>
            )}

            <h3 className="font-display text-lg font-medium">
              {resolveName(profile)}
              {isSelf && <span className="text-inkFaint text-sm font-sans"> (أنت)</span>}
            </h3>
            <p dir="ltr" className="font-mono text-xs text-inkFaint mt-0.5">
              @{profile.username}
            </p>

            {profile.email && (
              <div className="mt-3 w-full">
                <Badge tone="neutral">
                  <span className="flex items-center gap-1" dir="ltr">
                    <Mail size={11} strokeWidth={2} />
                    {profile.email}
                  </span>
                </Badge>
              </div>
            )}

            {isSelf && (
              <button
                onClick={() => {
                  onClose();
                  router.push("/profile");
                }}
                className="mt-4 flex items-center gap-1.5 text-xs text-teal hover:text-tealDark font-medium transition-colors"
              >
                <Settings size={13} strokeWidth={1.75} />
                تعديل الملف الشخصي
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
