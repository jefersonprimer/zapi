import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { AuthProvider, useAuth } from "./src/context/AuthContext";
import { registerForPushNotifications } from "./src/services/notifications";
import { authFetch } from "./src/services/api";
import LoginScreen from "./src/screens/LoginScreen";
import RegisterScreen from "./src/screens/RegisterScreen";
import ChatListScreen from "./src/screens/ChatListScreen";
import ChatScreen from "./src/screens/ChatScreen";
import NewChatScreen from "./src/screens/NewChatScreen";
import NewGroupScreen from "./src/screens/NewGroupScreen";

const Stack = createNativeStackNavigator();

const API_URL = "http://192.168.5.22:3000";

function Navigator() {
  const { token, isLoading } = useAuth();

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

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {token ? (
          <>
            <Stack.Screen name="ChatList" component={ChatListScreen} />
            <Stack.Screen
              name="Chat"
              component={ChatScreen}
              options={({ route }: any) => ({
                headerShown: true,
                title: route.params.participantUsername,
                headerBackTitle: "Back",
              })}
            />
            <Stack.Screen
              name="NewChat"
              component={NewChatScreen}
              options={{ headerShown: true, title: "New Chat" }}
            />
            <Stack.Screen
              name="NewGroup"
              component={NewGroupScreen}
              options={{ headerShown: true, title: "New Group" }}
            />
          </>
        ) : (
          <>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen
              name="Register"
              component={RegisterScreen}
              options={{ headerShown: true, title: "Register" }}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Navigator />
    </AuthProvider>
  );
}
