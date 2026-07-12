import { useEffect, useState } from "react";
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View } from "react-native";
import 'react-native-reanimated';

import { AuthProvider, useAuth } from "@/context/AuthContext";
import { ThemeProvider as AppThemeProvider, useAppTheme } from "@/context/ThemeContext";
import { wsClient } from "@/services/ws";
import { voiceCallManager } from "@/services/voiceCallManager";
import { registerForPushNotifications } from "@/services/notifications";
import { authFetch, API_URL } from "@/services/api";
import { initializeDatabase } from "@/services/database";
import { syncWorker } from "@/services/syncWorker";
import CallOverlay from "@/components/CallOverlay";

function InitialLayout() {
  const { token, user, isLoading } = useAuth();
  const { colors } = useAppTheme();
  const segments = useSegments();
  const router = useRouter();
  const [dbReady, setDbReady] = useState(false);

  // Initialize SQLite database
  useEffect(() => {
    (async () => {
      try {
        await initializeDatabase();
      } catch (err) {
        console.error("Failed to initialize SQLite database:", err);
      } finally {
        setDbReady(true);
      }
    })();
  }, []);

  // Initialize signaling / websockets
  useEffect(() => {
    if (token && user) {
      wsClient.init(token);
      syncWorker.init(token);
      voiceCallManager.init(token, user.user_id);
      return () => {
        voiceCallManager.disconnect();
        wsClient.disconnect();
        syncWorker.disconnect();
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
    if (isLoading || !dbReady) return;

    const inAuthGroup = segments[0] === 'login' || segments[0] === 'register';

    if (!token && !inAuthGroup) {
      // Redirect to login if not authenticated
      router.replace('/login');
    } else if (token && inAuthGroup) {
      // Redirect to index (conversas) if authenticated
      router.replace('/(tabs)');
    }
  }, [token, isLoading, dbReady, segments, router]);

  if (isLoading || !dbReady) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.tint} />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="login" options={{ headerShown: false }} />
      <Stack.Screen name="register" options={{ headerShown: true, title: "Register", headerStyle: { backgroundColor: colors.headerBackground }, headerTintColor: colors.headerText }} />
      <Stack.Screen name="chat" options={{ headerShown: false }} />
      <Stack.Screen name="contact-detail" options={{ headerShown: false }} />
      <Stack.Screen name="share-contact" options={{ headerShown: false }} />
      <Stack.Screen name="new-chat" options={{ headerShown: false }} />
      <Stack.Screen name="new-group" options={{ headerShown: false }} />
      <Stack.Screen name="contacts" options={{ headerShown: false }} />
      <Stack.Screen name="settings" options={{ headerShown: false }} />
    </Stack>
  );
}

function RootLayoutInner() {
  const { theme, colors } = useAppTheme();

  return (
    <ThemeProvider value={theme === 'dark' ? DarkTheme : DefaultTheme}>
      <InitialLayout />
      <CallOverlay />
      <StatusBar style={theme === 'dark' ? 'light' : 'dark'} backgroundColor={colors.headerBackground} />
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <AppThemeProvider>
        <RootLayoutInner />
      </AppThemeProvider>
    </AuthProvider>
  );
}

