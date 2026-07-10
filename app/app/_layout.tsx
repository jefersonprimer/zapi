import { useEffect } from "react";
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View } from "react-native";
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { wsClient } from "@/services/ws";
import { voiceCallManager } from "@/services/voiceCallManager";
import { registerForPushNotifications } from "@/services/notifications";
import { authFetch, API_URL } from "@/services/api";
import CallOverlay from "@/components/CallOverlay";

function InitialLayout() {
  const { token, user, isLoading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  // Initialize signaling / websockets
  useEffect(() => {
    if (token && user) {
      wsClient.init(token);
      voiceCallManager.init(token, user.user_id);
      return () => {
        voiceCallManager.disconnect();
        wsClient.disconnect();
      };
    }
  }, [token, user]);

  // Register push notifications
  useEffect(() => {
    if (!token) return;
    (async () => {
      const pushToken = await registerForPushNotifications();
      if (pushToken) {
        try {
          await authFetch(`${API_URL}/push/register`, token, {
            method: "POST",
            body: JSON.stringify({ token: pushToken }),
          });
        } catch {}
      }
    })();
  }, [token]);

  // Protected routes redirection
  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === 'login' || segments[0] === 'register';

    if (!token && !inAuthGroup) {
      // Redirect to login if not authenticated
      router.replace('/login');
    } else if (token && inAuthGroup) {
      // Redirect to index (conversas) if authenticated
      router.replace('/(tabs)');
    }
  }, [token, isLoading, segments, router]);

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: '#fff' }}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="login" options={{ headerShown: false }} />
      <Stack.Screen name="register" options={{ headerShown: true, title: "Register" }} />
      <Stack.Screen name="chat" options={{ headerShown: true }} />
      <Stack.Screen name="new-chat" options={{ headerShown: true, title: "New Chat" }} />
      <Stack.Screen name="new-group" options={{ headerShown: true, title: "New Group" }} />
      <Stack.Screen name="contacts" options={{ headerShown: true, title: "Contatos" }} />
    </Stack>
  );
}

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <AuthProvider>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <InitialLayout />
        <CallOverlay />
        <StatusBar style="auto" />
      </ThemeProvider>
    </AuthProvider>
  );
}
