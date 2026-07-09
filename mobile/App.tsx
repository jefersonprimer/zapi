import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { AuthProvider, useAuth } from "./src/context/AuthContext";
import { registerForPushNotifications } from "./src/services/notifications";
import { authFetch, API_URL } from "./src/services/api";
import LoginScreen from "./src/screens/LoginScreen";
import RegisterScreen from "./src/screens/RegisterScreen";
import ChatListScreen from "./src/screens/ChatListScreen";
import ChatScreen from "./src/screens/ChatScreen";
import NewChatScreen from "./src/screens/NewChatScreen";
import NewGroupScreen from "./src/screens/NewGroupScreen";
import ContactsScreen from "./src/screens/ContactsScreen";
import UpdatesScreen from "./src/screens/UpdatesScreen";
import CommunitiesScreen from "./src/screens/CommunitiesScreen";
import CallsScreen from "./src/screens/CallsScreen";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { MessageCircle, CircleDot, Users2, Phone } from "lucide-react-native";

// Call signaling & view imports
import { voiceCallManager } from "./src/services/voiceCallManager";
import { wsClient } from "./src/services/ws";
import CallOverlay from "./src/screens/CallOverlay";

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function TabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: "#007AFF",
        tabBarInactiveTintColor: "#8e8e93",
        tabBarLabelStyle: { fontSize: 12, fontWeight: "500", paddingBottom: 4 },
        tabBarStyle: { height: 60, borderTopColor: "#eee", paddingTop: 4 },
        tabBarIcon: ({ color, size }) => {
          if (route.name === "ConversasTab") {
            return <MessageCircle color={color} size={size} />;
          } else if (route.name === "UpdatesTab") {
            return <CircleDot color={color} size={size} />;
          } else if (route.name === "CommunitiesTab") {
            return <Users2 color={color} size={size} />;
          } else if (route.name === "CallsTab") {
            return <Phone color={color} size={size} />;
          }
          return null;
        },
      })}
    >
      <Tab.Screen
        name="ConversasTab"
        component={ChatListScreen}
        options={{ title: "Conversas" }}
      />
      <Tab.Screen
        name="UpdatesTab"
        component={UpdatesScreen}
        options={{ title: "Atualizações" }}
      />
      <Tab.Screen
        name="CommunitiesTab"
        component={CommunitiesScreen}
        options={{ title: "Comunidades" }}
      />
      <Tab.Screen
        name="CallsTab"
        component={CallsScreen}
        options={{ title: "Ligações" }}
      />
    </Tab.Navigator>
  );
}

function Navigator() {
  const { token, user, isLoading } = useAuth();

  // Initialize global wsClient and VoiceCallManager signaling client on login
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
            <Stack.Screen name="HomeTabs" component={TabNavigator} />
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
            <Stack.Screen
              name="Contacts"
              component={ContactsScreen}
              options={{ headerShown: true, title: "Contatos" }}
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
      <CallOverlay />
    </AuthProvider>
  );
}
