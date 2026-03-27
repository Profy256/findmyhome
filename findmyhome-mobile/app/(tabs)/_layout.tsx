import { Tabs } from 'expo-router'
import { View, Text } from 'react-native'
import { C } from '@/lib/utils'

function TabIcon({ emoji, label, focused }: { emoji: string; label: string; focused: boolean }) {
  return (
    <View style={{ alignItems: 'center', gap: 2 }}>
      <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.5 }}>{emoji}</Text>
      <Text style={{ fontSize: 9, fontWeight: focused ? '700' : '400', color: focused ? C.ink : C.dust, textTransform: 'uppercase', letterSpacing: 0.5 }}>
        {label}
      </Text>
    </View>
  )
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: {
          backgroundColor: C.white,
          borderTopColor: C.sand,
          borderTopWidth: 1,
          height: 72,
          paddingBottom: 8,
          paddingTop: 6,
        },
      }}>
      <Tabs.Screen name="index"
        options={{ tabBarIcon: ({ focused }) => <TabIcon emoji="🏠" label="Home"   focused={focused} /> }} />
      <Tabs.Screen name="search"
        options={{ tabBarIcon: ({ focused }) => <TabIcon emoji="🔍" label="Search" focused={focused} /> }} />
      <Tabs.Screen name="dashboard"
        options={{ tabBarIcon: ({ focused }) => <TabIcon emoji="📊" label="Dash"   focused={focused} /> }} />
      <Tabs.Screen name="profile"
        options={{ tabBarIcon: ({ focused }) => <TabIcon emoji="👤" label="Profile" focused={focused} /> }} />
    </Tabs>
  )
}
