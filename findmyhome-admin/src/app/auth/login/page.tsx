'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { authApi } from '@/lib/api'
import { useAuthStore } from '@/lib/store'
import toast from 'react-hot-toast'
import { Eye, EyeOff, Home } from 'lucide-react'

export default function LoginPage() {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm()
  const [showPw, setShowPw] = useState(false)
  const { setAuth } = useAuthStore()
  const router = useRouter()

  const onSubmit = async (data: any) => {
    try {
      const res = await authApi.login(data)
      setAuth(res.data.user, res.data.token)
      toast.success(`Welcome back, ${res.data.user.name.split(' ')[0]}!`)
      const role = res.data.user.role
      router.push(role === 'admin' ? '/admin' : role === 'buyer' ? '/search' : '/dashboard')
    } catch (err: any) {
      toast.error(err.response?.data?.errors?.email?.[0] ?? err.response?.data?.message ?? 'Login failed.')
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
              <input type="email" placeholder="you@example.com" className="input" {...register('email', { required: 'Email is required' })} />
              {errors.email && <p className="text-red-500 text-xs mt-1">{String(errors.email.message)}</p>}
            </div>
            <div>
              <label className="block text-xs font-medium text-ink mb-1.5 uppercase tracking-wide">Password</label>
              <div className="relative">
                <input type={showPw ? 'text' : 'password'} placeholder="Your password" className="input pr-10" {...register('password', { required: 'Password is required' })} />
                <button type="button" onClick={() => setShowPw(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-dust">
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.password && <p className="text-red-500 text-xs mt-1">{String(errors.password.message)}</p>}
            </div>
            <button type="submit" disabled={isSubmitting} className="btn-primary w-full py-3.5 mt-2">
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
