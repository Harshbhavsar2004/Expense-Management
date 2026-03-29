'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import {
  Building2, Users, Phone, ArrowRight, Loader2, CheckCircle2,
  Landmark, ShieldCheck,
} from 'lucide-react'
import { toast } from 'sonner'

// ── Step definitions ───────────────────────────────────────────────────────────

const PROFILE_STEPS = [
  {
    id: 'phone',
    icon: Phone,
    label: 'Mobile Number',
    placeholder: 'e.g. 9876543210',
    hint: 'Include country code — used for WhatsApp receipt submission.',
    type: 'tel',
    field: 'phone',
  },
  {
    id: 'organization',
    icon: Building2,
    label: 'Organization Name',
    placeholder: 'e.g. Fristine Infotech',
    hint: 'The company you work for.',
    type: 'text',
    field: 'organization',
  },
  {
    id: 'team',
    icon: Users,
    label: 'Team Name',
    placeholder: 'e.g. Engineering, Sales, Finance',
    hint: 'Your department or team within the organization.',
    type: 'text',
    field: 'team',
  },
]

// Total visible steps including bank details
const TOTAL_STEPS = PROFILE_STEPS.length + 1 // 4

const ALL_STEP_LABELS = [...PROFILE_STEPS.map(s => s.label), 'Bank Details']

const COUNTRY_CODES = [
  { code: '+91',  flag: '🇮🇳', name: 'India' },
  { code: '+1',   flag: '🇺🇸', name: 'USA' },
  { code: '+44',  flag: '🇬🇧', name: 'UK' },
  { code: '+971', flag: '🇦🇪', name: 'UAE' },
  { code: '+65',  flag: '🇸🇬', name: 'Singapore' },
  { code: '+61',  flag: '🇦🇺', name: 'Australia' },
  { code: '+49',  flag: '🇩🇪', name: 'Germany' },
  { code: '+33',  flag: '🇫🇷', name: 'France' },
  { code: '+81',  flag: '🇯🇵', name: 'Japan' },
  { code: '+86',  flag: '🇨🇳', name: 'China' },
]

// ── Main page ─────────────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const router = useRouter()

  // Profile state (steps 0-2)
  const [profile, setProfile]       = useState<any>(null)
  const [step, setStep]             = useState(0)
  const [values, setValues]         = useState({ phone: '', organization: '', team: '' })
  const [countryCode, setCountryCode] = useState('+91')
  const [ccOpen, setCcOpen]         = useState(false)
  const [saving, setSaving]         = useState(false)
  const [error, setError]           = useState('')
  const [done, setDone]             = useState(false)

  // Bank details state (step 3)
  const [bankValues, setBankValues] = useState({
    accountName:    '',
    accountNumber:  '',
    confirmAccount: '',
    ifsc:           '',
  })
  const [bankError,  setBankError]  = useState('')
  const [savingBank, setSavingBank] = useState(false)

  // ── Load profile ─────────────────────────────────────────────────────────────

  useEffect(() => {
    fetch('/api/user/profile')
      .then(r => r.json())
      .then(d => {
        setProfile(d)
        const savedPhone: string = d.phone || ''
        const matchedCC = COUNTRY_CODES.find(c => savedPhone.startsWith(c.code))
        if (matchedCC) {
          setCountryCode(matchedCC.code)
          setValues({ phone: savedPhone.slice(matchedCC.code.length), organization: d.organization || '', team: d.team || '' })
        } else {
          setValues({ phone: savedPhone, organization: d.organization || '', team: d.team || '' })
        }
        // Jump to first incomplete step
        if (d.phone) {
          if (d.organization) {
            if (d.team) {
              // All profile steps done — go to bank step if bank not verified
              if (d.bank_verified) {
                router.replace('/')
              } else {
                setStep(3)
              }
            } else {
              setStep(2)
            }
          } else {
            setStep(1)
          }
        } else {
          setStep(0)
        }
      })
      .catch(() => {})
  }, [router])

  // ── Handle profile steps 0-2 ──────────────────────────────────────────────

  const handleNext = async () => {
    const current = PROFILE_STEPS[step]
    const val = values[current.field as keyof typeof values].trim()
    if (!val) { setError(`${current.label} is required.`); return }
    if (step === 0 && !/^\d{6,15}$/.test(val)) { setError('Enter a valid mobile number (digits only).'); return }
    setError('')

    // Step 2 (team) is the last profile step — save profile then advance to bank step
    if (step === PROFILE_STEPS.length - 1) {
      setSaving(true)
      try {
        const fullPhone = countryCode + values.phone.replace(/\D/g, '')
        const res = await fetch('/api/user/profile', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            full_name:    profile?.full_name,
            phone:        fullPhone,
            organization: values.organization.trim(),
            team:         values.team.trim(),
          }),
        })
        if (!res.ok) {
          const d = await res.json()
          setError(d.error || 'Failed to save. Please try again.')
          return
        }
        // Advance to bank details step
        setStep(3)
      } catch {
        setError('Something went wrong. Please try again.')
      } finally {
        setSaving(false)
      }
    } else {
      setStep(s => s + 1)
    }
  }

  // ── Handle bank details step ──────────────────────────────────────────────

  const handleBankSubmit = async () => {
    const { accountName, accountNumber, confirmAccount, ifsc } = bankValues
    if (!accountName.trim())    { setBankError('Account holder name is required.'); return }
    if (!accountNumber.trim())  { setBankError('Bank account number is required.'); return }
    if (accountNumber !== confirmAccount) { setBankError('Account numbers do not match.'); return }
    if (!/^[A-Za-z]{4}\d{7}$/.test(ifsc.trim())) { setBankError('Enter a valid IFSC code (e.g. SBIN0001234).'); return }
    setBankError('')

    setSavingBank(true)
    try {
      const res = await fetch('/api/cashfree/add-beneficiary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name:        accountName.trim(),
          bankAccount: accountNumber.trim(),
          ifsc:        ifsc.trim().toUpperCase(),
          phone:       (countryCode + values.phone.replace(/\D/g, '')).replace(/\D/g, ''),
          email:       profile?.email ?? '',
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setBankError(data.error ?? 'Failed to save bank details. Please try again.')
        return
      }
      toast.success('Bank details saved successfully!')
      setDone(true)
      setTimeout(() => router.replace('/'), 1600)
    } catch {
      setBankError('Something went wrong. Please try again.')
    } finally {
      setSavingBank(false)
    }
  }

  const handleSkipBank = () => {
    toast('Bank details skipped. You can add them later in Settings.')
    setDone(true)
    setTimeout(() => router.replace('/'), 1200)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && step < 3) handleNext()
  }

  // ── Render helpers ───────────────────────────────────────────────────────────

  const isBankStep = step === 3

  if (!profile) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-[#f7f9fb]">
        <Loader2 className="w-8 h-8 text-slate-400 animate-spin" />
      </div>
    )
  }

  return (
    <>
      <style>{`
        @keyframes fadeUp {
          from { opacity:0; transform:translateY(20px); }
          to   { opacity:1; transform:translateY(0); }
        }
        @keyframes drift1 {
          0%,100% { transform: translate(0,0) scale(1); }
          50%      { transform: translate(40px,-30px) scale(1.06); }
        }
        @keyframes drift2 {
          0%,100% { transform: translate(0,0) scale(1); }
          50%      { transform: translate(-30px,40px) scale(1.04); }
        }
        .fade-step { animation: fadeUp 0.45s ease both; }
        @keyframes checkPop {
          0%   { transform: scale(0.5); opacity: 0; }
          70%  { transform: scale(1.15); }
          100% { transform: scale(1); opacity: 1; }
        }
        .check-pop { animation: checkPop 0.5s ease both; }
      `}</style>

      <div className="h-screen w-screen flex overflow-hidden" style={{ fontFamily: "'Inter','DM Sans',sans-serif" }}>

        {/* ── LEFT — brand panel ─────────────────────────────────────────────── */}
        <section className="hidden lg:flex w-[44%] relative flex-col justify-between p-14 xl:p-20 overflow-hidden"
          style={{ background: 'linear-gradient(135deg,#0f1629 0%,#1a1f3a 50%,#0d1426 100%)' }}>
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            <div className="absolute top-[-10%] left-[-10%] w-[480px] h-[480px] rounded-full opacity-25"
              style={{ background: 'radial-gradient(circle,rgba(99,102,241,0.5) 0%,transparent 70%)', animation: 'drift1 18s ease-in-out infinite' }} />
            <div className="absolute bottom-[-10%] right-[-5%] w-[520px] h-[520px] rounded-full opacity-20"
              style={{ background: 'radial-gradient(circle,rgba(139,92,246,0.45) 0%,transparent 70%)', animation: 'drift2 22s ease-in-out infinite' }} />
          </div>

          <div className="relative z-10 flex items-center gap-3">
            <div>
              <div className="text-xl font-black tracking-tight text-white leading-none">Expify</div>
              <div className="text-[10px] font-semibold tracking-widest uppercase mt-1"
                style={{ color: 'rgba(255,255,255,0.35)' }}>by Fristine Infotech</div>
            </div>
          </div>

          <div className="relative z-10 space-y-6">
            <div className="text-4xl xl:text-5xl font-black leading-tight tracking-tight text-white">
              Almost ready,<br />
              <span style={{ color: '#a5b4fc' }}>{profile?.full_name?.split(' ')[0] || 'there'}.</span>
            </div>
            <p className="text-[15px] leading-relaxed max-w-xs" style={{ color: 'rgba(255,255,255,0.45)' }}>
              Just a few details to personalise your workspace and enable instant reimbursements.
            </p>

            {/* Step dots — 4 steps in one row */}
            <div className="flex items-center gap-0 pt-4">
              {ALL_STEP_LABELS.map((label, i) => (
                <div key={label} className="flex items-center">
                  <div className="flex flex-col items-center gap-1.5">
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold transition-all duration-300"
                      style={i < step
                        ? { background: '#6366f1', color: '#fff' }
                        : i === step
                          ? { background: 'rgba(99,102,241,0.25)', color: '#a5b4fc', border: '1.5px solid rgba(99,102,241,0.5)' }
                          : { background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.3)' }}>
                      {i < step ? '✓' : i + 1}
                    </div>
                    <span className="text-[10px] font-semibold text-center leading-tight max-w-[60px] transition-all"
                      style={{ color: i === step ? '#a5b4fc' : i < step ? 'rgba(255,255,255,0.45)' : 'rgba(255,255,255,0.18)' }}>
                      {label}
                    </span>
                  </div>
                  {i < ALL_STEP_LABELS.length - 1 && (
                    <div className="w-8 h-px mb-5 mx-1" style={{ background: i < step ? 'rgba(99,102,241,0.5)' : 'rgba(255,255,255,0.1)' }} />
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="relative z-10 text-[12px] font-medium" style={{ color: 'rgba(255,255,255,0.2)' }}>
            Your data is encrypted and never shared.
          </div>
        </section>

        {/* ── RIGHT — form panel ────────────────────────────────────────────── */}
        <section className="flex-1 flex flex-col justify-center items-center bg-white px-8 lg:px-16 xl:px-24 relative overflow-hidden">
          <div className="absolute inset-0 pointer-events-none"
            style={{ background: 'radial-gradient(ellipse at 70% 20%,rgba(99,102,241,0.05) 0%,transparent 60%)' }} />

          {/* ── Done screen ── */}
          {done ? (
            <div className="flex flex-col items-center gap-4 text-center check-pop">
              <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8 text-emerald-500" />
              </div>
              <div className="text-2xl font-black text-slate-900">All set!</div>
              <p className="text-slate-400 text-sm">Redirecting you to your dashboard...</p>
            </div>

          ) : isBankStep ? (
            /* ── Bank details step (step 3) ─────────────────────────────── */
            <div className="w-full max-w-[420px] relative z-10 fade-step" key="bank">

              {/* Mobile logo */}
              <div className="flex items-center gap-3 mb-10 lg:hidden">
                <div className="text-lg font-black text-slate-900">Expify</div>
              </div>

              {/* Step counter */}
              <div className="flex items-center gap-2 mb-8">
                <div className="flex gap-1.5">
                  {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
                    <div key={i} className="h-1 rounded-full transition-all duration-500"
                      style={{ width: i === step ? '24px' : '8px', background: i <= step ? '#6366f1' : '#e2e8f0' }} />
                  ))}
                </div>
                <span className="text-[11px] font-semibold text-slate-400 ml-1">
                  Step {step + 1} of {TOTAL_STEPS}
                </span>
              </div>

              {/* Icon */}
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-6"
                style={{ background: 'rgba(99,102,241,0.1)' }}>
                <Landmark size={22} className="text-indigo-500" />
              </div>

              {/* Heading */}
              <div className="mb-6">
                <h2 className="text-2xl font-black text-slate-900 tracking-tight mb-2">Bank Details</h2>
                <p className="text-[14px] text-slate-400 leading-relaxed">
                  Add your bank account to receive expense reimbursements directly.
                </p>
              </div>

              {/* Bank form */}
              <div className="space-y-3">

                {/* Account Holder Name */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 pl-1">
                    Account Holder Name
                  </label>
                  <input
                    type="text"
                    autoFocus
                    placeholder="As printed on bank passbook"
                    value={bankValues.accountName}
                    onChange={e => { setBankValues(v => ({ ...v, accountName: e.target.value })); setBankError('') }}
                    className="w-full px-4 py-3.5 rounded-2xl text-slate-900 font-semibold text-[15px] outline-none transition-all placeholder:text-slate-300"
                    style={{ background: '#f8fafc', border: bankError && !bankValues.accountName ? '2px solid #fca5a5' : '2px solid #e2e8f0' }}
                    onFocus={e => { e.currentTarget.style.borderColor = '#6366f1' }}
                    onBlur={e => { e.currentTarget.style.borderColor = bankError && !bankValues.accountName ? '#fca5a5' : '#e2e8f0' }}
                  />
                </div>

                {/* Bank Account Number */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 pl-1">
                    Bank Account Number
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="e.g. 012345678901"
                    value={bankValues.accountNumber}
                    onChange={e => { setBankValues(v => ({ ...v, accountNumber: e.target.value.replace(/\D/g, '') })); setBankError('') }}
                    className="w-full px-4 py-3.5 rounded-2xl text-slate-900 font-semibold text-[15px] outline-none transition-all placeholder:text-slate-300 tracking-widest"
                    style={{ background: '#f8fafc', border: '2px solid #e2e8f0' }}
                    onFocus={e => { e.currentTarget.style.borderColor = '#6366f1' }}
                    onBlur={e => { e.currentTarget.style.borderColor = '#e2e8f0' }}
                  />
                </div>

                {/* Confirm Account Number */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 pl-1">
                    Confirm Account Number
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="Re-enter account number"
                    value={bankValues.confirmAccount}
                    onChange={e => { setBankValues(v => ({ ...v, confirmAccount: e.target.value.replace(/\D/g, '') })); setBankError('') }}
                    className="w-full px-4 py-3.5 rounded-2xl text-slate-900 font-semibold text-[15px] outline-none transition-all placeholder:text-slate-300 tracking-widest"
                    style={{ background: '#f8fafc', border: bankError?.includes('match') ? '2px solid #fca5a5' : '2px solid #e2e8f0' }}
                    onFocus={e => { e.currentTarget.style.borderColor = '#6366f1' }}
                    onBlur={e => { e.currentTarget.style.borderColor = bankError?.includes('match') ? '#fca5a5' : '#e2e8f0' }}
                    onPaste={e => e.preventDefault()} // prevent paste for security
                  />
                </div>

                {/* IFSC Code */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 pl-1">
                    IFSC Code
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. SBIN0001234"
                    maxLength={11}
                    value={bankValues.ifsc}
                    onChange={e => { setBankValues(v => ({ ...v, ifsc: e.target.value.toUpperCase() })); setBankError('') }}
                    className="w-full px-4 py-3.5 rounded-2xl text-slate-900 font-semibold text-[15px] outline-none transition-all placeholder:text-slate-300 tracking-widest"
                    style={{ background: '#f8fafc', border: bankError?.includes('IFSC') ? '2px solid #fca5a5' : '2px solid #e2e8f0' }}
                    onFocus={e => { e.currentTarget.style.borderColor = '#6366f1' }}
                    onBlur={e => { e.currentTarget.style.borderColor = bankError?.includes('IFSC') ? '#fca5a5' : '#e2e8f0' }}
                  />
                  <p className="text-[11px] text-slate-400 pl-1 mt-1">11-character code found on your cheque book or net banking.</p>
                </div>

                {/* Error */}
                {bankError && (
                  <p className="text-[13px] font-semibold text-red-500 pl-1">{bankError}</p>
                )}

                {/* Save button */}
                <button
                  onClick={handleBankSubmit}
                  disabled={savingBank}
                  className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl font-bold text-white text-[15px] transition-all active:scale-[0.98] disabled:opacity-60 mt-2"
                  style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', boxShadow: '0 8px 24px rgba(99,102,241,0.3)' }}
                >
                  {savingBank ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : (
                    <><ShieldCheck size={18} /> Save Bank Details</>
                  )}
                </button>

                {/* Skip link */}
                <button
                  onClick={handleSkipBank}
                  disabled={savingBank}
                  className="w-full py-3 text-[13px] font-semibold text-slate-400 hover:text-slate-600 transition-colors"
                >
                  Skip for now — add later in Settings
                </button>
              </div>
            </div>

          ) : (
            /* ── Profile steps 0-2 ───────────────────────────────────────── */
            <div className="w-full max-w-[400px] relative z-10 fade-step" key={step}>

              {/* Mobile logo */}
              <div className="flex items-center gap-3 mb-10 lg:hidden">
                <div className="text-lg font-black text-slate-900">Expify</div>
              </div>

              {/* Step counter */}
              <div className="flex items-center gap-2 mb-8">
                <div className="flex gap-1.5">
                  {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
                    <div key={i} className="h-1 rounded-full transition-all duration-500"
                      style={{ width: i === step ? '24px' : '8px', background: i <= step ? '#6366f1' : '#e2e8f0' }} />
                  ))}
                </div>
                <span className="text-[11px] font-semibold text-slate-400 ml-1">
                  Step {step + 1} of {TOTAL_STEPS}
                </span>
              </div>

              {/* Icon */}
              {(() => {
                const current = PROFILE_STEPS[step]
                return (
                  <>
                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-6"
                      style={{ background: 'rgba(99,102,241,0.1)' }}>
                      <current.icon size={22} className="text-indigo-500" />
                    </div>

                    <div className="mb-8">
                      <h2 className="text-2xl font-black text-slate-900 tracking-tight mb-2">{current.label}</h2>
                      <p className="text-[14px] text-slate-400 leading-relaxed">{current.hint}</p>
                    </div>

                    <div className="space-y-4">
                      <div className="relative">
                        {step === 0 ? (
                          <div className="flex gap-2">
                            {/* Country code dropdown */}
                            <div className="relative">
                              <button
                                type="button"
                                onClick={() => setCcOpen(o => !o)}
                                className="flex items-center gap-2 px-4 py-4 rounded-2xl font-semibold text-slate-800 text-[15px] outline-none transition-all whitespace-nowrap"
                                style={{ background: '#f8fafc', border: '2px solid #e2e8f0', minWidth: '100px' }}
                              >
                                <span>{COUNTRY_CODES.find(c => c.code === countryCode)?.flag}</span>
                                <span>{countryCode}</span>
                                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className={`transition-transform ${ccOpen ? 'rotate-180' : ''}`}>
                                  <path d="M2 4l4 4 4-4" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                              </button>
                              {ccOpen && (
                                <div className="absolute top-full left-0 mt-1 w-52 rounded-2xl overflow-hidden z-50 py-1"
                                  style={{ background: '#fff', border: '1.5px solid #e2e8f0', boxShadow: '0 8px 32px rgba(0,0,0,0.1)' }}>
                                  {COUNTRY_CODES.map(c => (
                                    <button key={c.code} type="button"
                                      onClick={() => { setCountryCode(c.code); setCcOpen(false) }}
                                      className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-[13px] font-semibold transition-colors hover:bg-slate-50"
                                      style={{ color: c.code === countryCode ? '#6366f1' : '#334155' }}>
                                      <span className="text-base">{c.flag}</span>
                                      <span>{c.name}</span>
                                      <span className="ml-auto text-slate-400">{c.code}</span>
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                            <input
                              key="phone-number"
                              type="tel"
                              value={values.phone}
                              onChange={e => { setValues(v => ({ ...v, phone: e.target.value.replace(/\D/g, '') })); setError('') }}
                              onKeyDown={handleKeyDown}
                              autoFocus
                              placeholder="9876543210"
                              maxLength={15}
                              className="flex-1 px-5 py-4 rounded-2xl text-slate-900 font-semibold text-[15px] outline-none transition-all placeholder:text-slate-300"
                              style={{ background: '#f8fafc', border: error ? '2px solid #fca5a5' : '2px solid #e2e8f0' }}
                              onFocus={e => { if (!error) e.currentTarget.style.borderColor = '#6366f1' }}
                              onBlur={e => { if (!error) e.currentTarget.style.borderColor = '#e2e8f0' }}
                            />
                          </div>
                        ) : (
                          <input
                            key={current.field}
                            type={current.type}
                            value={values[current.field as keyof typeof values]}
                            onChange={e => { setValues(v => ({ ...v, [current.field]: e.target.value })); setError('') }}
                            onKeyDown={handleKeyDown}
                            autoFocus
                            placeholder={current.placeholder}
                            className="w-full px-5 py-4 rounded-2xl text-slate-900 font-semibold text-[15px] outline-none transition-all placeholder:text-slate-300"
                            style={{ background: '#f8fafc', border: error ? '2px solid #fca5a5' : '2px solid #e2e8f0' }}
                            onFocus={e => { if (!error) e.currentTarget.style.borderColor = '#6366f1' }}
                            onBlur={e => { if (!error) e.currentTarget.style.borderColor = '#e2e8f0' }}
                          />
                        )}
                      </div>

                      {error && <p className="text-[13px] font-semibold text-red-500 pl-1">{error}</p>}

                      <button
                        onClick={handleNext}
                        disabled={saving}
                        className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl font-bold text-white text-[15px] transition-all active:scale-[0.98] disabled:opacity-60"
                        style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', boxShadow: '0 8px 24px rgba(99,102,241,0.3)' }}
                      >
                        {saving
                          ? <Loader2 size={18} className="animate-spin" />
                          : <>{step === PROFILE_STEPS.length - 1 ? 'Continue' : 'Continue'}<ArrowRight size={18} /></>
                        }
                      </button>
                    </div>
                  </>
                )
              })()}

              {/* Mobile step dots */}
              <div className="flex items-center gap-2 mt-8 lg:hidden flex-wrap">
                {ALL_STEP_LABELS.map((label, i) => (
                  <div key={label} className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-all duration-300"
                      style={i < step
                        ? { background: '#6366f1', color: '#fff' }
                        : i === step
                          ? { background: 'rgba(99,102,241,0.15)', color: '#6366f1', border: '1.5px solid #6366f1' }
                          : { background: '#f1f5f9', color: '#94a3b8' }}>
                      {i < step ? '✓' : i + 1}
                    </div>
                    {i < ALL_STEP_LABELS.length - 1 && <div className="w-4 h-px bg-slate-200" />}
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      </div>
    </>
  )
}
