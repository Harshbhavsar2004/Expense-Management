import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const pathname = request.nextUrl.pathname

  const isAuthRoute       = pathname.startsWith('/login') || pathname.startsWith('/auth')
  const isOnboarding      = pathname.startsWith('/onboarding')
  const isProtectedRoute  = pathname.startsWith('/admin') ||
                            pathname.startsWith('/expenses') ||
                            pathname.startsWith('/chat') ||
                            pathname.startsWith('/applications') ||
                            pathname.startsWith('/settings') ||
                            pathname === '/'

  // 1. Unauthenticated users cannot access protected routes
  if (!user && isProtectedRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // 2. Authenticated users on login/auth pages → send to dashboard
  if (user && isAuthRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    return NextResponse.redirect(url)
  }

  // 3. Profile completeness gate — redirect to onboarding if profile is incomplete
  //    Only check on protected routes; skip for onboarding itself (avoid redirect loop)
  if (user && isProtectedRoute && !isOnboarding) {
    const { data: profile } = await supabase
      .from('users')
      .select('phone, organization, team')
      .eq('id', user.id)
      .single()

    if (!profile?.phone || !profile?.organization || !profile?.team) {
      const url = request.nextUrl.clone()
      url.pathname = '/onboarding'
      return NextResponse.redirect(url)
    }
  }

  // 4. Role-based access: /admin routes require role = 'admin'
  if (user && pathname.startsWith('/admin')) {
    const { data: userData } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!userData || userData.role !== 'admin') {
      const url = request.nextUrl.clone()
      url.pathname = '/'
      return NextResponse.redirect(url)
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
