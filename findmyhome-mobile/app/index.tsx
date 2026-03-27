import { Redirect } from 'expo-router'
import { useAuthStore } from '@/lib/store'
import { Loading } from '@/components/ui'

export default function Index() {
  const { hydrated } = useAuthStore()
  if (!hydrated) return <Loading full />
  return <Redirect href="/(tabs)" />
}
