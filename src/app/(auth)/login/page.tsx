'use client'

import { createClient } from '@/utils/supabase/client'
import { Brain, Zap, Shield, ArrowRight } from 'lucide-react'
import Image from 'next/image'

function GoogleIcon() {
  return (
    <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  )
}

const features = [
  {
    icon: Brain,
    title: 'AI-Powered Auditing',
    desc: 'Smart expense verification against 9 policy rules in seconds.',
  },
  {
    icon: Zap,
    title: 'Instant Processing',
    desc: 'Submit via WhatsApp and get reimbursed faster than ever.',
  },
  {
    icon: Shield,
    title: 'Policy Compliance',
    desc: 'Every claim auto-checked against your company policy.',
  },
]

export default function LoginPage() {
  const supabase = createClient()

  const handleSignIn = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
  }

  return (
    <>
      <style>{`
        @keyframes blob1 {
          0%,100% { transform: translate(0,0) scale(1); }
          50%      { transform: translate(40px,-30px) scale(1.08); }
        }
        @keyframes blob2 {
          0%,100% { transform: translate(0,0) scale(1); }
          50%      { transform: translate(-30px,40px) scale(1.05); }
        }
        @keyframes fadeSlideDown {
          from { opacity:0; transform:translateY(-20px); }
          to   { opacity:1; transform:translateY(0); }
        }
        @keyframes fadeSlideLeft {
          from { opacity:0; transform:translateX(-30px); }
          to   { opacity:1; transform:translateX(0); }
        }
        @keyframes fadeSlideUp {
          from { opacity:0; transform:translateY(20px); }
          to   { opacity:1; transform:translateY(0); }
        }
        .anim-brand  { animation: fadeSlideDown 0.6s ease both 0.05s; }
        .anim-f0     { animation: fadeSlideLeft 0.55s ease both 0.20s; }
        .anim-f1     { animation: fadeSlideLeft 0.55s ease both 0.35s; }
        .anim-f2     { animation: fadeSlideLeft 0.55s ease both 0.50s; }
        .anim-copy   { animation: fadeSlideLeft 0.55s ease both 0.65s; }
        .anim-head   { animation: fadeSlideUp 0.55s ease both 0.10s; }
        .anim-form   { animation: fadeSlideUp 0.55s ease both 0.22s; }
        .anim-footer { animation: fadeSlideUp 0.55s ease both 0.34s; }
        .text-gradient-brand {
          background: linear-gradient(135deg, #818cf8 0%, #c084fc 100%);
          background-clip: text;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }
        .btn-google { transition: background 0.15s, box-shadow 0.15s, transform 0.1s; }
        .btn-google:hover { background: #f1f5f9 !important; box-shadow: 0 4px 20px rgba(0,0,0,0.10) !important; }
        .btn-google:active { transform: scale(0.98); }
      `}</style>

      <div className="flex min-h-screen" style={{ fontFamily: "'Inter','DM Sans',sans-serif" }}>

        {/* LEFT PANEL */}
        <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden"
          style={{ background: 'linear-gradient(135deg,#0f1629 0%,#1a1f3a 55%,#0d1426 100%)' }}>

          {/* Blobs */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden" style={{ opacity: 0.12 }}>
            <div className="absolute top-20 left-20 w-72 h-72 rounded-full"
              style={{ background: 'hsl(239 84% 67%)', filter: 'blur(100px)', animation: 'blob1 18s ease-in-out infinite' }} />
            <div className="absolute bottom-20 right-20 w-96 h-96 rounded-full"
              style={{ background: 'hsl(217 91% 60%)', filter: 'blur(120px)', animation: 'blob2 22s ease-in-out infinite' }} />
          </div>

          <div className="relative z-10 flex flex-col justify-between p-12 w-full">

            {/* Brand */}
            <div className="anim-brand">
              <div className="flex items-center gap-3">
                <h1 className="text-3xl font-bold tracking-tight">
                  <span className="text-gradient-brand">Expify</span>
                </h1>
              </div>
            </div>

            {/* Features */}
            <div className="space-y-8">
              {features.map((f, i) => (
                <div key={f.title} className={`flex items-start gap-4 anim-f${i}`}>
                  <div className="shrink-0 w-10 h-10 rounded-lg flex items-center justify-center"
                    style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)' }}>
                    <f.icon className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm" style={{ color: '#f1f5f9' }}>{f.title}</h3>
                    <p className="text-sm mt-0.5" style={{ color: 'hsl(220 14% 60%)' }}>{f.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Copyright */}
            <p className="text-xs anim-copy" style={{ color: 'hsl(220 14% 45%)' }}>
              © 2026 Expify · by Fristine Infotech. AI-powered expense management.
            </p>
          </div>
        </div>

        {/* RIGHT PANEL */}
        <div className="flex-1 flex items-center justify-center p-8 bg-white">
          <div className="w-full max-w-sm space-y-8">

            {/* Mobile brand */}
            <div className="lg:hidden flex items-center gap-3 mb-8">
              <Image src="/Fristine Infotech.png" alt="Fristine Infotech" width={36} height={36}
                className="rounded-xl object-contain" />
              <h1 className="text-2xl font-bold">
                <span className="text-gradient-brand">Expify</span>
              </h1>
            </div>

            {/* Heading */}
            <div className="anim-head text-center">
              <h2 className="text-2xl font-bold" style={{ color: '#0f172a' }}>Welcome back</h2>
              <p className="mt-1 text-sm" style={{ color: '#64748b' }}>Sign in to manage your expenses</p>
            </div>

            {/* Sign in */}
            <div className="space-y-4 anim-form">
              <button
                onClick={handleSignIn}
                className="btn-google group w-full flex items-center gap-3 h-11 px-5 rounded-xl font-medium text-sm"
                style={{
                  background: '#f8fafc',
                  border: '1.5px solid #e2e8f0',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                  color: '#1e293b',
                }}>
                <GoogleIcon />
                <span>Sign in with Google</span>
                <ArrowRight size={15} className="ml-auto text-slate-400 group-hover:translate-x-0.5 transition-transform" />
              </button>

              <div className="flex items-center gap-3">
                <div className="flex-1 h-px" style={{ background: '#f1f5f9' }} />
                <span className="text-xs font-medium" style={{ color: '#94a3b8' }}>SSO enabled</span>
                <div className="flex-1 h-px" style={{ background: '#f1f5f9' }} />
              </div>
            </div>

            {/* Footer */}
            <p className="text-center text-sm anim-footer" style={{ color: '#94a3b8' }}>
              Don&apos;t have an account?{' '}
              <a href="#" className="font-medium" style={{ color: '#6366f1' }}>
                Contact admin
              </a>
            </p>

          </div>
        </div>

      </div>
    </>
  )
}
