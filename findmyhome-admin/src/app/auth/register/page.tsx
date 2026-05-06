import Link from 'next/link'
import { Home, ShieldAlert } from 'lucide-react'

export default function RegisterPage() {
  return (
    <div className="min-h-screen bg-paper flex items-center justify-center p-6">
      <div className="w-full max-w-md text-center">
        <Link href="/" className="inline-flex items-center gap-2 mb-10">
          <div className="w-7 h-7 bg-ink rounded-md flex items-center justify-center">
            <Home className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="font-display text-lg font-semibold text-ink">Find My Home</span>
        </Link>

        <div className="bg-white border border-sand rounded-2xl p-8 shadow-card">
          <div className="flex justify-center mb-4">
            <ShieldAlert className="w-10 h-10 text-stone" />
          </div>
          <h1 className="font-display text-2xl font-semibold text-ink mb-2">Admin accounts are by invitation only</h1>
          <p className="text-sm text-stone mb-6 leading-relaxed">
            New admin accounts must be created by an existing platform administrator. If you need access, contact your platform administrator.
          </p>
          <Link href="/auth/login" className="btn-primary w-full py-3 inline-block text-center">
            Go to login
          </Link>
        </div>
      </div>
    </div>
  )
}
