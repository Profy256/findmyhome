'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import api from '@/lib/api'
import toast from 'react-hot-toast'

export default function ForgotPasswordPage() {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm()
  const [sent, setSent] = useState(false)

  const onSubmit = async (data: any) => {
    try {
      await api.post('/forgot-password', data)
      setSent(true)
      toast.success('Reset link sent to your email.')
    } catch {
      toast.error('Could not find an account with that email.')
    }
  }

  return (
    <div className="min-h-screen bg-paper flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <Link href="/auth/login" className="text-xs text-stone hover:text-ink mb-8 block">← Back to login</Link>
        <h1 className="font-display text-3xl font-light text-ink mb-2">Reset password</h1>
        <p className="text-sm text-stone mb-8">Enter your email and we'll send you a reset link.</p>

        {sent ? (
          <div className="bg-green-50 border border-green-200 rounded-xl p-5 text-center">
            <div className="text-3xl mb-3">📧</div>
            <p className="text-sm font-semibold text-green-700">Reset link sent!</p>
            <p className="text-xs text-green-600 mt-2">Check your email and follow the link to reset your password.</p>
            <Link href="/auth/login" className="block mt-4 text-sm text-green-700 underline">Back to login</Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-ink mb-1.5 uppercase tracking-wide">Email</label>
              <input type="email" placeholder="you@example.com" className="input"
                {...register('email', { required: 'Email is required' })} />
              {errors.email && <p className="text-red-500 text-xs mt-1">{String(errors.email.message)}</p>}
            </div>
            <button type="submit" disabled={isSubmitting} className="btn-primary w-full py-3.5">
              {isSubmitting ? 'Sending...' : 'Send Reset Link'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
