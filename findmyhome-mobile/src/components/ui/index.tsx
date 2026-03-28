import React from 'react'
import {
  View, Text, TouchableOpacity, TextInput, ActivityIndicator,
  StyleSheet, Modal as RNModal, ScrollView, Pressable
} from 'react-native'
import { C } from '@/lib/utils'

// ── Button ────────────────────────────────────────────────────────────────────
interface BtnProps {
  label: string; onPress: () => void; disabled?: boolean; loading?: boolean
  variant?: 'primary' | 'gold' | 'outline' | 'wa' | 'danger'; size?: 'sm' | 'md' | 'lg'
  style?: any
}
export function Btn({ label, onPress, disabled, loading, variant = 'primary', size = 'md', style }: BtnProps) {
  const bg = {
    primary: C.ink, gold: C.gold, outline: 'transparent', wa: C.wa, danger: '#e53e3e'
  }[variant]
  const tc = variant === 'outline' ? C.ink : '#fff'
  const border = variant === 'outline' ? { borderWidth: 1, borderColor: C.sand } : {}
  const pad = { sm: { paddingVertical: 8, paddingHorizontal: 16 }, md: { paddingVertical: 13, paddingHorizontal: 20 }, lg: { paddingVertical: 16, paddingHorizontal: 24 } }[size]
  const fs  = { sm: 12, md: 14, lg: 15 }[size]

  return (
    <TouchableOpacity
      onPress={onPress} disabled={disabled || loading} activeOpacity={0.8}
      style={[{ backgroundColor: bg, borderRadius: 10, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, opacity: (disabled || loading) ? 0.5 : 1 }, border, pad, style]}>
      {loading && <ActivityIndicator size="small" color="#fff" />}
      <Text style={{ color: tc, fontSize: fs, fontWeight: '600', letterSpacing: 0.3 }}>{label}</Text>
    </TouchableOpacity>
  )
}

// ── Input ─────────────────────────────────────────────────────────────────────
interface InputProps {
  label?: string; placeholder?: string; value: string
  onChangeText: (t: string) => void; secureTextEntry?: boolean
  keyboardType?: any; multiline?: boolean; numberOfLines?: number
  error?: string; style?: any; editable?: boolean
}
export function Input({ label, placeholder, value, onChangeText, secureTextEntry, keyboardType, multiline, numberOfLines, error, style, editable = true }: InputProps) {
  return (
    <View style={{ marginBottom: 16 }}>
      {label && <Text style={{ fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1.5, color: C.dust, marginBottom: 6 }}>{label}</Text>}
      <TextInput
        value={value} onChangeText={onChangeText} placeholder={placeholder}
        placeholderTextColor={C.dust} secureTextEntry={secureTextEntry}
        keyboardType={keyboardType} multiline={multiline}
        numberOfLines={numberOfLines} editable={editable}
        style={[{
          borderWidth: 1.5, borderColor: error ? C.red : C.sand, borderRadius: 10,
          paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: C.ink,
          backgroundColor: C.paper, minHeight: multiline ? 80 : undefined,
          textAlignVertical: multiline ? 'top' : 'center',
        }, style]}
      />
      {error && <Text style={{ fontSize: 11, color: C.red, marginTop: 4 }}>{error}</Text>}
    </View>
  )
}

// ── Badge ─────────────────────────────────────────────────────────────────────
interface BadgeProps { label: string; color?: 'green'|'red'|'amber'|'blue'|'grey'|'gold' }
export function Badge({ label, color = 'grey' }: BadgeProps) {
  const colors = {
    green: { bg: '#f0fff4', tc: '#276749' },
    red:   { bg: '#fff5f5', tc: '#c53030' },
    amber: { bg: '#fffbeb', tc: '#b7791f' },
    blue:  { bg: '#ebf8ff', tc: '#2b6cb0' },
    grey:  { bg: C.cream,   tc: C.stone   },
    gold:  { bg: '#fdf7ee', tc: C.gold    },
  }[color]
  return (
    <View style={{ backgroundColor: colors.bg, borderRadius: 100, paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-start' }}>
      <Text style={{ fontSize: 10, fontWeight: '700', color: colors.tc, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</Text>
    </View>
  )
}

// ── Loading ───────────────────────────────────────────────────────────────────
export function Loading({ full }: { full?: boolean }) {
  if (full) return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.paper }}>
      <ActivityIndicator size="large" color={C.gold} />
    </View>
  )
  return (
    <View style={{ paddingVertical: 40, alignItems: 'center' }}>
      <ActivityIndicator size="large" color={C.gold} />
    </View>
  )
}

// ── Empty ─────────────────────────────────────────────────────────────────────
interface EmptyProps { emoji?: string; title: string; description?: string; action?: React.ReactNode }
export function Empty({ emoji = '📭', title, description, action }: EmptyProps) {
  return (
    <View style={{ alignItems: 'center', paddingVertical: 48, paddingHorizontal: 24 }}>
      <Text style={{ fontSize: 40, marginBottom: 12 }}>{emoji}</Text>
      <Text style={{ fontSize: 16, fontWeight: '600', color: C.ink, marginBottom: 6, textAlign: 'center' }}>{title}</Text>
      {description && <Text style={{ fontSize: 13, color: C.stone, textAlign: 'center', lineHeight: 20, marginBottom: 16 }}>{description}</Text>}
      {action}
    </View>
  )
}

// ── Stat Card ─────────────────────────────────────────────────────────────────
export function StatCard({ label, value, color = C.ink }: { label: string; value: string|number; color?: string }) {
  return (
    <View style={{ flex: 1, backgroundColor: C.white, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: C.sand }}>
      <Text style={{ fontSize: 9, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1.5, color: C.dust, marginBottom: 8 }}>{label}</Text>
      <Text style={{ fontSize: 22, fontWeight: '300', color }}>{value}</Text>
    </View>
  )
}

// ── Section Header ────────────────────────────────────────────────────────────
export function SectionHeader({ label, title }: { label?: string; title: string }) {
  return (
    <View style={{ marginBottom: 16 }}>
      {label && <Text style={{ fontSize: 9, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 2, color: C.gold, marginBottom: 4 }}>{label}</Text>}
      <Text style={{ fontSize: 26, fontWeight: '300', color: C.ink, letterSpacing: -0.5 }}>{title}</Text>
    </View>
  )
}

// ── Card ──────────────────────────────────────────────────────────────────────
export function Card({ children, style }: { children: React.ReactNode; style?: any }) {
  return (
    <View style={[{ backgroundColor: C.white, borderRadius: 14, borderWidth: 1, borderColor: C.sand, overflow: 'hidden' }, style]}>
      {children}
    </View>
  )
}

// ── Divider ───────────────────────────────────────────────────────────────────
export function Divider() {
  return <View style={{ height: 1, backgroundColor: C.sand, marginVertical: 12 }} />
}

// ── Pill selector ─────────────────────────────────────────────────────────────
interface PillProps { options: string[]; selected: string; onSelect: (v: string) => void }
export function PillSelector({ options, selected, onSelect }: PillProps) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 4 }}>
      <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingVertical: 4 }}>
        {options.map(o => (
          <TouchableOpacity key={o} onPress={() => onSelect(o)} activeOpacity={0.8}
            style={{ paddingHorizontal: 16, paddingVertical: 7, borderRadius: 100,
              backgroundColor: selected === o ? C.ink : C.white,
              borderWidth: 1, borderColor: selected === o ? C.ink : C.sand }}>
            <Text style={{ fontSize: 12, fontWeight: selected === o ? '600' : '400', color: selected === o ? C.white : C.stone }}>
              {o}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  )
}

// ── Bottom Sheet Modal ────────────────────────────────────────────────────────
interface SheetProps { visible: boolean; onClose: () => void; title?: string; children: React.ReactNode }
export function BottomSheet({ visible, onClose, title, children }: SheetProps) {
  return (
    <RNModal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' }} onPress={onClose} />
      <View style={{ backgroundColor: C.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 36 }}>
        <View style={{ width: 40, height: 4, backgroundColor: C.sand, borderRadius: 2, alignSelf: 'center', marginBottom: 16 }} />
        {title && <Text style={{ fontSize: 18, fontWeight: '300', color: C.ink, marginBottom: 16 }}>{title}</Text>}
        {children}
      </View>
    </RNModal>
  )
}

// ── KYC Status Banner ─────────────────────────────────────────────────────────
export function KycBanner({ status, onPress }: { status: string; onPress?: () => void }) {
  if (status === 'verified') return null
  const configs: Record<string, { bg: string; tc: string; msg: string; btn?: string }> = {
    none:     { bg: '#fffbeb', tc: '#b7791f', msg: 'Upload your ID to start listing properties.', btn: 'Verify Now' },
    pending:  { bg: '#ebf8ff', tc: '#2b6cb0', msg: 'AI is currently analyzing your document. Verification usually takes a few minutes.' },
    rejected: { bg: '#fff5f5', tc: '#c53030', msg: 'Your KYC was rejected. Please resubmit.', btn: 'Resubmit' },
    blocked:  { bg: '#fff5f5', tc: '#c53030', msg: 'Your account is suspended. Pay outstanding commissions to restore.' },
  }
  const cfg = configs[status] ?? configs.none
  return (
    <View style={{ backgroundColor: cfg.bg, borderRadius: 12, padding: 14, marginBottom: 16, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <Text style={{ fontSize: 16 }}>{status === 'rejected' || status === 'blocked' ? '⚠️' : status === 'pending' ? '⏳' : '📋'}</Text>
      <Text style={{ flex: 1, fontSize: 13, color: cfg.tc, lineHeight: 18 }}>{cfg.msg}</Text>
      {cfg.btn && onPress && (
        <TouchableOpacity onPress={onPress}>
          <Text style={{ fontSize: 12, fontWeight: '700', color: cfg.tc, textDecorationLine: 'underline' }}>{cfg.btn}</Text>
        </TouchableOpacity>
      )}
    </View>
  )
}
