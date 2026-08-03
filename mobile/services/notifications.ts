import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import Constants, { ExecutionEnvironment } from "expo-constants";

const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
const isExpoGoAndroid = isExpoGo && Platform.OS === "android";


const getNotificationsModule = () => {
  if (Platform.OS === "web") {
    return null;
  }
  try {
    return require("expo-notifications");
  } catch (e) {
    console.warn("Failed to load expo-notifications:", e);
    return null;
  }
};

const Notifications = getNotificationsModule();
export const notifications = Notifications;

if (Notifications) {
  Notifications.setNotificationHandler({
    handleNotification: async (notification: any) => {
      const data = notification.request.content.data;
      const chatId = data?.chatId || data?.chat_id;
      
      let shouldShow = true;
      try {
        const { wsClient } = require("./ws");
        const currentChatId = wsClient.activeChatId;
        if (chatId && currentChatId && chatId === currentChatId) {
          shouldShow = false;
        }
      } catch (err) {
        console.warn("Error checking active chat ID for notification:", err);
      }

      return {
        shouldShowAlert: shouldShow,
        shouldPlaySound: shouldShow,
        shouldSetBadge: false,
        shouldShowBanner: shouldShow,
        shouldShowList: shouldShow,
      };
    },
  });
}

export async function registerForPushNotifications(): Promise<string | null> {
  if (!Notifications) {
    return null;
  }

  if (Platform.OS === "android") {
    // Android requires channels to exist before requesting an Expo push token.
    await Notifications.setNotificationChannelAsync("messages", {
      name: "Mensagens",
      description: "Notificações de novas mensagens",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#25D366",
      enableVibrate: true,
      enableLights: true,
      showBadge: true,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      bypassDnd: false,
    });

    await Notifications.setNotificationChannelAsync("calls", {
      name: "Chamadas",
      description: "Notificações de chamadas recebidas",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 500, 200, 500],
      lightColor: "#FF4444",
      enableVibrate: true,
      enableLights: true,
      showBadge: true,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    });

    await Notifications.setNotificationChannelAsync("default", {
      name: "Geral",
      description: "Notificações gerais",
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  // Check existing permission status
  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;

  if (existing !== "granted") {
    // Request permission with explicit options for iOS
    // On Android 13+ (API 33), this triggers the POST_NOTIFICATIONS runtime dialog
    // On iOS, this triggers the native permission alert with specified capabilities
    const { status } = await Notifications.requestPermissionsAsync({
      ios: {
        allowAlert: true,        // Show notification content on lock screen & notification center
        allowBadge: true,        // Show badge count on app icon
        allowSound: true,        // Play notification sound
        allowAnnouncements: true, // Allow Siri to announce notifications
        allowCriticalAlerts: false,
        provideAppNotificationSettings: true, // Show "Settings" button in notification settings
      },
    });
    finalStatus = status;
  }

  if (finalStatus !== "granted") {
    console.warn(
      "Push notification permission not granted. Status:",
      finalStatus,
      "- User will not receive message notifications when the app is closed or screen is locked."
    );
    return null;
  }

  if (isExpoGoAndroid) {
    console.warn(
      "Expo Go on Android does not support remote push notifications. " +
      "Use a development build or production build to receive lock screen/background pushes."
    );
    return null;
  }

  let tokenData;
  try {
    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      Constants.easConfig?.projectId;
    tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
  } catch (error) {
    console.warn("Failed to get Expo push token:", error);
    return null;
  }

  const stored = await SecureStore.getItemAsync("push_token");
  if (stored !== tokenData.data) {
    await SecureStore.setItemAsync("push_token", tokenData.data);
  }

  return tokenData.data;
}

export async function getStoredPushToken(): Promise<string | null> {
  if (Platform.OS === "web") {
    return null;
  }
  return SecureStore.getItemAsync("push_token");
}
