'use client'

import { createClient } from '@/utils/supabase/client'

function GoogleColorIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="h-5 w-5 shrink-0">
      <path fill="#EA4335" d="M24 9.5c3.14 0 5.95 1.08 8.17 2.85l6.08-6.08C34.46 3.05 29.5 1 24 1 14.82 1 7.01 6.48 3.58 14.24l7.08 5.5C12.35 13.64 17.7 9.5 24 9.5z"/>
      <path fill="#4285F4" d="M46.52 24.5c0-1.64-.15-3.22-.42-4.75H24v9h12.68c-.55 2.96-2.2 5.47-4.67 7.14l7.18 5.58C43.27 37.3 46.52 31.34 46.52 24.5z"/>
      <path fill="#FBBC05" d="M10.66 28.26A14.56 14.56 0 0 1 9.5 24c0-1.48.26-2.91.66-4.26l-7.08-5.5A23.93 23.93 0 0 0 0 24c0 3.87.92 7.53 2.55 10.75l8.11-6.49z"/>
      <path fill="#34A853" d="M24 47c5.5 0 10.12-1.82 13.49-4.93l-7.18-5.58C28.5 38.3 26.38 39 24 39c-6.3 0-11.65-4.14-13.34-9.74l-8.11 6.49C6.01 43.52 14.42 47 24 47z"/>
      <path fill="none" d="M0 0h48v48H0z"/>
    </svg>
  )
}

export default function LoginPage() {
  const supabase = createClient()

  const handleSignIn = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })
  }

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-[#131314] font-sans">
      <div className="flex w-[400px] flex-col items-center justify-center rounded-2xl border border-[#2d2e2f] bg-[#1e1f20] px-12 py-10 shadow-2xl">

        {/* Wordmark */}
        <p className="mb-1 text-center text-[30px] font-normal tracking-wide text-[#e3e3e3]">
          Expify <br/> <span className="text-[#c9d1d9] text-[20px]">Expense Management</span>
        </p>

        {/* Google Button */}
        <button
          onClick={handleSignIn}
          className="mt-8 flex w-full items-center justify-center gap-3 rounded-full border border-[#3c4043] bg-[#2d2e2f] px-6 py-[11px] text-sm font-medium text-[#e3e3e3] transition-all duration-150 hover:border-[#5f6368] hover:bg-[#36373a] active:scale-[0.98]"
        >
          <GoogleColorIcon />
          <span>Continue with Google</span>
        </button>

        {/* Divider */}
        <div className="my-6 flex w-full items-center gap-3">
          <div className="h-px flex-1 bg-[#3c4043]" />
          <span className="text-xs text-[#5f6368]">or</span>
          <div className="h-px flex-1 bg-[#3c4043]" />
        </div>

        {/* Hint */}
        <p className="text-center text-xs leading-relaxed text-[#5f6368]">
          Use your Google Account to sign in securely.
          <br />
          No password needed.
        </p>
      </div>
    </div>
  )
}