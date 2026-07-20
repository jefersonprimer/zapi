import { Tabs } from 'expo-router';
import React from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppTheme } from '@/context/ThemeContext';

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.tabIconSelected,
        tabBarInactiveTintColor: colors.tabIconDefault,
        headerShown: false,
        tabBarLabelStyle: { fontSize: 12, fontWeight: "500", paddingBottom: 4 },
        tabBarStyle: {
          height: 60 + insets.bottom,
          borderTopColor: colors.border,
          backgroundColor: colors.tabBarBackground,
          paddingTop: 4,
          paddingBottom: insets.bottom,
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Conversas',
          tabBarIcon: ({ color, size, focused }) => (
            <MaterialCommunityIcons 
              name={focused ? 'message-text' : 'message-text-outline'} 
              color={color} 
              size={size ?? 24} 
            />
          ),
        }}
      />
      <Tabs.Screen
        name="updates"
        options={{
          title: 'Atualizações',
          tabBarIcon: ({ color, size, focused }) => (
            <MaterialCommunityIcons 
              name={focused ? 'circle-slice-8' : 'circle-double'} 
              color={color} 
              size={size ?? 24} 
            />
          ),
        }}
      />
      <Tabs.Screen
        name="communities"
        options={{
          title: 'Comunidades',
          tabBarIcon: ({ color, size, focused }) => (
            <MaterialCommunityIcons 
              name={focused ? 'account-group' : 'account-group-outline'} 
              color={color} 
              size={size ?? 24} 
            />
          ),
        }}
      />
      <Tabs.Screen
        name="calls"
        options={{
          title: 'Ligações',
          tabBarIcon: ({ color, size, focused }) => (
            <MaterialCommunityIcons 
              name={focused ? 'phone' : 'phone-outline'} 
              color={color} 
              size={size ?? 24} 
            />
          ),
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: 'Explorar',
          tabBarIcon: ({ color, size, focused }) => (
            <MaterialCommunityIcons 
              name={focused ? 'compass' : 'compass-outline'} 
              color={color} 
              size={size ?? 24} 
            />
          ),
        }}
      />
    </Tabs>
  );
}
