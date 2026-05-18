'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { API_URL, authApi, isNetworkError } from '@/lib/api'
import { useAuthStore } from '@/lib/store'
import toast from 'react-hot-toast'
import { Eye, EyeOff, Home } from 'lucide-react'

export default function LoginPage() {
  const { register, handleSubmit, watch, formState: { errors, isSubmitting, isValid } } = useForm({ mode: 'onChange' })
  const [showPw, setShowPw] = useState(false)
  const { setAuth } = useAuthStore()
  const router = useRouter()

  const email = watch('email')
  const password = watch('password')

  const onSubmit = async (data: any) => {
    try {
      const res = await authApi.login(data)
      setAuth(res.data.user, res.data.token)
      toast.success(`Welcome back, ${res.data.user.name.split(' ')[0]}!`)
      const role = res.data.user.role
      if (role === 'sub_admin') {
        toast.error('Sub-admins must use the sub-admin portal.')
        return
      }
      router.push(role === 'admin' ? '/admin' : role === 'buyer' ? '/search' : '/dashboard')
    } catch (err: any) {
      if (isNetworkError(err)) {
        toast.error(`Cannot reach API (${API_URL}). Make sure the backend is running and CORS allows this origin.`)
        return
      }
      const errorData = err.response?.data;
      if (errorData?.errors) {
        const firstErrorKey = Object.keys(errorData.errors)[0];
        toast.error(errorData.errors[firstErrorKey][0]);
      } else {
        toast.error(errorData?.message || err.message || 'Login failed.');
      }
    }
  }

  return (
    <div className="min-h-screen bg-paper flex">
      <div className="hidden lg:flex w-1/2 bg-ink items-center justify-center relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.04]"
          style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,.6) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.6) 1px,transparent 1px)', backgroundSize: '60px 60px' }} />
        <div className="relative z-10 text-center px-12">
          <div className="font-display text-5xl font-light text-white mb-4">Find My <span className="text-gold-2 italic">Home</span></div>
          <p className="text-white/45 font-light text-base leading-relaxed max-w-xs mx-auto">Uganda&apos;s most trusted real estate marketplace.</p>
        </div>
      </div>
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <Link href="/" className="flex items-center gap-2 mb-10 lg:hidden">
            <div className="w-7 h-7 bg-ink rounded-md flex items-center justify-center"><Home className="w-3.5 h-3.5 text-white" /></div>
            <span className="font-display text-lg font-semibold text-ink">Find My Home</span>
          </Link>
          <h1 className="font-display text-3xl font-light text-ink mb-1">Welcome back</h1>
          <p className="text-sm text-stone mb-8">Sign in to your account</p>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-ink mb-1.5 uppercase tracking-wide">Email</label>
              <input
                type="email"
                placeholder="you@example.com"
                className="input"
                autoComplete="email"
                inputMode="email"
                spellCheck={false}
                {...register('email', {
                  required: 'Email is required',
                  pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Enter a valid email address.' },
                })}
              />
              {errors.email && <p className="text-red-500 text-xs mt-1">{String(errors.email.message)}</p>}
              {!errors.email && email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email)) && <p className="text-forest text-xs mt-1">Looks good.</p>}
            </div>
            <div>
              <label className="block text-xs font-medium text-ink mb-1.5 uppercase tracking-wide">Password</label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  placeholder="Your password"
                  className="input pr-10"
                  autoComplete="current-password"
                  {...register('password', {
                    required: 'Password is required',
                    minLength: { value: 8, message: 'Password must be at least 8 characters.' },
                  })}
                />
                <button type="button" onClick={() => setShowPw(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-dust">
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.password && <p className="text-red-500 text-xs mt-1">{String(errors.password.message)}</p>}
              {!errors.password && password && String(password).length >= 8 && <p className="text-forest text-xs mt-1">Looks good.</p>}
            </div>
            <button type="submit" disabled={isSubmitting || !isValid} className="btn-primary w-full py-3.5 mt-2">
              {isSubmitting ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
          <p className="text-sm text-stone text-center mt-6">
            Don&apos;t have an account?{' '}<Link href="/auth/register" className="text-ink font-medium hover:underline">Create one</Link>
          </p>

        </div>
      </div>
    </div>
  )
}
