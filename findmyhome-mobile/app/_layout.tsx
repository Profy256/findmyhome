import { useEffect } from 'react'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import Toast from 'react-native-toast-message'
import { useAuthStore } from '@/lib/store'
import { GestureHandlerRootView } from 'react-native-gesture-handler'

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 60000 } }
})

export default function RootLayout() {
  const hydrate = useAuthStore(s => s.hydrate)

  useEffect(() => { hydrate() }, [])

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <StatusBar style="auto" />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(auth)"  options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)"  options={{ headerShown: false }} />
          <Stack.Screen name="property/[id]" options={{ headerShown: false, presentation: 'card' }} />
          <Stack.Screen name="dashboard/kyc" options={{ headerShown: false }} />
          <Stack.Screen name="dashboard/leads" options={{ headerShown: false }} />
          <Stack.Screen name="dashboard/bookings" options={{ headerShown: false }} />
          <Stack.Screen name="dashboard/commissions" options={{ headerShown: false }} />
          <Stack.Screen name="dashboard/new-listing" options={{ headerShown: false }} />
        </Stack>
        <Toast />
      </QueryClientProvider>
    </GestureHandlerRootView>
  )
}
