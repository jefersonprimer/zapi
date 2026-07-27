import React, { useState, useRef, useCallback, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
  Alert,
  Image,
  ActivityIndicator,
  Clipboard,
  Animated,
} from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "@/context/AuthContext";
import { useAppTheme } from "@/context/ThemeContext";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  ArrowLeft,
  ChevronRight,
  Lock,
  Globe,
  LogOut,
  Palette,
  Camera,
  Laptop,
  CreditCard,
} from "lucide-react-native";
import {
  BottomSheetModal,
  BottomSheetView,
  BottomSheetBackdrop,
} from "@gorhom/bottom-sheet";
import { API_URL, uploadImage, updateProfile } from "@/services/api";
import ImagePickerModal from "@/components/ImagePickerModal";
const ACTIVE_GREEN = "#34C759";

const RadioButton = ({
  selected,
  isDark,
}: {
  selected: boolean;
  isDark: boolean;
}) => (
  <View
    style={[
      styles.radioOuter,
      { borderColor: selected ? ACTIVE_GREEN : isDark ? "#48484A" : "#C7C7CC" },
    ]}
  >
    {selected && (
      <View style={[styles.radioInner, { backgroundColor: ACTIVE_GREEN }]} />
    )}
  </View>
);

export default function SettingsScreen() {
  const router = useRouter();
  const { user, token, signOut, updateUser } = useAuth();
  const { colors, themePreference, setThemePreference, isDark } = useAppTheme();
  const insets = useSafeAreaInsets();

  const langBottomSheetModalRef = useRef<BottomSheetModal>(null);
  const [avatarModalVisible, setAvatarModalVisible] = useState(false);

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

  // Modals visibility states
  const [themeModalVisible, setThemeModalVisible] = useState(false);
  const [tempThemePreference, setTempThemePreference] =
    useState(themePreference);

  // Theme modal animation
  const themeDialogAnimation = useRef(new Animated.Value(0)).current;
  const [themeShouldRender, setThemeShouldRender] = useState(false);

  useEffect(() => {
    if (themeModalVisible) {
      setThemeShouldRender(true);
      themeDialogAnimation.setValue(0);
      Animated.spring(themeDialogAnimation, {
        toValue: 1,
        tension: 90,
        friction: 9,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(themeDialogAnimation, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }).start(() => {
        setThemeShouldRender(false);
      });
    }
  }, [themeModalVisible, themeDialogAnimation]);

  const handleThemeClose = (callback?: () => void) => {
    Animated.timing(themeDialogAnimation, {
      toValue: 0,
      duration: 150,
      useNativeDriver: true,
    }).start(() => {
      setThemeModalVisible(false);
      if (callback) callback();
    });
  };

  const [isUpdating, setIsUpdating] = useState(false);
  const [showHeaderProfile, setShowHeaderProfile] = useState(false);

  const uploadAndSaveAvatar = async (uri: string) => {
    if (!token) return;
    setIsUpdating(true);
    try {
      const uploadRes = await uploadImage(token, uri);
      await updateProfile(token, uploadRes.url);
      await updateUser({ avatar_url: uploadRes.url });
    } catch (err: any) {
      Alert.alert("Erro", err.message || "Falha ao atualizar foto de perfil");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleRemovePhoto = async () => {
    Alert.alert(
      "Remover Foto",
      "Tem certeza que deseja remover sua foto de perfil?",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Remover",
          style: "destructive",
          onPress: async () => {
            setAvatarModalVisible(false);
            setIsUpdating(true);
            try {
              if (token) {
                await updateProfile(token, null);
                await updateUser({ avatar_url: null });
              }
            } catch (err: any) {
              Alert.alert(
                "Erro",
                err.message || "Falha ao remover foto de perfil",
              );
            } finally {
              setIsUpdating(false);
            }
          },
        },
      ],
    );
  };

  const getThemeLabel = (pref: string) => {
    switch (pref) {
      case "light":
        return "Claro";
      case "dark":
        return "Escuro";
      case "system":
        return "Padrão do sistema";
      default:
        return pref;
    }
  };

  const handleSignOut = () => {
    Alert.alert("Sair da Conta", "Tem certeza que deseja sair do aplicativo?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Sair",
        style: "destructive",
        onPress: async () => {
          await signOut();
        },
      },
    ]);
  };

  const displayName = user?.name || user?.username || "Carregando...";
  const nameInitial = displayName ? displayName[0]?.toUpperCase() : "?";

  const currentAvatarUrl = user?.avatar_url;
  const avatarUri = currentAvatarUrl
    ? currentAvatarUrl.startsWith("http")
      ? currentAvatarUrl
      : `${API_URL}${currentAvatarUrl}`
    : null;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Custom Header */}
      <View
        style={[
          styles.customHeader,
          {
            paddingTop: insets.top,
            backgroundColor: colors.headerBackground,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <View style={styles.headerContent}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backBtn}
          >
            <ArrowLeft size={24} color={colors.headerText} />
          </TouchableOpacity>

          {showHeaderProfile ? (
            <View style={styles.headerProfileContainer}>
              <View
                style={[
                  styles.miniAvatar,
                  {
                    backgroundColor: isDark ? "#2C2C2E" : "#F2F2F7",
                    overflow: "hidden",
                  },
                ]}
              >
                {avatarUri ? (
                  <Image
                    source={{ uri: avatarUri }}
                    style={styles.miniAvatarImage}
                  />
                ) : (
                  <Text
                    style={[
                      styles.miniAvatarText,
                      { color: colors.textSecondary },
                    ]}
                  >
                    {nameInitial}
                  </Text>
                )}
              </View>
              <Text
                numberOfLines={1}
                style={[styles.headerProfileName, { color: colors.headerText }]}
              >
                {displayName}
              </Text>
            </View>
          ) : (
            <Text
              style={[
                styles.headerTitle,
                { color: colors.headerText, flex: 1 },
              ]}
            >
              Configurações
            </Text>
          )}

          <View style={{ width: 24 }} />
        </View>
      </View>

      {isUpdating && (
        <View
          style={[
            styles.overlayLoading,
            { backgroundColor: colors.modalOverlay },
          ]}
        >
          <ActivityIndicator size="large" color={colors.tint} />
        </View>
      )}

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        onScroll={(event) => {
          const y = event.nativeEvent.contentOffset.y;
          if (y > 100) {
            if (!showHeaderProfile) setShowHeaderProfile(true);
          } else {
            if (showHeaderProfile) setShowHeaderProfile(false);
          }
        }}
        scrollEventThrottle={16}
      >
        {/* Profile Header Block */}
        <View style={styles.profileHeader}>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => setAvatarModalVisible(true)}
            style={styles.avatarContainer}
            disabled={isUpdating}
          >
            <View
              style={[
                styles.avatar,
                {
                  backgroundColor: isDark ? "#2C2C2E" : "#F2F2F7",
                  overflow: "hidden",
                },
              ]}
            >
              {avatarUri ? (
                <Image source={{ uri: avatarUri }} style={styles.avatarImage} />
              ) : (
                <Text
                  style={[styles.avatarText, { color: colors.textSecondary }]}
                >
                  {nameInitial}
                </Text>
              )}
            </View>
            <View
              style={[
                styles.editBadge,
                {
                  backgroundColor: colors.tint,
                  borderColor: colors.background,
                },
              ]}
            >
              <Camera size={12} color="#FFF" />
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => router.push("/edit-profile?field=name")}
            activeOpacity={0.7}
            disabled={isUpdating}
          >
            <Text style={[styles.displayName, { color: colors.text }]}>
              {displayName}
            </Text>
          </TouchableOpacity>

          {!!user?.username && (
            <TouchableOpacity
              onPress={() => router.push("/edit-profile?field=username")}
              activeOpacity={0.7}
              disabled={isUpdating}
            >
              <Text
                style={[styles.usernameText, { color: colors.textSecondary }]}
              >
                @{user?.username}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        <View
          style={[styles.sectionDivider, { backgroundColor: colors.border }]}
        />

        {/* Informações Section (Telegram style: value-first, label-second, copy/edit on press) */}
        <View style={styles.infoSection}>
          {/* Recado Item */}
          <TouchableOpacity
            activeOpacity={0.6}
            onPress={() => router.push("/edit-profile?field=about")}
            style={styles.infoItem}
            disabled={isUpdating}
          >
            <Text style={[styles.infoValueText, { color: colors.text }]}>
              {user?.about || "Toque para adicionar um recado"}
            </Text>
            <Text
              style={[styles.infoLabelText, { color: colors.textSecondary }]}
            >
              Recado
            </Text>
          </TouchableOpacity>

          <View
            style={[styles.innerDivider, { backgroundColor: colors.border }]}
          />

          {/* Nome Item */}
          <TouchableOpacity
            activeOpacity={0.6}
            onPress={() => router.push("/edit-profile?field=name")}
            style={styles.infoItem}
            disabled={isUpdating}
          >
            <Text style={[styles.infoValueText, { color: colors.text }]}>
              {user?.name || user?.username || "Sem nome"}
            </Text>
            <Text
              style={[styles.infoLabelText, { color: colors.textSecondary }]}
            >
              Nome
            </Text>
          </TouchableOpacity>

          <View
            style={[styles.innerDivider, { backgroundColor: colors.border }]}
          />

          {/* Username Item */}
          <TouchableOpacity
            activeOpacity={0.6}
            onPress={() => router.push("/edit-profile?field=username")}
            style={styles.infoItem}
            disabled={isUpdating}
          >
            <Text style={[styles.infoValueText, { color: colors.text }]}>
              @{user?.username || "Sem username"}
            </Text>
            <Text
              style={[styles.infoLabelText, { color: colors.textSecondary }]}
            >
              Nome de usuário
            </Text>
          </TouchableOpacity>

          <View
            style={[styles.innerDivider, { backgroundColor: colors.border }]}
          />

          {/* Email Item */}
          <TouchableOpacity
            activeOpacity={0.6}
            onPress={() => {
              if (user?.email) {
                Clipboard.setString(user.email);
              }
            }}
            style={styles.infoItem}
          >
            <Text style={[styles.infoValueText, { color: colors.text }]}>
              {user?.email || "E-mail indisponível"}
            </Text>
            <Text
              style={[styles.infoLabelText, { color: colors.textSecondary }]}
            >
              E-mail
            </Text>
          </TouchableOpacity>
        </View>

        <View
          style={[styles.sectionDivider, { backgroundColor: colors.border }]}
        />

        {/* Options Section */}
        <View style={styles.optionsSection}>
          {/* Privacidade */}
          <TouchableOpacity
            style={styles.optionRowClickable}
            onPress={() => router.push("/privacy")}
          >
            <View style={styles.optionLeft}>
              <Lock size={20} color={colors.textSecondary} />
              <View style={styles.optionTextContainer}>
                <Text style={[styles.optionTitle, { color: colors.text }]}>
                  Privacidade
                </Text>
                <Text
                  style={[styles.optionSub, { color: colors.textSecondary }]}
                >
                  Segurança, bloqueios, confirmações
                </Text>
              </View>
            </View>
            <ChevronRight size={20} color={colors.textSecondary} />
          </TouchableOpacity>

          {/* Pagamentos */}
          <TouchableOpacity
            style={styles.optionRowClickable}
            onPress={() => router.push("/payments")}
          >
            <View style={styles.optionLeft}>
              <CreditCard size={20} color={colors.textSecondary} />
              <View style={styles.optionTextContainer}>
                <Text style={[styles.optionTitle, { color: colors.text }]}>
                  Pagamentos
                </Text>
                <Text
                  style={[styles.optionSub, { color: colors.textSecondary }]}
                >
                  Gerenciar sua chave Pix
                </Text>
              </View>
            </View>
            <ChevronRight size={20} color={colors.textSecondary} />
          </TouchableOpacity>

          {/* Idioma do app */}
          <TouchableOpacity
            style={styles.optionRowClickable}
            onPress={() => langBottomSheetModalRef.current?.present()}
          >
            <View style={styles.optionLeft}>
              <Globe size={20} color={colors.textSecondary} />
              <View style={styles.optionTextContainer}>
                <Text style={[styles.optionTitle, { color: colors.text }]}>
                  Idioma do app
                </Text>
                <Text
                  style={[styles.optionSub, { color: colors.textSecondary }]}
                >
                  Português (Brasil)
                </Text>
              </View>
            </View>
            <ChevronRight size={20} color={colors.textSecondary} />
          </TouchableOpacity>

          {/* Tema */}
          <TouchableOpacity
            style={styles.optionRowClickable}
            onPress={() => {
              setTempThemePreference(themePreference);
              setThemeModalVisible(true);
            }}
          >
            <View style={styles.optionLeft}>
              <Palette size={20} color={colors.textSecondary} />
              <View style={styles.optionTextContainer}>
                <Text style={[styles.optionTitle, { color: colors.text }]}>
                  Tema
                </Text>
                <Text
                  style={[styles.optionSub, { color: colors.textSecondary }]}
                >
                  {getThemeLabel(themePreference)}
                </Text>
              </View>
            </View>
            <ChevronRight size={20} color={colors.textSecondary} />
          </TouchableOpacity>

          {/* Aparelhos Conectados */}
          <TouchableOpacity
            style={styles.optionRowClickable}
            onPress={() => router.push("/link-device?mode=link")}
          >
            <View style={styles.optionLeft}>
              <Laptop size={20} color={colors.textSecondary} />
              <View style={styles.optionTextContainer}>
                <Text style={[styles.optionTitle, { color: colors.text }]}>
                  Aparelhos conectados
                </Text>
                <Text
                  style={[styles.optionSub, { color: colors.textSecondary }]}
                >
                  Zapi Web / Conectar novo navegador
                </Text>
              </View>
            </View>
            <ChevronRight size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        <View
          style={[styles.sectionDivider, { backgroundColor: colors.border }]}
        />

        {/* Danger Zone Options */}
        <View style={styles.optionsSection}>
          <TouchableOpacity
            style={styles.optionRowClickable}
            onPress={handleSignOut}
          >
            <View style={styles.optionLeft}>
              <LogOut size={20} color={colors.danger} />
              <View style={styles.optionTextContainer}>
                <Text
                  style={[
                    styles.optionTitle,
                    { color: colors.danger, fontWeight: "500" },
                  ]}
                >
                  Sair da conta
                </Text>
                <Text
                  style={[styles.optionSub, { color: colors.textSecondary }]}
                >
                  Desconectar deste dispositivo
                </Text>
              </View>
            </View>
          </TouchableOpacity>
        </View>

        <View style={styles.infoFooter}>
          <Text
            style={[styles.infoFooterText, { color: colors.textSecondary }]}
          >
            Zapi v1.0.0
          </Text>
          <Text
            style={[styles.infoFooterSubtext, { color: colors.textSecondary }]}
          >
            Criptografado ponta a ponta
          </Text>
        </View>
      </ScrollView>

      {/* Avatar Selection Modal */}
      <ImagePickerModal
        visible={avatarModalVisible}
        onClose={() => setAvatarModalVisible(false)}
        onImageSelected={uploadAndSaveAvatar}
        onRemoveImage={handleRemovePhoto}
        hasImage={!!user?.avatar_url}
        title="Foto do perfil"
      />

      {/* Language Selection Modal */}
      <BottomSheetModal
        ref={langBottomSheetModalRef}
        snapPoints={["40%"]}
        backdropComponent={renderBackdrop}
        backgroundStyle={{ backgroundColor: colors.menuBackground }}
        handleIndicatorStyle={{ backgroundColor: colors.border }}
      >
        <BottomSheetView style={{ padding: 24, paddingBottom: 40 }}>
          <Text
            style={[
              styles.sheetTitle,
              { color: colors.text, marginBottom: 16 },
            ]}
          >
            Idioma do app
          </Text>
          <View
            style={{
              height: StyleSheet.hairlineWidth,
              backgroundColor: colors.border,
              marginBottom: 12,
            }}
          />

          <TouchableOpacity
            style={[
              styles.sheetOption,
              {
                backgroundColor: "transparent",
                paddingHorizontal: 0,
                paddingVertical: 12,
              },
            ]}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.sheetOptionText,
                { color: colors.text, fontWeight: "600" },
              ]}
            >
              Português (Brasil)
            </Text>
            <RadioButton selected={true} isDark={isDark} />
          </TouchableOpacity>

          <Text style={[styles.sheetInfoText, { color: colors.textSecondary }]}>
            Por enquanto o Zapi está disponível somente em Português (Brasil).
            Novos idiomas serão adicionados em breve.
          </Text>

          <TouchableOpacity
            style={[styles.sheetCloseButton, { backgroundColor: colors.tint }]}
            onPress={() => langBottomSheetModalRef.current?.dismiss()}
          >
            <Text style={styles.sheetCloseButtonText}>OK</Text>
          </TouchableOpacity>
        </BottomSheetView>
      </BottomSheetModal>

      {/* Theme Choice Dialog Modal */}
      {themeShouldRender && (
        <Modal
          visible={themeShouldRender}
          transparent={true}
          animationType="none"
          statusBarTranslucent={true}
          onRequestClose={() => handleThemeClose()}
        >
          <TouchableOpacity
            style={[styles.dialogOverlay, { zIndex: 1000 }]}
            activeOpacity={1}
            onPress={() => handleThemeClose()}
          >
            <Animated.View
              style={[
                StyleSheet.absoluteFillObject,
                {
                  backgroundColor: colors.modalOverlay,
                  opacity: themeDialogAnimation.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, 1],
                  }),
                },
              ]}
            />
            <Animated.View
              style={[
                styles.themeDialog,
                {
                  backgroundColor: isDark
                    ? "rgba(30, 30, 30, 0.85)"
                    : "rgba(255, 255, 255, 0.85)",
                  borderColor: colors.border,
                  opacity: themeDialogAnimation.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, 1],
                  }),
                  transform: [
                    {
                      scale: themeDialogAnimation.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.93, 1],
                      }),
                    },
                    {
                      translateY: themeDialogAnimation.interpolate({
                        inputRange: [0, 1],
                        outputRange: [20, 0],
                      }),
                    },
                  ],
                },
              ]}
            >
              <Text style={[styles.dialogTitle, { color: colors.text }]}>
                Escolher Tema
              </Text>

              <TouchableOpacity
                style={styles.dialogOption}
                onPress={() => setTempThemePreference("light")}
              >
                <Text
                  style={[
                    styles.dialogOptionText,
                    { color: colors.text },
                    tempThemePreference === "light" && {
                      color: colors.tint,
                      fontWeight: "600",
                    },
                  ]}
                >
                  Claro
                </Text>
                <RadioButton
                  selected={tempThemePreference === "light"}
                  isDark={isDark}
                />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.dialogOption}
                onPress={() => setTempThemePreference("dark")}
              >
                <Text
                  style={[
                    styles.dialogOptionText,
                    { color: colors.text },
                    tempThemePreference === "dark" && {
                      color: colors.tint,
                      fontWeight: "600",
                    },
                  ]}
                >
                  Escuro
                </Text>
                <RadioButton
                  selected={tempThemePreference === "dark"}
                  isDark={isDark}
                />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.dialogOption}
                onPress={() => setTempThemePreference("system")}
              >
                <Text
                  style={[
                    styles.dialogOptionText,
                    { color: colors.text },
                    tempThemePreference === "system" && {
                      color: colors.tint,
                      fontWeight: "600",
                    },
                  ]}
                >
                  Padrão do Sistema
                </Text>
                <RadioButton
                  selected={tempThemePreference === "system"}
                  isDark={isDark}
                />
              </TouchableOpacity>

              <View
                style={[
                  styles.menuDivider,
                  { backgroundColor: colors.border, marginVertical: 8 },
                ]}
              />

              <View style={styles.footerButtons}>
                <TouchableOpacity
                  onPress={() => handleThemeClose()}
                  style={styles.footerBtn}
                >
                  <Text
                    style={{
                      color: colors.textSecondary,
                      fontSize: 16,
                      fontWeight: "500",
                    }}
                  >
                    Cancelar
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    handleThemeClose(async () => {
                      await setThemePreference(tempThemePreference);
                    });
                  }}
                  style={styles.footerBtn}
                >
                  <Text
                    style={{
                      color: colors.tint,
                      fontSize: 16,
                      fontWeight: "600",
                    }}
                  >
                    OK
                  </Text>
                </TouchableOpacity>
              </View>
            </Animated.View>
          </TouchableOpacity>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  overlayLoading: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 999,
    justifyContent: "center",
    alignItems: "center",
  },
  customHeader: {
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerContent: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    marginTop: 8,
  },
  backBtn: {
    padding: 4,
    marginRight: 16,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "bold",
    flex: 1,
  },
  headerProfileContainer: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: 10,
  },
  miniAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  miniAvatarImage: {
    width: "100%",
    height: "100%",
  },
  miniAvatarText: {
    fontSize: 14,
    fontWeight: "600",
  },
  headerProfileName: {
    fontSize: 16,
    fontWeight: "600",
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  profileHeader: {
    alignItems: "center",
    paddingTop: 24,
    paddingBottom: 16,
  },
  avatarContainer: {
    width: 110,
    height: 110,
    marginBottom: 16,
    position: "relative",
  },
  avatar: {
    width: 110,
    height: 110,
    borderRadius: 55,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarImage: {
    width: "100%",
    height: "100%",
  },
  avatarText: {
    fontSize: 44,
    fontWeight: "300",
  },
  editBadge: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    justifyContent: "center",
    alignItems: "center",
  },
  displayName: {
    fontSize: 22,
    fontWeight: "600",
    textAlign: "center",
  },
  usernameText: {
    fontSize: 15,
    marginTop: 4,
    textAlign: "center",
  },
  sectionDivider: {
    height: StyleSheet.hairlineWidth,
    width: "100%",
    marginVertical: 12,
  },
  infoSection: {
    paddingHorizontal: 20,
    paddingVertical: 4,
  },
  infoItem: {
    paddingVertical: 10,
  },
  infoValueText: {
    fontSize: 16,
    fontWeight: "400",
  },
  infoLabelText: {
    fontSize: 13,
    marginTop: 4,
  },
  innerDivider: {
    height: StyleSheet.hairlineWidth,
    width: "100%",
  },
  optionsSection: {
    paddingHorizontal: 20,
    paddingVertical: 4,
  },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
  },
  optionRowClickable: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
  },
  optionLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: 16,
  },
  optionTextContainer: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: "400",
  },
  optionSub: {
    fontSize: 13,
    marginTop: 2,
  },
  infoFooter: {
    alignItems: "center",
    marginTop: 20,
    marginBottom: 10,
    gap: 4,
  },
  infoFooterText: {
    fontSize: 14,
    fontWeight: "600",
  },
  infoFooterSubtext: {
    fontSize: 12,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  bottomSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    borderTopWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 16,
  },
  sheetIndicator: {
    width: 40,
    height: 5,
    borderRadius: 2.5,
    alignSelf: "center",
    marginBottom: 20,
  },
  sheetTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 20,
  },
  sheetHeaderWithIcon: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
  },
  sheetOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    borderRadius: 16,
    marginBottom: 16,
  },
  sheetOptionLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  sheetOptionText: {
    fontSize: 16,
  },
  checkedCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  sheetInfoText: {
    fontSize: 13,
    lineHeight: 18,
    textAlign: "center",
    paddingHorizontal: 12,
    marginBottom: 24,
  },
  sheetCloseButton: {
    height: 50,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sheetCloseButtonText: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "bold",
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  toggleTextContainer: {
    flex: 1,
    paddingRight: 16,
  },
  toggleTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 4,
  },
  toggleSubtitle: {
    fontSize: 13,
    lineHeight: 18,
  },
  dialogOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  themeDialog: {
    width: "80%",
    borderRadius: 16,
    padding: 20,
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 15,
    elevation: 10,
  },
  dialogTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 16,
  },
  dialogOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    paddingHorizontal: 4,
  },
  dialogOptionLabel: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  dialogOptionText: {
    fontSize: 16,
  },
  menuDivider: {
    height: StyleSheet.hairlineWidth,
  },
  dialogCloseButton: {
    alignItems: "flex-end",
    paddingTop: 8,
    paddingRight: 4,
  },
  dialogCloseText: {
    fontSize: 16,
    fontWeight: "600",
  },
  aboutInput: {
    minHeight: 88,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    textAlignVertical: "top",
  },
  aboutCounter: {
    alignSelf: "flex-end",
    fontSize: 12,
    marginTop: 6,
    marginBottom: 4,
  },
  privacyOptionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  privacyOptionText: {
    fontSize: 15,
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    justifyContent: "center",
    alignItems: "center",
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  footerButtons: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 16,
    marginTop: 4,
  },
  footerBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
});
