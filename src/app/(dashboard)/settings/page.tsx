"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { 
  IconUser, 
  IconPhone, 
  IconMail, 
  IconShield, 
  IconCamera, 
  IconDeviceFloppy, 
  IconCircleCheck, 
  IconAlertCircle,
  IconLoader2,
  IconTrash,
  IconCheck,
  IconShieldCheck,
  IconBell
} from "@tabler/icons-react";
import { createClient } from "@/utils/supabase/client";

export default function SettingsPage() {
  const searchParams = useSearchParams();
  const isForced = searchParams.get("force") === "true";
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [status, setStatus] = useState<{ type: "success" | "error" | null, message: string }>({ type: null, message: "" });
  const supabase = createClient();

  useEffect(() => {
    fetchProfile();
    if (isForced) {
      setStatus({ type: "error", message: "Please provide your WhatsApp number to continue." });
    }
  }, [isForced]);

  const fetchProfile = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/user/profile");
      const data = await res.json();
      if (res.ok) {
        setProfile(data);
      } else {
        setStatus({ type: "error", message: data.error || "Failed to load profile." });
      }
    } catch (err) {
      setStatus({ type: "error", message: "An unexpected error occurred." });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setStatus({ type: null, message: "" });

    try {
      const res = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: profile.full_name,
          phone: profile.phone?.replace(/\D/g, ""),
          avatar_url: profile.avatar_url
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setProfile(data);
        setStatus({ type: "success", message: "Profile updated successfully!" });
        setTimeout(() => setStatus({ type: null, message: "" }), 3000);
      } else {
        setStatus({ type: "error", message: data.error || "Failed to update profile." });
      }
    } catch (err) {
      setStatus({ type: "error", message: "Could not save changes." });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-(--bg-secondary)">
        <div className="flex flex-col items-center gap-4">
          <IconLoader2 className="w-10 h-10 text-(--accent-primary) animate-spin" />
          <p className="typo-body-default animate-pulse">Loading your preferences...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-(--bg-secondary) overflow-y-auto">
      <div className="flex-1 max-w-4xl mx-auto w-full space-y-8 p-4 md:p-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        {/* Header */}
        <div className="flex flex-col gap-2 bg-(--bg-secondary) p-6 rounded-2xl shadow-sm">
          <div className="flex items-center gap-3">
             <div className="p-2.5 bg-(--accent-primary-subtle) rounded-xl">
                <IconUser size={24} stroke={1.5} className="text-(--accent-primary)" />
             </div>
             <div>
               <h1 className="typo-h1">Account Settings</h1>
               <p className="typo-body-default text-(--text-muted)">Manage your profile and account preferences</p>
             </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Column: Navigation/Summary */}
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-(--bg-secondary) rounded-2xl p-2 shadow-sm">
               <nav className="space-y-1">
                  <button className="w-full flex items-center gap-3 px-4 py-3 bg-(--bg-primary) rounded-xl text-blue-500 font-semibold shadow-sm transition-all">
                     <IconUser size={18} stroke={2} />
                     <span className="typo-nav-item">Profile Information</span>
                  </button>
                  <button className="w-full flex items-center gap-3 px-4 py-3 hover:bg-(--bg-tertiary) rounded-xl text-(--text-muted) hover:text-emerald-500 transition-all">
                     <IconShieldCheck size={18} stroke={1.5} className="text-emerald-500" />
                     <span className="typo-nav-item">Security</span>
                  </button>
                  <button className="w-full flex items-center gap-3 px-4 py-3 hover:bg-(--bg-tertiary) rounded-xl text-(--text-muted) hover:text-amber-500 transition-all">
                     <IconBell size={18} stroke={1.5} className="text-amber-500" />
                     <span className="typo-nav-item">Notifications</span>
                  </button>
               </nav>
            </div>
            <div className="bg-(--bg-primary) rounded-2xl p-6 shadow-sm text-center relative overflow-hidden group">
              <div className="absolute top-0 left-0 w-full h-24 bg-(--accent-primary) opacity-5"></div>
              
              <div className="relative mt-8 mb-4 inline-block">
                <div className="w-28 h-28 rounded-full border-4 border-white shadow-md overflow-hidden bg-(--bg-tertiary) mx-auto transition-transform group-hover:scale-105 duration-500">
                  <img 
                    src={profile?.avatar_url || "https://ui-avatars.com/api/?name=" + profile?.full_name} 
                    alt="Avatar" 
                    className="w-full h-full object-cover"
                  />
                </div>
                <button className="absolute bottom-0 right-0 p-2 bg-white rounded-full shadow-lg border border-(--border-default) hover:text-(--accent-primary) transition-all active:scale-90">
                  <IconCamera size={16} stroke={2} />
                </button>
              </div>

              <h2 className="typo-h3">{profile?.full_name}</h2>
              <p className="typo-body-small mt-1">{profile?.email}</p>
              
              <div className="mt-6 pt-6 border-t border-(--border-default) flex justify-center gap-4">
                <div className="text-center">
                  <span className="typo-overline block text-(--text-muted)!">Role</span>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-(--accent-primary-subtle) text-(--accent-primary) rounded-full text-[11px] font-bold mt-2 uppercase">
                    <IconShield size={10} /> {profile?.role}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Edit Form */}
          <div className="lg:col-span-8 space-y-8">
            <form onSubmit={handleUpdate} className="bg-(--bg-primary) rounded-2xl shadow-md overflow-hidden">
               <div className="p-6 flex items-center justify-between">
                  <div>
                    <h3 className="typo-h3 text-blue-500">Profile Details</h3>
                    <p className="typo-caption text-(--text-muted)">Update your public information</p>
                  </div>
                  {status.message && (
                    <div className={`px-4 py-2 rounded-xl flex items-center gap-2 ${status.type === 'success' ? 'bg-(--color-success-subtle) text-(--color-success)' : 'bg-(--color-danger-subtle) text-(--color-danger)'} animate-in fade-in zoom-in duration-300`}>
                      {status.type === 'success' ? <IconCheck size={16} stroke={2} /> : <IconAlertCircle size={16} stroke={2} />}
                      <span className="typo-label">{status.message}</span>
                    </div>
                  )}
               </div>
              <div className="p-6 md:p-8 space-y-8">
                
                {status.type && (
                  <div className={`flex items-center gap-3 p-4 rounded-xl animate-in fade-in slide-in-from-top-2 duration-300 ${
                    status.type === 'success' ? 'bg-(--color-success-subtle) text-(--color-success)' : 'bg-(--color-danger-subtle) text-(--color-danger)'
                  }`}>
                    {status.type === 'success' ? <IconCircleCheck size={20} stroke={2} /> : <IconAlertCircle size={20} stroke={2} />}
                    <span className="typo-label">{status.message}</span>
                  </div>
                )}

                <div className="space-y-6">
                  {/* Name Input */}
                  <div className="space-y-2">
                    <label className="typo-label flex items-center gap-2 text-blue-500">
                      <IconUser size={14} stroke={2} /> Full Name
                    </label>
                    <input 
                      type="text" 
                      value={profile?.full_name || ""}
                      onChange={(e) => setProfile({...profile, full_name: e.target.value})}
                      className="w-full bg-(--bg-tertiary) border border-(--border-default) rounded-xl px-5 py-4 typo-body-default text-(--text-primary) focus:ring-2 focus:ring-(--border-focus)/20 focus:bg-white focus:border-(--border-focus) outline-none transition-all"
                      placeholder="Enter your full name"
                    />
                  </div>

                  {/* Phone Input */}
                  <div className="space-y-2">
                    <label className="typo-label flex items-center gap-2 text-emerald-500">
                      <IconPhone size={14} stroke={2} /> WhatsApp Number
                    </label>
                    <div className="relative group">
                      <input 
                        type="tel" 
                        value={profile?.phone || ""}
                        onChange={(e) => setProfile({...profile, phone: e.target.value})}
                        className="w-full bg-(--bg-tertiary) rounded-xl px-5 py-4 typo-body-default text-(--text-primary) focus:ring-2 focus:ring-(--border-focus)/20 focus:bg-white transition-all outline-none"
                        placeholder="e.g. 919876543210"
                      />
                      <div className="absolute right-5 top-1/2 -translate-y-1/2 flex items-center gap-2 opacity-50">
                        <span className="typo-overline text-[10px]!">Unique</span>
                        <IconShield className="text-(--color-success)" size={14} stroke={2} />
                      </div>
                    </div>
                    <p className="typo-caption pl-1">Link your WhatsApp account for AI expense tracking.</p>
                  </div>

                  {/* Email Input (ReadOnly) */}
                  <div className="space-y-2 opacity-60">
                    <label className="typo-label flex items-center gap-2">
                      <IconMail size={14} stroke={2} /> Email Address
                    </label>
                    <div className="relative">
                      <input 
                        type="email" 
                        value={profile?.email || ""}
                        readOnly
                        className="w-full bg-(--bg-tertiary) border border-(--border-default) rounded-xl px-5 py-4 typo-body-default text-(--text-muted) cursor-not-allowed"
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-6 border-t border-(--border-default) flex justify-end gap-4">
                  <button 
                    type="button" 
                    onClick={fetchProfile}
                    className="px-6 py-3 rounded-xl typo-button text-(--text-secondary) hover:bg-(--bg-tertiary) transition-all active:scale-95"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    disabled={saving}
                    className="px-8 py-3 bg-(--accent-primary) text-white rounded-xl typo-button shadow-(--sidebar-shadow) hover:bg-(--accent-primary-hover) flex items-center gap-2 transition-all active:scale-95 disabled:opacity-50 disabled:scale-100"
                  >
                    {saving ? <IconLoader2 className="w-4 h-4 animate-spin" /> : <IconDeviceFloppy size={18} stroke={2} />}
                    {saving ? "Saving..." : "Save Changes"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
