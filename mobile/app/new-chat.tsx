import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
} from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "@/context/AuthContext";
import { createChat, searchUsers, type UserSearchResult } from "@/services/api";
import { UserContactCard } from "@/components/UserContactCard";
import { useAppTheme } from "@/context/ThemeContext";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";

export default function NewChatScreen() {
  const router = useRouter();
  const { token } = useAuth();
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState("");
  const [users, setUsers] = useState<UserSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [isKeyboardVisible, setKeyboardVisible] = useState(false);

  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener(
      "keyboardDidShow",
      () => setKeyboardVisible(true),
    );
    const keyboardDidHideListener = Keyboard.addListener(
      "keyboardDidHide",
      () => setKeyboardVisible(false),
    );

    return () => {
      keyboardDidHideListener.remove();
      keyboardDidShowListener.remove();
    };
  }, []);

  async function handleSearch() {
    if (!query.trim() || !token) return;
    setSearching(true);
    try {
      const data = await searchUsers(token, query.trim());
      setUsers(data.users);
    } catch (err: any) {
      Alert.alert("Erro", err.message || "Erro ao buscar usuários");
    } finally {
      setSearching(false);
    }
  }

  async function handleSelectUser(userId: string) {
    if (!token) return;
    setLoading(true);
    try {
      const data = await createChat(token, userId);
      const chosenUser = users.find((u) => u.id === userId);
      router.replace({
        pathname: "/chat",
        params: {
          chatId: data.id,
          participantId: userId,
          participantUsername: chosenUser?.username ?? "Unknown",
          participantAvatarUrl: chosenUser?.avatar_url ?? "",
        },
      });
    } catch (err: any) {
      const isPrivacy =
        err?.code === "privacy_messages_nobody" ||
        err?.code === "privacy_messages_contacts";
      Alert.alert(
        isPrivacy ? "Privacidade" : "Erro",
        err.message || "Não foi possível iniciar a conversa.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={
        Platform.OS === "ios"
          ? "padding"
          : isKeyboardVisible
            ? "height"
            : undefined
      }
      keyboardVerticalOffset={Platform.OS === "ios" ? insets.top + 60 : 0}
    >
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Custom Header */}
        <View
          style={[
            styles.customHeader,
            {
              paddingTop: insets.top,
              borderBottomColor: colors.border,
            },
          ]}
        >
          <View style={styles.headerContent}>
            <TouchableOpacity
              onPress={() => router.back()}
              style={styles.backBtn}
            >
              <Ionicons
                name="chevron-back-outline"
                size={24}
                color={colors.text}
              />
            </TouchableOpacity>
            <View style={styles.headerTitleContainer}>
              <Text style={[styles.headerTitle, { color: colors.text }]}>
                Nova Conversa
              </Text>
              <Text
                style={[styles.headerSubtitle, { color: colors.textSecondary }]}
              >
                Inicie um chat privado
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.content}>
          {/* Search Section */}
          <View
            style={[
              styles.searchBarContainer,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <MaterialCommunityIcons
              name="magnify"
              size={20}
              color={colors.textSecondary}
              style={styles.searchIcon}
            />
            <TextInput
              style={[styles.searchInput, { color: colors.text }]}
              placeholder="Buscar por nome, usuário ou email..."
              placeholderTextColor={colors.textSecondary}
              value={query}
              onChangeText={setQuery}
              autoCapitalize="none"
              onSubmitEditing={handleSearch}
              returnKeyType="search"
            />
            {query.length > 0 && (
              <TouchableOpacity
                onPress={() => setQuery("")}
                style={styles.clearBtn}
              >
                <MaterialCommunityIcons
                  name="close"
                  size={24}
                  color={colors.textSecondary}
                />
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[
                styles.searchBtn,
                { backgroundColor: colors.brandGreen || "#07C160" },
              ]}
              onPress={handleSearch}
              disabled={searching}
            >
              {searching ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.searchBtnText}>Buscar</Text>
              )}
            </TouchableOpacity>
          </View>

          {loading && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator
                size="large"
                color={colors.brandGreen || "#07C160"}
              />
            </View>
          )}
          <FlatList
            data={users}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => (
              <UserContactCard
                avatarUrl={item.avatar_url}
                name={item.name}
                username={item.username}
                email={item.email}
                onPress={() => handleSelectUser(item.id)}
                containerStyle={styles.userItem}
              />
            )}
            ListEmptyComponent={
              query.trim() && !searching ? (
                <View style={styles.emptyState}>
                  <MaterialCommunityIcons
                    name="account-group"
                    size={48}
                    color={colors.textSecondary}
                    style={{ opacity: 0.5, marginBottom: 12 }}
                  />
                  <Text
                    style={[styles.emptyText, { color: colors.textSecondary }]}
                  >
                    Nenhum usuário encontrado para &quot;{query}&quot;
                  </Text>
                </View>
              ) : !searching ? (
                <View style={styles.emptyState}>
                  <MaterialCommunityIcons
                    name="account-group"
                    size={48}
                    color={colors.textSecondary}
                    style={{ opacity: 0.3, marginBottom: 12 }}
                  />
                  <Text
                    style={[styles.emptyText, { color: colors.textSecondary }]}
                  >
                    Busque contatos para iniciar um bate-papo
                  </Text>
                </View>
              ) : null
            }
          />
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  customHeader: {
    paddingBottom: 6,
  },
  headerContent: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    marginTop: 8,
  },
  backBtn: {
    padding: 8,
    marginRight: 8,
    borderRadius: 20,
  },
  headerTitleContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "500",
  },
  headerSubtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  searchBarContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 12,
    paddingLeft: 12,
    height: 52,
    overflow: "hidden",
    marginBottom: 8,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    height: "100%",
    paddingVertical: 0,
  },
  clearBtn: {
    padding: 8,
  },
  searchBtn: {
    height: "100%",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  searchBtnText: {
    color: "#FFF",
    fontSize: 14,
    fontWeight: "600",
  },
  loadingContainer: {
    paddingVertical: 16,
    alignItems: "center",
  },
  listContent: {
    paddingVertical: 8,
  },
  userItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 16,
    paddingHorizontal: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  userRowLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  userRowRight: {
    paddingLeft: 8,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
    overflow: "hidden",
  },
  avatarImage: {
    width: "100%",
    height: "100%",
  },
  avatarText: {
    color: "#FFF",
    fontSize: 18,
    fontWeight: "700",
  },
  userInfo: {
    flex: 1,
    justifyContent: "center",
  },
  username: {
    fontSize: 15,
    fontWeight: "600",
  },
  usernameHandle: {
    fontSize: 12,
    marginTop: 1,
  },
  email: {
    fontSize: 12,
    marginTop: 2,
    opacity: 0.8,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 14,
    textAlign: "center",
  },
});
