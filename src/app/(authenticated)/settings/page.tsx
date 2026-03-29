"use client";

import { useEffect, useState } from "react";
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
  IconBell,
  IconBuildingBank,
  IconLock,
  IconEdit,
} from "@tabler/icons-react";
import { toast } from "sonner";
import { CircularLoader } from "@/components/CircularLoader";

type Tab = "profile" | "bank";

export default function SettingsPage() {
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [profile, setProfile]     = useState<any>(null);
  const [activeTab, setActiveTab] = useState<Tab>("profile");
  const [status, setStatus]       = useState<{ type: "success" | "error" | null; message: string }>({ type: null, message: "" });

  // Bank form state
  const [bankForm, setBankForm]   = useState({ accountName: "", accountNumber: "", confirmAccount: "", ifsc: "" });
  const [bankError, setBankError] = useState("");
  const [savingBank, setSavingBank] = useState(false);
  const [editingBank, setEditingBank] = useState(false);

  useEffect(() => { fetchProfile(); }, []);

  const fetchProfile = async () => {
    setLoading(true);
    try {
      const res  = await fetch("/api/user/profile");
      const data = await res.json();
      if (res.ok) {
        setProfile(data);
        setBankForm({
          accountName:    data.bank_account_name   ?? "",
          accountNumber:  data.bank_account_number ?? "",
          confirmAccount: data.bank_account_number ?? "",
          ifsc:           data.bank_ifsc           ?? "",
        });
      } else {
        setStatus({ type: "error", message: data.error || "Failed to load profile." });
      }
    } catch {
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
      const res  = await fetch("/api/user/profile", {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ full_name: profile.full_name, phone: profile.phone?.replace(/\D/g, ""), avatar_url: profile.avatar_url }),
      });
      const data = await res.json();
      if (res.ok) {
        setProfile(data);
        setStatus({ type: "success", message: "Profile updated successfully!" });
        setTimeout(() => setStatus({ type: null, message: "" }), 3000);
      } else {
        setStatus({ type: "error", message: data.error || "Failed to update profile." });
      }
    } catch {
      setStatus({ type: "error", message: "Could not save changes." });
    } finally {
      setSaving(false);
    }
  };

  const handleBankSave = async () => {
    const { accountName, accountNumber, confirmAccount, ifsc } = bankForm;
    if (!accountName.trim())   { setBankError("Account holder name is required."); return; }
    if (!accountNumber.trim()) { setBankError("Account number is required."); return; }
    if (accountNumber !== confirmAccount) { setBankError("Account numbers do not match."); return; }
    if (!/^[A-Za-z]{4}\d{7}$/.test(ifsc.trim())) { setBankError("Enter a valid IFSC code (e.g. SBIN0001234)."); return; }
    setBankError("");
    setSavingBank(true);
    try {
      const res  = await fetch("/api/cashfree/add-beneficiary", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          name:        accountName.trim(),
          bankAccount: accountNumber.trim(),
          ifsc:        ifsc.trim().toUpperCase(),
          phone:       (profile?.phone ?? "").replace(/\D/g, ""),
          email:       profile?.email ?? "",
        }),
      });
      const data = await res.json();
      if (!res.ok) { setBankError(data.error ?? "Failed to save bank details."); return; }
      toast.success("Bank details updated successfully!");
      setEditingBank(false);
      fetchProfile();
    } catch {
      setBankError("Something went wrong. Please try again.");
    } finally {
      setSavingBank(false);
    }
  };

  if (loading) {
    return <CircularLoader message="Loading preferences..." />;
  }

  const hasBankDetails = !!profile?.bank_account_number;

  return (
    <div className="flex-1 bg-[#f7f9fb] font-['Manrope',sans-serif] overflow-y-auto selection:bg-[#d8e3fb] selection:text-[#475266]">
      <main className="flex-1 p-6 lg:p-10 max-w-7xl mx-auto w-full animate-in fade-in slide-in-from-bottom-4 duration-500">

        {/* Tab Navigation */}
        <div className="flex gap-8 mb-10 border-b border-[#e1e9ee] overflow-x-auto no-scrollbar">
          <button
            onClick={() => setActiveTab("profile")}
            className={`pb-4 text-sm font-extrabold whitespace-nowrap transition-all ${
              activeTab === "profile"
                ? "text-[#545f73] border-b-2 border-[#545f73]"
                : "text-[#a9b4b9] hover:text-[#566166]"
            }`}
          >
            Profile Information
          </button>
          <button
            onClick={() => setActiveTab("bank")}
            className={`pb-4 text-sm font-extrabold whitespace-nowrap transition-all flex items-center gap-2 ${
              activeTab === "bank"
                ? "text-[#545f73] border-b-2 border-[#545f73]"
                : "text-[#a9b4b9] hover:text-[#566166]"
            }`}
          >
            Bank Details
            {profile?.bank_verified ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-600 text-[10px] font-black rounded-full border border-emerald-100">
                <IconShieldCheck size={10} /> Verified
              </span>
            ) : !hasBankDetails ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 text-amber-600 text-[10px] font-black rounded-full border border-amber-100">
                Not Added
              </span>
            ) : null}
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

          {/* Left Column */}
          <section className="lg:col-span-4 flex flex-col gap-6">
            <div className="bg-[#f0f4f7] rounded-3xl p-8 flex flex-col items-center text-center border border-[#a9b4b9]/10 shadow-sm transition-all hover:shadow-md">
              <div className="relative group mb-6">
                <div className="w-32 h-32 rounded-3xl overflow-hidden shadow-xl ring-4 ring-white bg-[#d9e4ea]">
                  <img
                    alt={profile?.full_name}
                    className="w-full h-full object-cover transition-transform group-hover:scale-105 duration-500"
                    src={profile?.avatar_url || "https://ui-avatars.com/api/?name=" + (profile?.full_name || "User") + "&background=545f73&color=fff"}
                  />
                </div>
                <button className="absolute -bottom-2 -right-2 bg-[#545f73] text-white p-2.5 rounded-xl shadow-lg hover:scale-110 active:scale-95 transition-all">
                  <IconCamera size={16} stroke={2.5} />
                </button>
              </div>
              <h2 className="text-2xl font-extrabold text-[#2a3439] mb-1">{profile?.full_name}</h2>
              <p className="text-[#566166] text-sm mb-6 font-medium">{profile?.email}</p>
              <div className="inline-flex items-center gap-2 px-5 py-2 bg-[#d3e4f7] text-[#314150] text-xs font-bold rounded-full uppercase tracking-wider">
                <IconShieldCheck size={14} className="opacity-70" />
                {profile?.role || "Employee"}
              </div>
            </div>

            {activeTab === "bank" ? (
              <div className="bg-[#f0f4f7] rounded-3xl p-6 border border-[#a9b4b9]/10">
                <h3 className="text-[10px] font-black text-[#566166]/60 uppercase tracking-[0.2em] mb-4">Bank Status</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-[#566166]">Account Added</span>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${hasBankDetails ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"}`}>
                      {hasBankDetails ? "Yes" : "No"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-[#566166]">Verification</span>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${profile?.bank_verified ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-500"}`}>
                      {profile?.bank_verified ? "Verified" : "Pending"}
                    </span>
                  </div>
                  {profile?.bank_ifsc && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-[#566166]">IFSC</span>
                      <span className="text-xs font-bold text-[#2a3439] font-mono">{profile.bank_ifsc}</span>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <>
              </>
            )}
          </section>

          {/* Right Column */}
          <section className="lg:col-span-8">

            {/* ── Profile Tab ── */}
            {activeTab === "profile" && (
              <div className="bg-white rounded-[2rem] p-8 lg:p-10 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-200/60 transition-all hover:shadow-[0_8px_30px_rgb(0,0,0,0.06)]">
                <div className="mb-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-2xl font-extrabold text-[#2a3439] mb-1">Profile Details</h2>
                    <p className="text-[#566166] text-sm font-medium">Update your public information.</p>
                  </div>
                  {status.message && (
                    <div className={`px-5 py-2.5 rounded-2xl flex items-center gap-3 animate-in fade-in zoom-in duration-300 ${
                      status.type === "success" ? "bg-emerald-50 text-emerald-600 border border-emerald-100" : "bg-red-50 text-red-600 border border-red-100"
                    }`}>
                      {status.type === "success" ? <IconCheck size={18} stroke={3} /> : <IconAlertCircle size={18} stroke={3} />}
                      <span className="text-xs font-bold tracking-tight uppercase">{status.message}</span>
                    </div>
                  )}
                </div>

                <form onSubmit={handleUpdate} className="space-y-10">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-3">
                      <label className="block text-xs font-black text-slate-500 uppercase tracking-widest pl-1">Full Name</label>
                      <input
                        type="text"
                        value={profile?.full_name || ""}
                        onChange={(e) => setProfile({ ...profile, full_name: e.target.value })}
                        className="w-full bg-white border border-slate-200 rounded-2xl px-4 py-3 text-slate-900 font-bold transition-all focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 placeholder:text-slate-300 shadow-sm"
                        placeholder="e.g. Harshal Bhavsar"
                      />
                    </div>
                    <div className="space-y-3 opacity-60">
                      <label className="block text-xs font-black text-slate-500 uppercase tracking-widest pl-1">Email Address</label>
                      <input
                        type="email"
                        value={profile?.email || ""}
                        readOnly
                        className="w-full bg-slate-50/50 border border-slate-100 cursor-not-allowed px-4 py-3 text-slate-500 font-medium rounded-2xl"
                      />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <label className="block text-xs font-black text-slate-500 uppercase tracking-widest pl-1">WhatsApp Number</label>
                    <div className="relative group">
                      <div className="absolute left-0 top-1/2 -translate-y-1/2 flex items-center gap-2 pl-4 pr-3 border-r border-slate-200">
                        <span className="text-sm font-bold text-slate-400">ID</span>
                      </div>
                      <input
                        type="tel"
                        value={profile?.phone || ""}
                        onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                        className="w-full bg-white border border-slate-200 rounded-2xl pl-16 pr-4 py-3 text-slate-900 font-bold transition-all focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 placeholder:text-slate-300 shadow-sm"
                        placeholder="e.g. 919876543210"
                      />
                    </div>
                    <div className="flex items-center gap-2 pt-1 opacity-70">
                      <IconAlertCircle size={14} className="text-[#545f73]" />
                      <p className="text-xs text-[#566166] font-medium italic">Link your WhatsApp account for AI expense tracking.</p>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row items-center justify-end gap-4 pt-10 border-t border-[#f0f4f7]">
                    <button
                      type="button"
                      onClick={fetchProfile}
                      className="w-full sm:w-auto px-8 py-3 text-sm font-bold text-[#545f73] hover:bg-[#545f73]/5 rounded-2xl transition-all active:scale-95"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={saving}
                      className="w-full sm:w-auto px-10 py-3.5 bg-[#545f73] text-white text-sm font-bold rounded-2xl shadow-xl shadow-[#545f73]/20 hover:shadow-2xl hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:scale-100 flex items-center justify-center gap-2"
                    >
                      {saving ? <IconLoader2 className="w-4 h-4 animate-spin" /> : <IconDeviceFloppy size={18} />}
                      {saving ? "Saving Changes..." : "Save Changes"}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* ── Bank Details Tab ── */}
            {activeTab === "bank" && (
              <div className="bg-white rounded-[2rem] p-8 lg:p-10 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-200/60 transition-all hover:shadow-[0_8px_30px_rgb(0,0,0,0.06)]">
                <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-2xl font-extrabold text-[#2a3439] mb-1">Bank Details</h2>
                    <p className="text-[#566166] text-sm font-medium">
                      {hasBankDetails ? "Your bank account linked for expense reimbursements." : "Add your bank account to receive expense reimbursements."}
                    </p>
                  </div>
                  {hasBankDetails && !editingBank && (
                    <button
                      onClick={() => setEditingBank(true)}
                      className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-[#545f73] border border-[#545f73]/20 rounded-2xl hover:bg-[#545f73]/5 transition-all"
                    >
                      <IconEdit size={15} /> Update
                    </button>
                  )}
                </div>

                {/* View mode — existing bank info */}
                {hasBankDetails && !editingBank && (
                  <div className="space-y-6">
                    {profile?.bank_verified && (
                      <div className="flex items-center gap-3 px-5 py-3.5 bg-emerald-50 border border-emerald-100 rounded-2xl">
                        <IconShieldCheck size={18} className="text-emerald-500 flex-shrink-0" />
                        <div>
                          <p className="text-sm font-bold text-emerald-700">Bank account verified</p>
                          <p className="text-xs text-emerald-600">This account is registered with Cashfree for direct transfers.</p>
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <div className="space-y-2">
                        <label className="block text-xs font-black text-[#566166]/60 uppercase tracking-widest">Account Holder Name</label>
                        <div className="flex items-center gap-3 px-4 py-3.5 bg-[#f7f9fb] rounded-2xl border border-[#e1e9ee]">
                          <IconUser size={16} className="text-[#545f73] flex-shrink-0" />
                          <span className="text-sm font-bold text-[#2a3439]">{profile.bank_account_name}</span>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="block text-xs font-black text-[#566166]/60 uppercase tracking-widest">Account Number</label>
                        <div className="flex items-center gap-3 px-4 py-3.5 bg-[#f7f9fb] rounded-2xl border border-[#e1e9ee]">
                          <IconLock size={16} className="text-[#545f73] flex-shrink-0" />
                          <span className="text-sm font-bold text-[#2a3439] font-mono tracking-widest">
                            •••• •••• {profile.bank_account_number.slice(-4)}
                          </span>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="block text-xs font-black text-[#566166]/60 uppercase tracking-widest">IFSC Code</label>
                        <div className="flex items-center gap-3 px-4 py-3.5 bg-[#f7f9fb] rounded-2xl border border-[#e1e9ee]">
                          <IconBuildingBank size={16} className="text-[#545f73] flex-shrink-0" />
                          <span className="text-sm font-bold text-[#2a3439] font-mono">{profile.bank_ifsc}</span>
                        </div>
                      </div>

                      {profile?.cashfree_bene_id && (
                        <div className="space-y-2">
                          <label className="block text-xs font-black text-[#566166]/60 uppercase tracking-widest">Beneficiary ID</label>
                          <div className="flex items-center gap-3 px-4 py-3.5 bg-[#f7f9fb] rounded-2xl border border-[#e1e9ee]">
                            <IconShield size={16} className="text-[#545f73] flex-shrink-0" />
                            <span className="text-xs font-mono text-[#566166] truncate">{profile.cashfree_bene_id}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Edit / Add form */}
                {(!hasBankDetails || editingBank) && (
                  <div className="space-y-6">
                    {editingBank && (
                      <div className="flex items-center gap-3 px-5 py-3 bg-amber-50 border border-amber-100 rounded-2xl">
                        <IconAlertCircle size={16} className="text-amber-500 flex-shrink-0" />
                        <p className="text-xs font-semibold text-amber-700">Updating bank details will re-register your account with Cashfree.</p>
                      </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2 md:col-span-2">
                        <label className="block text-xs font-black text-slate-500 uppercase tracking-widest pl-1">Account Holder Name</label>
                        <input
                          type="text"
                          autoFocus
                          placeholder="As printed on bank passbook"
                          value={bankForm.accountName}
                          onChange={e => { setBankForm(f => ({ ...f, accountName: e.target.value })); setBankError(""); }}
                          className="w-full bg-white border border-slate-200 rounded-2xl px-4 py-3 text-slate-900 font-bold transition-all focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 placeholder:text-slate-300 shadow-sm"
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="block text-xs font-black text-slate-500 uppercase tracking-widest pl-1">Account Number</label>
                        <input
                          type="text"
                          inputMode="numeric"
                          placeholder="e.g. 012345678901"
                          value={bankForm.accountNumber}
                          onChange={e => { setBankForm(f => ({ ...f, accountNumber: e.target.value.replace(/\D/g, "") })); setBankError(""); }}
                          className="w-full bg-white border border-slate-200 rounded-2xl px-4 py-3 text-slate-900 font-bold tracking-widest transition-all focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 placeholder:text-slate-300 shadow-sm"
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="block text-xs font-black text-slate-500 uppercase tracking-widest pl-1">Confirm Account Number</label>
                        <input
                          type="text"
                          inputMode="numeric"
                          placeholder="Re-enter account number"
                          value={bankForm.confirmAccount}
                          onChange={e => { setBankForm(f => ({ ...f, confirmAccount: e.target.value.replace(/\D/g, "") })); setBankError(""); }}
                          onPaste={e => e.preventDefault()}
                          className="w-full bg-white border border-slate-200 rounded-2xl px-4 py-3 text-slate-900 font-bold tracking-widest transition-all focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 placeholder:text-slate-300 shadow-sm"
                        />
                      </div>

                      <div className="space-y-2 md:col-span-2">
                        <label className="block text-xs font-black text-slate-500 uppercase tracking-widest pl-1">IFSC Code</label>
                        <input
                          type="text"
                          maxLength={11}
                          placeholder="e.g. SBIN0001234"
                          value={bankForm.ifsc}
                          onChange={e => { setBankForm(f => ({ ...f, ifsc: e.target.value.toUpperCase() })); setBankError(""); }}
                          className="w-full bg-white border border-slate-200 rounded-2xl px-4 py-3 text-slate-900 font-bold font-mono tracking-widest transition-all focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 placeholder:text-slate-300 shadow-sm"
                        />
                        <p className="text-xs text-slate-400 pl-1 mt-1">11-character code found on your cheque book or net banking.</p>
                      </div>
                    </div>

                    {bankError && (
                      <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-100 rounded-2xl">
                        <IconAlertCircle size={15} className="text-red-500 flex-shrink-0" />
                        <p className="text-sm font-semibold text-red-600">{bankError}</p>
                      </div>
                    )}

                    <div className="flex flex-col sm:flex-row items-center justify-end gap-4 pt-6 border-t border-[#f0f4f7]">
                      {editingBank && (
                        <button
                          type="button"
                          onClick={() => { setEditingBank(false); setBankError(""); }}
                          className="w-full sm:w-auto px-8 py-3 text-sm font-bold text-[#545f73] hover:bg-[#545f73]/5 rounded-2xl transition-all active:scale-95"
                        >
                          Cancel
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={handleBankSave}
                        disabled={savingBank}
                        className="w-full sm:w-auto px-10 py-3.5 bg-[#545f73] text-white text-sm font-bold rounded-2xl shadow-xl shadow-[#545f73]/20 hover:shadow-2xl hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:scale-100 flex items-center justify-center gap-2"
                      >
                        {savingBank ? <IconLoader2 className="w-4 h-4 animate-spin" /> : <IconBuildingBank size={18} />}
                        {savingBank ? "Saving..." : hasBankDetails ? "Update Bank Details" : "Save Bank Details"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

          </section>
        </div>
      </main>
    </div>
  );
}
