import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import Constants, { ExecutionEnvironment } from "expo-constants";

const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;


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
  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;

  if (existing !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") return null;

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

  if (Platform.OS === "android") {
    Notifications.setNotificationChannelAsync("default", {
      name: "default",
      importance: Notifications.AndroidImportance.MAX,
    });
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

