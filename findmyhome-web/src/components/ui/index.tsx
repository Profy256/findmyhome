'use client'
import { cn } from '@/lib/utils'
import { Loader2, LucideIcon } from 'lucide-react'

// ── Badge ─────────────────────────────────────────────────────────────────────
interface BadgeProps { label: string; color?: 'green'|'red'|'amber'|'blue'|'grey'|'gold'; className?: string }
export function Badge({ label, color = 'grey', className }: BadgeProps) {
  const colors = {
    green: 'bg-green-50 text-green-700 border-green-200',
    red:   'bg-red-50 text-red-600 border-red-200',
    amber: 'bg-amber-50 text-amber-700 border-amber-200',
    blue:  'bg-blue-50 text-blue-600 border-blue-200',
    grey:  'bg-stone/10 text-stone border-sand',
    gold:  'bg-gold/10 text-gold border-gold/30',
  }
  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border', colors[color], className)}>
      {label}
    </span>
  )
}

// ── KYC Status Badge ──────────────────────────────────────────────────────────
export function KycBadge({ status }: { status: string }) {
  const map: Record<string, [string, BadgeProps['color']]> = {
    verified: ['Verified ✓', 'green'],
    pending:  ['Pending', 'amber'],
    rejected: ['Rejected', 'red'],
    blocked:  ['Blocked', 'red'],
    none:     ['Not Started', 'grey'],
  }
  const [label, color] = map[status] ?? ['Unknown', 'grey']
  return <Badge label={label} color={color} />
}

// ── Spinner ───────────────────────────────────────────────────────────────────
export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn('animate-spin text-stone', className)} />
}

// ── Page loader ───────────────────────────────────────────────────────────────
export function PageLoader() {
  return (
    <div className="flex items-center justify-center py-32">
      <Spinner className="w-8 h-8" />
    </div>
  )
}

// ── Empty state ───────────────────────────────────────────────────────────────
interface EmptyProps { emoji?: string; title: string; description?: string; action?: React.ReactNode }
export function EmptyState({ emoji = '📭', title, description, action }: EmptyProps) {
  return (
    <div className="text-center py-16 px-4">
      <div className="text-4xl mb-4">{emoji}</div>
      <h3 className="text-base font-semibold text-ink mb-2">{title}</h3>
      {description && <p className="text-sm text-stone max-w-xs mx-auto mb-6">{description}</p>}
      {action}
    </div>
  )
}

// ── Stat card ─────────────────────────────────────────────────────────────────
interface StatProps { label: string; value: string|number; sub?: string; color?: string; icon?: LucideIcon }
export function StatCard({ label, value, sub, color = 'text-ink', icon: Icon }: StatProps) {
  return (
    <div className="bg-white border border-sand rounded-xl p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[1.5px] text-dust mb-2">{label}</p>
          <p className={cn('text-2xl font-display font-light', color)}>{value}</p>
          {sub && <p className="text-xs text-stone mt-1">{sub}</p>}
        </div>
        {Icon && (
          <div className="w-9 h-9 rounded-lg bg-cream flex items-center justify-center">
            <Icon className="w-4 h-4 text-stone" />
          </div>
        )}
      </div>
    </div>
  )
}

// ── Modal ─────────────────────────────────────────────────────────────────────
interface ModalProps { open: boolean; onClose: () => void; title: string; children: React.ReactNode; maxWidth?: string }
export function Modal({ open, onClose, title, children, maxWidth = 'max-w-lg' }: ModalProps) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-ink/40 backdrop-blur-sm" onClick={onClose} />
      <div className={cn('relative bg-white rounded-2xl shadow-modal w-full', maxWidth)}>
        <div className="flex items-center justify-between p-6 border-b border-sand">
          <h2 className="font-display text-xl font-light text-ink">{title}</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-cream flex items-center justify-center text-stone text-lg">×</button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  )
}

// ── Confirm dialog ────────────────────────────────────────────────────────────
interface ConfirmProps { open: boolean; onClose: () => void; onConfirm: () => void; title: string; message: string; confirmLabel?: string; danger?: boolean; loading?: boolean }
export function ConfirmDialog({ open, onClose, onConfirm, title, message, confirmLabel = 'Confirm', danger = false, loading = false }: ConfirmProps) {
  return (
    <Modal open={open} onClose={onClose} title={title} maxWidth="max-w-md">
      <p className="text-sm text-stone mb-6">{message}</p>
      <div className="flex gap-3 justify-end">
        <button onClick={onClose} className="btn-outline py-2 px-4 text-sm">Cancel</button>
        <button onClick={onConfirm} disabled={loading}
          className={cn('py-2 px-4 text-sm rounded-lg font-medium text-white transition-all disabled:opacity-50',
            danger ? 'bg-red-500 hover:bg-red-600' : 'btn-primary')}>
          {loading ? 'Please wait...' : confirmLabel}
        </button>
      </div>
    </Modal>
  )
}

// ── Table wrapper ─────────────────────────────────────────────────────────────
export function Table({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-sand">
      <table className="w-full text-sm">{children}</table>
    </div>
  )
}
export function Th({ children, className }: { children: React.ReactNode; className?: string }) {
  return <th className={cn('px-4 py-3 text-left text-[10px] font-bold uppercase tracking-[1.5px] text-dust bg-cream border-b border-sand', className)}>{children}</th>
}
export function Td({ children, className }: { children: React.ReactNode; className?: string }) {
  return <td className={cn('px-4 py-3.5 border-b border-sand last:border-0 text-sm text-ink align-middle', className)}>{children}</td>
}

// ── Pagination ────────────────────────────────────────────────────────────────
interface PaginationProps { page: number; lastPage: number; onPage: (p: number) => void; total: number }
export function Pagination({ page, lastPage, onPage, total }: PaginationProps) {
  if (lastPage <= 1) return null
  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-sand">
      <p className="text-xs text-stone">{total} total</p>
      <div className="flex items-center gap-2">
        <button disabled={page === 1} onClick={() => onPage(page - 1)}
          className="px-3 py-1.5 text-xs rounded-lg border border-sand hover:border-stone disabled:opacity-40">← Prev</button>
        <span className="text-xs text-stone">Page {page} / {lastPage}</span>
        <button disabled={page === lastPage} onClick={() => onPage(page + 1)}
          className="px-3 py-1.5 text-xs rounded-lg border border-sand hover:border-stone disabled:opacity-40">Next →</button>
      </div>
    </div>
  )
}
