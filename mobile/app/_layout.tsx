import { useEffect, useState } from "react";
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View, Platform, AppState } from "react-native";
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
import { useCallStore } from "@/store/useCallStore";
import * as Notifications from "expo-notifications";

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

      // Listen for global message notifications when the app is in the foreground
      // but the user is not actively inside the chat screen for this message
      const unsub = wsClient.on("new_message_notification", async (data) => {
        const chatId = data.chat_id;
        const message = data.message;
        const currentChatId = wsClient.activeChatId;

        // If we are already in this chat, do not display a notification
        if (chatId && currentChatId && chatId === currentChatId) {
          return;
        }

        try {
          if (Platform.OS !== "web") {
            await Notifications.scheduleNotificationAsync({
              content: {
                title: message.sender_username || "Nova mensagem",
                body: message.content || "Mídia",
                data: { chatId },
                sound: "default",
              },
              trigger: null,
            });
          }
        } catch (err) {
          console.warn("Failed to schedule local notification:", err);
        }
      });

      // Listen to AppState (foreground/background transitions) to update presence state
      const handleAppStateChange = (nextAppState: string) => {
        if (nextAppState === "active") {
          wsClient.send({ type: "presence_update", state: "active" });
        } else if (nextAppState.match(/inactive|background/)) {
          wsClient.send({ type: "presence_update", state: "background" });
        }
      };
      const appStateSubscription = AppState.addEventListener("change", handleAppStateChange);

      return () => {
        appStateSubscription.remove();
        unsub();
        voiceCallManager.disconnect();
        wsClient.disconnect();
        syncWorker.disconnect();
      };
    }
  }, [token, user]);

  // Register push notifications and handle taps
  useEffect(() => {
    if (!token) return;
    
    // Register token
    (async () => {
      const pushToken = await registerForPushNotifications();
      if (pushToken) {
        try {
          const deviceName = Platform.select({
            android: "Android Device",
            ios: "iOS Device",
            default: "Web/Other Device",
          });
          await authFetch(`${API_URL}/push/register`, token, {
            method: "POST",
            body: JSON.stringify({
              token: pushToken,
              platform: Platform.OS,
              device_name: deviceName,
            }),
          });
        } catch {}
      }
    })();

    // Handle clicks / redirects
    if (Platform.OS !== "web") {
      const handleNotificationData = (data: any) => {
        const chatId = data?.chatId || data?.chat_id;
        const type = data?.type;

        if (type === "incoming_call" && data.callId) {
          const store = useCallStore.getState();
          if (store.callState === "idle") {
            store.receiveCall(
              data.callId,
              data.callerId,
              data.callerUsername || "Unknown User",
              !!data.isVideo
            );
            if (user) {
              voiceCallManager.init(token, user.user_id);
            }
          }
        } else if (chatId) {
          router.push({
            pathname: "/chat",
            params: { chatId }
          });
        }
      };

      // Check if launched by notification (cold start)
      Notifications.getLastNotificationResponseAsync().then((response: any) => {
        if (response) {
          handleNotificationData(response.notification.request.content.data);
        }
      });

      // Listen for notification taps while app is running (foreground/background)
      const subscription = Notifications.addNotificationResponseReceivedListener((response: any) => {
        handleNotificationData(response.notification.request.content.data);
      });

      return () => {
        subscription.remove();
      };
    }
  }, [token, user, router]);

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
      <Stack.Screen name="archived" options={{ headerShown: false }} />
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

