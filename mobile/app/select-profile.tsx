import { useState, useEffect, useRef, useCallback } from "react";
import {
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  View,
  ScrollView,
  Image,
} from "react-native";
import { useRouter, Stack } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth, type SavedProfile } from "@/context/AuthContext";
import { useAppTheme } from "@/context/ThemeContext";
import { Trash2, Plus, MoreHorizontal } from "lucide-react-native";
import {
  BottomSheetModal,
  BottomSheetView,
  BottomSheetBackdrop,
} from "@gorhom/bottom-sheet";
import { getFullRemoteUrl } from "@/services/mediaCache";

export default function SelectProfileScreen() {
  const router = useRouter();
  const { signIn, savedProfiles, removeProfile } = useAuth();
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(false);

  const bottomSheetRef = useRef<BottomSheetModal>(null);

  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
      />
    ),
    [],
  );

  // If there are no saved profiles, redirect directly to login
  useEffect(() => {
    if (!savedProfiles || savedProfiles.length === 0) {
      router.replace("/login");
    }
  }, [savedProfiles, router]);

  if (!savedProfiles || savedProfiles.length === 0) {
    return (
      <View
        style={[
          styles.container,
          {
            backgroundColor: colors.background,
            justifyContent: "center",
            alignItems: "center",
          },
        ]}
      >
        <ActivityIndicator size="large" color={colors.tint || colors.text} />
      </View>
    );
  }

  const mainProfile = savedProfiles[0];
  const otherProfiles = savedProfiles.slice(1);

  async function handleSelectProfile(profile: SavedProfile) {
    setLoading(true);
    try {
      await signIn(profile.token, {
        user_id: profile.user_id,
        username: profile.username,
        email: profile.email,
        avatar_url: profile.avatar_url,
        name: profile.name,
      });
      // Redirection is handled automatically by Auth Guard in _layout.tsx
    } catch (err: any) {
      console.error("Saved profile login failed:", err);
      Alert.alert(
        "Sessão expirada",
        "Por favor, insira seus dados de login novamente.",
        [
          {
            text: "OK",
            onPress: () => {
              router.push("/login");
            },
          },
        ],
      );
    } finally {
      setLoading(false);
    }
  }

  const getInitials = (name?: string | null, username?: string) => {
    if (name && name.trim()) {
      const parts = name.trim().split(" ");
      if (parts.length > 1) {
        return (parts[0][0] + parts[1][0]).toUpperCase();
      }
      return parts[0][0].toUpperCase();
    }
    return username ? username[0].toUpperCase() : "?";
  };

  const pageBg = colors.background;
  const textColor = colors.text;
  const textSecondary = colors.textSecondary;
  const inputBg = colors.cardBackground;
  const borderDefault = colors.border;
  const buttonBg = colors.text;

  return (
    <View style={[styles.container, { backgroundColor: pageBg }]}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View
        style={{
          paddingTop: insets.top > 0 ? insets.top : 12,
          paddingHorizontal: 28,
          backgroundColor: pageBg,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          height: insets.top > 0 ? insets.top + 48 : 56,
        }}
      >
        <Text style={[styles.appLogoText, { color: textColor }]}>ZAPI</Text>
        <TouchableOpacity
          onPress={() => bottomSheetRef.current?.present()}
          style={{ padding: 8, marginRight: -8 }}
          activeOpacity={0.7}
        >
          <MoreHorizontal color={textColor} size={24} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingBottom: insets.bottom > 0 ? insets.bottom + 16 : 24,
            justifyContent: "space-between",
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Main profile section */}
        <View style={styles.mainProfileSection}>
          <View
            style={[styles.avatarContainer, { borderColor: borderDefault }]}
          >
            {mainProfile.avatar_url ? (
              <Image
                source={{ uri: getFullRemoteUrl(mainProfile.avatar_url) }}
                style={styles.mainAvatar}
              />
            ) : (
              <View
                style={[
                  styles.mainAvatarPlaceholder,
                  { backgroundColor: inputBg },
                ]}
              >
                <Text
                  style={[
                    styles.mainAvatarPlaceholderText,
                    { color: textColor },
                  ]}
                >
                  {getInitials(mainProfile.name, mainProfile.username)}
                </Text>
              </View>
            )}
          </View>

          <Text style={[styles.mainProfileName, { color: textColor }]}>
            {mainProfile.name || mainProfile.username}
          </Text>
          {mainProfile.name && (
            <Text
              style={[styles.mainProfileUsername, { color: textSecondary }]}
            >
              @{mainProfile.username}
            </Text>
          )}

          <TouchableOpacity
            style={[
              styles.continueButton,
              { backgroundColor: colors.brandGreen || buttonBg },
            ]}
            onPress={() => handleSelectProfile(mainProfile)}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color="#FFF" size="small" />
            ) : (
              <Text style={styles.continueButtonText}>
                Continuar como {mainProfile.username}
              </Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Other profiles list */}
        {otherProfiles.length > 0 && (
          <View style={styles.otherProfilesContainer}>
            <Text style={[styles.sectionTitle, { color: textSecondary }]}>
              Outras contas salvas
            </Text>
            {otherProfiles.map((profile) => (
              <View
                key={profile.user_id}
                style={[
                  styles.profileItemRow,
                  { borderBottomColor: borderDefault },
                ]}
              >
                <TouchableOpacity
                  style={styles.profileItemLeft}
                  onPress={() => handleSelectProfile(profile)}
                  activeOpacity={0.7}
                >
                  {profile.avatar_url ? (
                    <Image
                      source={{ uri: getFullRemoteUrl(profile.avatar_url) }}
                      style={styles.smallAvatar}
                    />
                  ) : (
                    <View
                      style={[
                        styles.smallAvatarPlaceholder,
                        { backgroundColor: inputBg },
                      ]}
                    >
                      <Text
                        style={[styles.smallAvatarText, { color: textColor }]}
                      >
                        {getInitials(profile.name, profile.username)}
                      </Text>
                    </View>
                  )}
                  <View style={styles.profileItemMeta}>
                    <Text
                      style={[styles.profileItemName, { color: textColor }]}
                      numberOfLines={1}
                    >
                      {profile.name || profile.username}
                    </Text>
                    <Text
                      style={[
                        styles.profileItemEmail,
                        { color: textSecondary },
                      ]}
                      numberOfLines={1}
                    >
                      {profile.email}
                    </Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.removeProfileButton}
                  onPress={() => {
                    Alert.alert(
                      "Remover conta",
                      `Deseja remover @${profile.username} desta lista?`,
                      [
                        { text: "Cancelar", style: "cancel" },
                        {
                          text: "Remover",
                          style: "destructive",
                          onPress: () => removeProfile(profile.user_id),
                        },
                      ],
                    );
                  }}
                >
                  <Trash2 size={16} color="#EF4444" />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {/* Action options */}
        <View style={styles.savedProfileActions}>
          <TouchableOpacity
            style={styles.actionOutlineButton}
            onPress={() => router.push("/login")}
            activeOpacity={0.7}
          >
            <Plus size={16} color={textColor} style={{ marginRight: 8 }} />
            <Text
              style={[styles.actionOutlineButtonText, { color: textColor }]}
            >
              Entrar em outra conta
            </Text>
          </TouchableOpacity>
        </View>

        {/* Footer register */}
        <View style={styles.footerSection}>
          <TouchableOpacity
            onPress={() => router.push("/register")}
            activeOpacity={0.7}
            style={styles.linkContainer}
          >
            <Text style={[styles.linkText, { color: textSecondary }]}>
              Não tem uma conta?{" "}
              <Text
                style={[
                  styles.linkHighlight,
                  { color: colors.brandGreen || "#10B981" },
                ]}
              >
                Cadastre-se
              </Text>
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Bottom Sheet for Account Options */}
      <BottomSheetModal
        ref={bottomSheetRef}
        snapPoints={["25%"]}
        backdropComponent={renderBackdrop}
        backgroundStyle={{ backgroundColor: colors.menuBackground }}
        handleIndicatorStyle={{ backgroundColor: colors.border }}
      >
        <BottomSheetView style={{ padding: 24, paddingBottom: 40 }}>
          <Text
            style={{
              fontSize: 18,
              fontWeight: "700",
              color: textColor,
              marginBottom: 16,
            }}
          >
            Opções da conta
          </Text>
          <View
            style={{
              height: StyleSheet.hairlineWidth,
              backgroundColor: borderDefault,
              marginBottom: 12,
            }}
          />

          <TouchableOpacity
            style={{
              flexDirection: "row",
              alignItems: "center",
              paddingVertical: 12,
            }}
            activeOpacity={0.7}
            onPress={() => {
              bottomSheetRef.current?.dismiss();
              Alert.alert(
                "Remover conta",
                `Deseja remover @${mainProfile.username} da lista de contas salvas?`,
                [
                  { text: "Cancelar", style: "cancel" },
                  {
                    text: "Remover",
                    style: "destructive",
                    onPress: () => removeProfile(mainProfile.user_id),
                  },
                ],
              );
            }}
          >
            <Trash2 size={20} color="#EF4444" style={{ marginRight: 12 }} />
            <Text style={{ color: "#EF4444", fontSize: 16, fontWeight: "600" }}>
              Remover conta atual
            </Text>
          </TouchableOpacity>
        </BottomSheetView>
      </BottomSheetModal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "flex-start",
    paddingHorizontal: 28,
  },
  headerLogoContainer: {
    alignItems: "center",
    marginTop: 20,
    marginBottom: 10,
  },
  appLogoText: {
    fontSize: 14,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 4,
  },

  mainProfileSection: {
    alignItems: "center",
    marginVertical: 32,
  },
  avatarContainer: {
    borderWidth: 3,
    borderRadius: 75,
    padding: 3,
    marginBottom: 16,
  },
  mainAvatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  mainAvatarPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: "center",
    alignItems: "center",
  },
  mainAvatarPlaceholderText: {
    fontSize: 48,
    fontWeight: "bold",
  },
  mainProfileName: {
    fontSize: 22,
    fontWeight: "bold",
    marginBottom: 4,
  },
  mainProfileUsername: {
    fontSize: 14,
    marginBottom: 20,
  },
  continueButton: {
    width: "100%",
    paddingVertical: 16,
    borderRadius: 50,
    alignItems: "center",
    justifyContent: "center",
  },
  continueButtonText: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "bold",
  },
  otherProfilesContainer: {
    width: "100%",
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "bold",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  profileItemRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: 0.5,
  },
  profileItemLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: 12,
  },
  smallAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  smallAvatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
  },
  smallAvatarText: {
    fontSize: 18,
    fontWeight: "bold",
  },
  profileItemMeta: {
    marginLeft: 12,
    flex: 1,
  },
  profileItemName: {
    fontSize: 15,
    fontWeight: "600",
  },
  profileItemEmail: {
    fontSize: 12,
    marginTop: 2,
  },
  removeProfileButton: {
    padding: 8,
  },
  savedProfileActions: {
    alignItems: "center",
    width: "100%",
    gap: 16,
    marginBottom: 16,
  },
  actionOutlineButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    paddingVertical: 14,
    borderRadius: 8,
  },
  actionOutlineButtonText: {
    fontSize: 14,
    fontWeight: "600",
  },
  removeMainProfileLink: {
    paddingVertical: 6,
  },
  footerSection: {
    paddingTop: 24,
    alignItems: "center",
    marginTop: "auto",
  },
  linkContainer: {
    paddingVertical: 8,
  },
  linkText: {
    fontSize: 14,
  },
  linkHighlight: {
    fontWeight: "700",
  },
});
