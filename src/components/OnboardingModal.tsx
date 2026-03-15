"use client";

import { useEffect, useState } from "react";

interface OrgForm {
  name: string;
  industry: string;
  team_size: string;
  contact_name: string;
  contact_phone: string;
}

interface OnboardingModalProps {
  onComplete: (orgId: string, orgName: string) => void;
}

const INDUSTRIES = [
  "Technology",
  "Finance",
  "Healthcare",
  "Retail",
  "Manufacturing",
  "Education",
  "Logistics",
  "Other",
];

const TEAM_SIZES = ["1–10", "11–50", "51–200", "201–500", "500+"];

export function OnboardingModal({ onComplete }: OnboardingModalProps) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState<OrgForm>({
    name: "",
    industry: "",
    team_size: "",
    contact_name: "",
    contact_phone: "",
  });

  const set = (field: keyof OrgForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSubmit = async () => {
    if (!form.name.trim()) { setError("Organization name is required."); return; }
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/organizations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Failed to save organization.");
      }
      const data = await res.json();
      onComplete(data.id, data.name);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.75)",
        backdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: "24px",
      }}
    >
      <div
        className="animate-modal-in"
        style={{
          background: "var(--bg-card)",
          border: "1px solid var(--border)",
          borderRadius: "20px",
          padding: "40px",
          width: "100%",
          maxWidth: "480px",
          boxShadow: "var(--shadow-lg)",
        }}
      >
        {/* Header */}
        <div style={{ marginBottom: "32px", textAlign: "center" }}>
          <div
            style={{
              width: "56px",
              height: "56px",
              borderRadius: "16px",
              background: "linear-gradient(135deg, var(--accent), #8b5cf6)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 16px",
              fontSize: "24px",
            }}
          >
            💼
          </div>
          <h1 className="typo-h3 text-primary! font-bold!" style={{ margin: 0 }}>
            Welcome to Expify Agent
          </h1>
          <p className="typo-body-default text-secondary!" style={{ margin: "8px 0 0" }}>
            Tell us about your organization to get started
          </p>
        </div>

        {/* Step indicators */}
        <div style={{ display: "flex", gap: "8px", marginBottom: "28px" }}>
          {[1, 2].map((s) => (
            <div
              key={s}
              style={{
                flex: 1,
                height: "4px",
                borderRadius: "2px",
                background: step >= s ? "var(--accent)" : "var(--bg-hover)",
                transition: "background var(--transition)",
              }}
            />
          ))}
        </div>

        {step === 1 && (
          <div className="animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <Field label="Organization Name *" id="org-name">
              <input
                id="org-name"
                type="text"
                className="typo-body-default"
                placeholder="e.g. Acme Corp"
                value={form.name}
                onChange={set("name")}
                autoFocus
              />
            </Field>
            <Field label="Industry" id="org-industry">
              <select id="org-industry" className="typo-body-default" value={form.industry} onChange={set("industry")}>
                <option value="">Select industry…</option>
                {INDUSTRIES.map((i) => <option key={i}>{i}</option>)}
              </select>
            </Field>
            <Field label="Team Size" id="org-team-size">
              <select id="org-team-size" className="typo-body-default" value={form.team_size} onChange={set("team_size")}>
                <option value="">Select team size…</option>
                {TEAM_SIZES.map((s) => <option key={s}>{s}</option>)}
              </select>
            </Field>

            <button
              id="onboarding-next-btn"
              className="typo-button font-bold!"
              onClick={() => { if (!form.name.trim()) { setError("Please enter your organization name."); return; } setError(""); setStep(2); }}
              style={btnStyle}
            >
              Continue →
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <p className="typo-body-small text-secondary!" style={{ margin: "0 0 8px" }}>
              Almost there! Add a point of contact (optional).
            </p>
            <Field label="Contact Name" id="contact-name">
              <input
                id="contact-name"
                type="text"
                className="typo-body-default"
                placeholder="Your name"
                value={form.contact_name}
                onChange={set("contact_name")}
                autoFocus
              />
            </Field>
            <Field label="Contact Phone / WhatsApp" id="contact-phone">
              <input
                id="contact-phone"
                type="tel"
                className="typo-body-default"
                placeholder="+91 9876543210"
                value={form.contact_phone}
                onChange={set("contact_phone")}
              />
            </Field>

            <div style={{ display: "flex", gap: "10px" }}>
              <button
                id="onboarding-back-btn"
                className="typo-button font-bold!"
                onClick={() => setStep(1)}
                style={{ ...btnStyle, background: "var(--bg-hover)", flex: "0 0 auto", width: "80px", color: "var(--text-primary)" }}
              >
                ← Back
              </button>
              <button
                id="onboarding-submit-btn"
                className="typo-button font-bold!"
                onClick={handleSubmit}
                disabled={loading}
                style={{ ...btnStyle, flex: 1, opacity: loading ? 0.7 : 1 }}
              >
                {loading ? "Saving…" : "Get Started 🚀"}
              </button>
            </div>
          </div>
        )}

        {error && (
          <p className="typo-body-small text-danger!" style={{ marginTop: "12px", textAlign: "center" }}>
            {error}
          </p>
        )}
      </div>
    </div>
  );
}

function Field({ label, id, children }: { label: string; id: string; children: React.ReactNode }) {
  return (
    <div>
      <label
        htmlFor={id}
        className="typo-overline text-secondary!"
        style={{ display: "block", marginBottom: "6px" }}
      >
        {label}
      </label>
      <style>{`
        #${id} {
          width: 100%;
          background: var(--bg-secondary);
          border: 1px solid var(--border);
          border-radius: 10px;
          padding: 10px 14px;
          color: var(--text-primary);
          outline: none;
          transition: border-color var(--transition);
        }
        #${id}:focus {
          border-color: var(--accent);
        }
        #${id} option {
          background: var(--bg-secondary);
        }
      `}</style>
      {children}
    </div>
  );
}

const btnStyle: React.CSSProperties = {
  background: "linear-gradient(135deg, var(--accent), #8b5cf6)",
  color: "#fff",
  border: "none",
  borderRadius: "10px",
  padding: "12px 20px",
  cursor: "pointer",
  width: "100%",
  transition: "opacity var(--transition), transform var(--transition)",
};
