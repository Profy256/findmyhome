'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { authApi } from '@/lib/api'
import { useAuthStore } from '@/lib/store'
import toast from 'react-hot-toast'
import { Eye, EyeOff, CheckCircle, AlertCircle, Info } from 'lucide-react'
import { cn } from '@/lib/utils'

const CATEGORIES = [
  { key: 'land',       label: 'Land',                  desc: 'Sell land plots',              strictness: 'Strict',   color: 'red',   image: '/categories/land.svg' },
  { key: 'apartment',  label: 'Apartments',             desc: 'Sell or rent apartments',      strictness: 'Moderate', color: 'amber', image: '/categories/apartments.svg' },
  { key: 'house',      label: 'Houses',                 desc: 'Sell houses',                  strictness: 'Moderate', color: 'amber', image: '/categories/house.svg' },
  { key: 'rental',     label: 'Rentals',                desc: 'List long-term rentals',       strictness: 'Light',    color: 'green', image: '/categories/rental.svg' },
  { key: 'airbnb',     label: 'Airbnb',                 desc: 'Daily & weekly stays',         strictness: 'Light',    color: 'green', image: '/categories/airbnb.svg' },
  { key: 'lodge',      label: 'Lodges',                 desc: 'List lodges & guest houses',   strictness: 'Light',    color: 'green', image: '/categories/lodge.svg' },
]

const THRESHOLD: Record<string,number> = { land: 95, apartment: 90, house: 90, rental: 80, airbnb: 80, lodge: 80 }

export default function RegisterPage() {
  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm()
  const [showPw, setShowPw]         = useState(false)
  const [role, setRole]             = useState('buyer')
  const [categories, setCategories] = useState<string[]>([])
  const { setAuth } = useAuthStore()
  const router     = useRouter()
  const params     = useSearchParams()

  useEffect(() => {
    const r = params.get('role')
    if (r && ['buyer','seller','company'].includes(r)) setRole(r)
  }, [params])

  const isSeller  = role === 'seller' || role === 'company'
  const strictest = categories.length > 0 ? Math.max(...categories.map(c => THRESHOLD[c] ?? 80)) : null

  const toggleCategory = (key: string) => {
    setCategories(prev => prev.includes(key) ? prev.filter(c => c !== key) : [...prev, key])
  }

  const onSubmit = async (data: any) => {
    if (isSeller && categories.length === 0) {
      toast.error('Please select at least one property category.')
      return
    }
    try {
      const payload = { ...data, role, seller_categories: isSeller ? categories : undefined }
      const res = await authApi.register(payload)
      setAuth(res.data.user, res.data.token)
      toast.success('Account created! Welcome to Find My Home.')
      router.push(isSeller ? '/dashboard/kyc' : '/search')
    } catch (err: any) {
      const errs = err.response?.data?.errors
      if (errs) {
        Object.values(errs).flat().forEach((e: any) => toast.error(e))
      } else {
        toast.error(err.response?.data?.message ?? 'Registration failed.')
      }
    }
  }

  return (
    <div className="min-h-screen bg-paper">
      <div className="max-w-2xl mx-auto px-4 py-12">
        <Link href="/" className="flex items-center gap-2 mb-10">
          <div className="w-7 h-7 bg-ink rounded-md flex items-center justify-center">
            <span className="text-white text-xs font-bold">H</span>
          </div>
          <span className="font-display text-lg font-semibold text-ink">Find My Home</span>
        </Link>

        <h1 className="font-display text-3xl font-light text-ink mb-1">Create your account</h1>
        <p className="text-sm text-stone mb-8">Join Uganda's most trusted property marketplace</p>

        {/* Role selector */}
        <div className="grid grid-cols-3 gap-3 mb-8">
          {[
            { value: 'buyer',   label: 'Buyer',   desc: 'Looking for property',  emoji: '🔍' },
            { value: 'seller',  label: 'Seller',  desc: 'Individual owner',      emoji: '🏠' },
            { value: 'company', label: 'Company', desc: 'Real estate company',   emoji: '🏢' },
          ].map(r => (
            <button key={r.value} type="button" onClick={() => setRole(r.value)}
              className={cn('p-4 rounded-xl border-2 text-left transition-all',
                role === r.value ? 'border-ink bg-white shadow-card' : 'border-sand bg-paper hover:border-stone')}>
              <div className="text-xl mb-2">{r.emoji}</div>
              <div className={cn('text-sm font-semibold', role === r.value ? 'text-ink' : 'text-stone')}>{r.label}</div>
              <div className="text-xs text-dust mt-0.5">{r.desc}</div>
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {role === 'company' && (
            <div>
              <label className="block text-xs font-medium text-ink mb-1.5 uppercase tracking-wide">Company Name</label>
              <input className="input" placeholder="e.g. Prime Estates Uganda"
                {...register('company_name', { required: role === 'company' ? 'Company name is required' : false })} />
              {errors.company_name && <p className="text-red-500 text-xs mt-1">{String(errors.company_name.message)}</p>}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-ink mb-1.5 uppercase tracking-wide">Full Name</label>
            <input className="input" placeholder="Your legal full name"
              {...register('name', { required: 'Full name is required' })} />
            {errors.name && <p className="text-red-500 text-xs mt-1">{String(errors.name.message)}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-ink mb-1.5 uppercase tracking-wide">Email</label>
              <input type="email" className="input" placeholder="you@example.com"
                {...register('email', { required: 'Email is required' })} />
              {errors.email && <p className="text-red-500 text-xs mt-1">{String(errors.email.message)}</p>}
            </div>
            <div>
              <label className="block text-xs font-medium text-ink mb-1.5 uppercase tracking-wide">Phone</label>
              <input className="input" placeholder="+256 7XX XXX XXX"
                {...register('phone', { required: 'Phone is required' })} />
              {errors.phone && <p className="text-red-500 text-xs mt-1">{String(errors.phone.message)}</p>}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-ink mb-1.5 uppercase tracking-wide">Password</label>
            <div className="relative">
              <input type={showPw ? 'text' : 'password'} className="input pr-10" placeholder="At least 8 characters"
                {...register('password', { required: 'Password is required', minLength: { value: 8, message: 'At least 8 characters' } })} />
              <button type="button" onClick={() => setShowPw(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-dust">
                {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {errors.password && <p className="text-red-500 text-xs mt-1">{String(errors.password.message)}</p>}
          </div>

          {/* Category selector — sellers only */}
          {isSeller && (
            <div className="pt-2">
              <div className="text-xs font-bold uppercase tracking-[1.5px] text-ink mb-1">
                What will you be listing? <span className="text-red-400">*</span>
              </div>
              <p className="text-xs text-stone mb-4">Select all that apply. Your KYC verification will be based on the strictest category you choose.</p>

              <div className="space-y-2">
                {CATEGORIES.map(cat => {
                  const selected = categories.includes(cat.key)
                  return (
                    <button key={cat.key} type="button" onClick={() => toggleCategory(cat.key)}
                      className={cn('w-full flex items-center gap-3 p-3.5 rounded-xl border-2 text-left transition-all',
                        selected ? 'border-ink bg-white' : 'border-sand bg-paper hover:border-stone')}>
                      <img
                        src={cat.image}
                        alt={cat.label}
                        className="w-9 h-9 rounded-lg bg-white/70 p-1.5 object-contain flex-shrink-0"
                        loading="lazy"
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className={cn('text-sm font-semibold', selected ? 'text-ink' : 'text-stone')}>{cat.label}</span>
                          <span className={cn('text-[10px] font-bold uppercase px-2 py-0.5 rounded-full',
                            cat.color === 'red'   ? 'bg-red-50 text-red-500' :
                            cat.color === 'amber' ? 'bg-amber-50 text-amber-600' :
                            'bg-green-50 text-green-600')}>
                            {cat.strictness}
                          </span>
                        </div>
                        <p className="text-xs text-dust mt-0.5">{cat.desc}</p>
                      </div>
                      {selected && <CheckCircle className="w-4 h-4 text-ink flex-shrink-0" />}
                    </button>
                  )
                })}
              </div>

              {/* KYC level indicator */}
              {strictest !== null && (
                <div className={cn('mt-4 p-3.5 rounded-xl border flex gap-2.5',
                  strictest >= 95 ? 'bg-red-50 border-red-200' :
                  strictest >= 90 ? 'bg-amber-50 border-amber-200' :
                  'bg-green-50 border-green-200')}>
                  {strictest >= 95 ? <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" /> :
                   strictest >= 90 ? <Info className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" /> :
                   <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />}
                  <p className={cn('text-xs leading-relaxed',
                    strictest >= 95 ? 'text-red-700' : strictest >= 90 ? 'text-amber-700' : 'text-green-700')}>
                    {strictest >= 95
                      ? 'You have selected Land. We are very strict on land sellers. A clear National ID is required, and you must upload a land title for every land listing you post. This protects buyers from fraud.'
                      : strictest >= 90
                      ? 'You have selected Apartments. We are moderately strict. A clear National ID or Passport is required.'
                      : 'Light verification required. A clear National ID or Passport is all you need to get verified.'}
                  </p>
                </div>
              )}
            </div>
          )}

          <button type="submit" disabled={isSubmitting} className="btn-primary w-full py-3.5 mt-2">
            {isSubmitting ? 'Creating account...' : 'Create Account'}
          </button>
        </form>

        <p className="text-sm text-stone text-center mt-6">
          Already have an account?{' '}<Link href="/auth/login" className="text-ink font-medium hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  )
}
