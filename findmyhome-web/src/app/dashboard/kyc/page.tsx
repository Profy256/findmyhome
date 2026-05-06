'use client'
import { useState, useEffect, useRef } from 'react'
import { useAuthStore } from '@/lib/store'
import { kycApi } from '@/lib/api'
import toast from 'react-hot-toast'
import { Upload, CheckCircle2, Clock, XCircle, AlertTriangle, FileText } from 'lucide-react'
import axios from 'axios'

const DOC_TYPES: Record<string, string> = {
  national_id:           'National ID',
  passport:              'Passport',
  drivers_licence:       "Driver's Licence",
  business_registration: 'Business Registration Certificate',
}

const STATUS_CONFIG: Record<string, { icon: any, color: string, label: string }> = {
  verified: { icon: CheckCircle2, color: 'text-forest-2',  label: 'Verified' },
  pending:  { icon: Clock,        color: 'text-amber-600', label: 'Under Review' },
  rejected: { icon: XCircle,      color: 'text-red-500',   label: 'Rejected' },
}

export default function KycPage() {
  const { user, setAuth } = useAuthStore()
  const [status,    setStatus]   = useState<any>(null)
  const [uploading, setUploading]= useState(false)
  const [docType,   setDocType]  = useState('national_id')
  const [loading,   setLoading]  = useState(true)
  const fileRef = useRef<HTMLInputElement>(null)

  const CLOUD = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
  const PRESET= process.env.NEXT_PUBLIC_CLOUDINARY_KYC_PRESET

  const fetchStatus = async () => {
    const res = await kycApi.status()
    setStatus(res.data)
    setLoading(false)
  }

  useEffect(() => { fetchStatus() }, [])

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const maxMB = 10
    if (file.size > maxMB * 1024 * 1024) { toast.error(`File must be under ${maxMB}MB.`); return }

    setUploading(true)
    try {
      // Upload to Cloudinary
      const form = new FormData()
      form.append('file', file)
      form.append('upload_preset', PRESET ?? 'findmyhome_kyc')
      form.append('folder', 'kyc')

      const cldRes = await axios.post(
        `https://api.cloudinary.com/v1_1/${CLOUD}/raw/upload`,
        form
      )

      const { secure_url, public_id } = cldRes.data

      // Submit to our API
      await kycApi.upload({ document_type: docType, file_url: secure_url, cloudinary_public_id: public_id })
      toast.success('Document uploaded! We are reviewing it now.')
      await fetchStatus()
    } catch (err: any) {
      toast.error(err.response?.data?.message ?? 'Upload failed. Please try again.')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  if (loading) return <div className="animate-pulse"><div className="h-8 w-48 bg-sand rounded mb-4" /><div className="h-40 bg-sand rounded" /></div>

  const isCompany  = user?.role === 'company'
  const isVerified = status?.kyc_status === 'verified'

  const allowedDocs = isCompany
    ? Object.keys(DOC_TYPES)
    : ['national_id', 'passport', 'drivers_licence']

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-display text-3xl font-light text-ink mb-1">Identity Verification</h1>
        <p className="text-sm text-stone">Verify your identity to start listing properties on Find My Home.</p>
      </div>

      {/* Status banner */}
      {isVerified ? (
        <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-xl mb-6">
          <CheckCircle2 className="w-5 h-5 text-forest-2 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-forest-2">Identity Verified ✓</p>
            <p className="text-xs text-stone">You can list properties and receive leads from buyers.</p>
          </div>
        </div>
      ) : status?.kyc_status === 'pending' ? (
        <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl mb-6">
          <Clock className="w-5 h-5 text-amber-600 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-amber-700">Verification in Progress</p>
            <p className="text-xs text-stone">Our AI is reviewing your document. You will be notified within minutes.</p>
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl mb-6">
          <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-700">Verification Required</p>
            <p className="text-xs text-stone">Upload your identity document below. Verification is free and takes a few minutes.</p>
          </div>
        </div>
      )}

      {/* Requirements */}
      <div className="card p-5 mb-6">
        <h2 className="text-xs font-bold uppercase tracking-wide text-dust mb-3">What You Need</h2>
        <div className="space-y-2">
          {isCompany ? (
            <>
              <div className="flex items-start gap-2 text-sm text-stone">
                <span className="text-amber-500 mt-0.5">1.</span>
                <span><strong className="text-ink">Business Registration Certificate</strong> from Uganda Registration Services Bureau (URSB)</span>
              </div>
              <div className="flex items-start gap-2 text-sm text-stone">
                <span className="text-amber-500 mt-0.5">2.</span>
                <span><strong className="text-ink">Director's National ID, Passport, or Driver's Licence</strong></span>
              </div>
              <p className="text-xs text-stone mt-2 pl-5">Both documents must be verified before your company account is fully activated.</p>
            </>
          ) : (
            <div className="flex items-start gap-2 text-sm text-stone">
              <CheckCircle2 className="w-4 h-4 text-forest-2 flex-shrink-0 mt-0.5" />
              <span><strong className="text-ink">National ID, Passport, or Driver's Licence</strong> — a clear, well-lit photo of your document</span>
            </div>
          )}
        </div>

        {/* KYC level info based on categories */}
        {status?.requirements?.note && (
          <div className="mt-3 pt-3 border-t border-sand">
            <p className="text-xs text-stone">{status.requirements.note}</p>
          </div>
        )}
      </div>

      {/* Upload form */}
      {!isVerified && (
        <div className="card p-5 mb-6">
          <h2 className="text-xs font-bold uppercase tracking-wide text-dust mb-4">Upload Document</h2>

          <div className="mb-4">
            <label className="text-xs font-semibold uppercase tracking-wide text-dust block mb-1.5">Document Type</label>
            <select value={docType} onChange={e => setDocType(e.target.value)} className="input">
              {allowedDocs.map(k => <option key={k} value={k}>{DOC_TYPES[k]}</option>)}
            </select>
          </div>

          <input ref={fileRef} type="file" accept="image/*,.pdf" onChange={handleUpload} className="hidden" />

          <button onClick={() => fileRef.current?.click()} disabled={uploading}
            className={`w-full border-2 border-dashed rounded-xl py-8 flex flex-col items-center gap-3 transition-all
              ${uploading ? 'border-sand bg-sand cursor-not-allowed' : 'border-sand hover:border-ink cursor-pointer'}`}>
            {uploading ? (
              <>
                <div className="w-8 h-8 border-2 border-ink border-t-transparent rounded-full animate-spin" />
                <span className="text-sm text-stone">Uploading and analysing…</span>
              </>
            ) : (
              <>
                <Upload className="w-8 h-8 text-dust" />
                <div className="text-sm text-stone text-center">
                  <span className="font-semibold text-ink">Click to upload</span> your {DOC_TYPES[docType]}
                  <br />
                  <span className="text-xs">JPG, PNG, or PDF — max 10MB — Make sure it is clear and readable</span>
                </div>
              </>
            )}
          </button>
        </div>
      )}

      {/* Submitted documents */}
      {status?.documents?.length > 0 && (
        <div className="card p-5">
          <h2 className="text-xs font-bold uppercase tracking-wide text-dust mb-4">Submitted Documents</h2>
          <div className="space-y-3">
            {status.documents.map((doc: any) => {
              const cfg = STATUS_CONFIG[doc.status] ?? STATUS_CONFIG.pending
              const Icon = cfg.icon
              return (
                <div key={doc.id} className="flex items-start gap-3 p-3 bg-cream rounded-lg">
                  <FileText className="w-5 h-5 text-stone flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-ink">{DOC_TYPES[doc.document_type] ?? doc.document_type}</p>
                    {doc.rejection_reason && (
                      <p className="text-xs text-red-500 mt-0.5">{doc.rejection_reason}</p>
                    )}
                    <p className="text-xs text-dust mt-0.5">Submitted {new Date(doc.created_at).toLocaleDateString()}</p>
                  </div>
                  <div className={`flex items-center gap-1 text-xs font-semibold ${cfg.color}`}>
                    <Icon className="w-3.5 h-3.5" />
                    {cfg.label}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
