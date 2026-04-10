'use client'

import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Suspense } from 'react'

function AuthErrorContent() {
  const params = useSearchParams()
  const errorCode = params.get('error_code')
  const errorDesc = params.get('error_description')

  const isDbError =
    errorCode === 'unexpected_failure' ||
    errorDesc?.toLowerCase().includes('database')

  return (
    <div className="h-screen w-screen flex items-center justify-center bg-[#f7f9fb]">
      <div className="max-w-md w-full mx-4 bg-white rounded-3xl shadow-sm border border-slate-100 p-10 text-center">

        <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-6">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>

        <h1 className="text-2xl font-black text-slate-900 mb-2">Sign-in failed</h1>

        <p className="text-[14px] text-slate-500 mb-2">
          {isDbError
            ? 'We could not create your account due to a database error. This is usually a one-time issue.'
            : 'Something went wrong during sign-in. Please try again.'}
        </p>

        {errorDesc && (
          <p className="text-[12px] font-mono text-slate-400 bg-slate-50 rounded-xl px-4 py-2 mb-6 break-words">
            {decodeURIComponent(errorDesc)}
          </p>
        )}

        <Link
          href="/login"
          className="inline-flex items-center justify-center gap-2 w-full py-3.5 rounded-2xl font-bold text-white text-[15px] transition-all active:scale-[0.98]"
          style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)' }}
        >
          Back to Login
        </Link>

        <p className="text-[12px] text-slate-400 mt-4">
          If this keeps happening, contact your administrator.
        </p>
      </div>
    </div>
  )
}

export default function AuthCodeErrorPage() {
  return (
    <Suspense fallback={
      <div className="h-screen w-screen flex items-center justify-center bg-[#f7f9fb]" />
    }>
      <AuthErrorContent />
    </Suspense>
  )
}
