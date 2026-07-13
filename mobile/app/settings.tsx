import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
  Switch,
  Alert,
  Platform,
  Image,
  ActivityIndicator,
  TextInput,
} from "react-native";
import { useRouter } from "expo-router";
import { useAuth, getStorageItem, setStorageItem } from "@/context/AuthContext";
import { useAppTheme } from "@/context/ThemeContext";
import {
  ArrowLeft,
  ChevronRight,
  Lock,
  Globe,
  LogOut,
  Check,
  Shield,
  Palette,
  Sun,
  Moon,
  Laptop,
  Camera,
  Image as ImageIcon,
  MessageSquareText,
} from "lucide-react-native";
import * as ImagePicker from "expo-image-picker";
import { API_URL, uploadImage, updateProfile } from "@/services/api";

const ABOUT_MAX_LEN = 139;

export default function SettingsScreen() {
  const router = useRouter();
  const { user, token, signOut, updateUser } = useAuth();
  const { colors, themePreference, setThemePreference } = useAppTheme();

  // Modals visibility states
  const [langModalVisible, setLangModalVisible] = useState(false);
  const [themeModalVisible, setThemeModalVisible] = useState(false);
  const [privacyModalVisible, setPrivacyModalVisible] = useState(false);
  const [avatarModalVisible, setAvatarModalVisible] = useState(false);
  const [aboutModalVisible, setAboutModalVisible] = useState(false);
  const [aboutDraft, setAboutDraft] = useState("");

  const [isUpdating, setIsUpdating] = useState(false);

  // Privacy dummy states
  const [readReceipts, setReadReceipts] = useState(true);
  const [onlineStatus, setOnlineStatus] = useState(true);
  const [keepChatsArchived, setKeepChatsArchived] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const savedKeepArchived = await getStorageItem("keep_chats_archived");
        if (savedKeepArchived !== null) {
          setKeepChatsArchived(savedKeepArchived === "true");
        }
      } catch (e) {
        console.warn("Error loading keep_chats_archived preference:", e);
      }
    })();
  }, []);
  const handleKeepChatsArchivedChange = async (value: boolean) => {
    setKeepChatsArchived(value);
    try {
      await setStorageItem("keep_chats_archived", value ? "true" : "false");
      if (token) {
        await updateProfile(token, undefined, value);
      }
    } catch (err) {
      console.warn("Failed to update keep_chats_archived setting:", err);
    }
  };
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

  const handleCamera = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permissão necessária", "Precisamos de permissão para usar a câmera.");
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setAvatarModalVisible(false);
        await uploadAndSaveAvatar(result.assets[0].uri);
      }
    } catch (e) {
      console.error(e);
      Alert.alert("Erro", "Ocorreu um erro ao abrir a câmera.");
    }
  };

  const handleGallery = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permissão necessária", "Precisamos de permissão para acessar a galeria.");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setAvatarModalVisible(false);
        await uploadAndSaveAvatar(result.assets[0].uri);
      }
    } catch (e) {
      console.error(e);
      Alert.alert("Erro", "Ocorreu um erro ao abrir a galeria.");
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
              Alert.alert("Erro", err.message || "Falha ao remover foto de perfil");
            } finally {
              setIsUpdating(false);
            }
          }
        }
      ]
    );
  };

  const openAboutModal = () => {
    setAboutDraft(user?.about || "");
    setAboutModalVisible(true);
  };

  const handleSaveAbout = async () => {
    if (!token) return;
    const trimmed = aboutDraft.trim();
    if (trimmed.length > ABOUT_MAX_LEN) {
      Alert.alert("Erro", `O recado pode ter no máximo ${ABOUT_MAX_LEN} caracteres.`);
      return;
    }
    setIsUpdating(true);
    try {
      await updateProfile(token, undefined, undefined, trimmed);
      await updateUser({ about: trimmed || null });
      setAboutModalVisible(false);
    } catch (err: any) {
      Alert.alert("Erro", err.message || "Falha ao atualizar recado");
    } finally {
      setIsUpdating(false);
    }
  };

  // Format theme text
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
    Alert.alert(
      "Sair da Conta",
      "Tem certeza que deseja sair do aplicativo?",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Sair",
          style: "destructive",
          onPress: async () => {
            await signOut();
          },
        },
      ]
    );
  };

  const initials = user?.username ? user.username.substring(0, 2).toUpperCase() : "US";

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View
        style={[
          styles.header,
          {
            backgroundColor: colors.headerBackground,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <ArrowLeft color={colors.headerText} size={24} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.headerText }]}>
          Configurações
        </Text>
        <View style={styles.headerRightPlaceholder} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Profile Card (Vertical Layout) */}
        <View
          style={[
            styles.profileCardVertical,
            {
              backgroundColor: colors.menuBackground,
              borderColor: colors.border,
            },
          ]}
        >
          <TouchableOpacity
            style={styles.avatarButton}
            onPress={() => setAvatarModalVisible(true)}
            activeOpacity={0.8}
            disabled={isUpdating}
          >
            <View style={[styles.largeAvatarContainer, { backgroundColor: colors.tint }]}>
              {isUpdating ? (
                <ActivityIndicator size="large" color="#FFF" />
              ) : user?.avatar_url ? (
                <Image
                  source={{
                    uri: user.avatar_url.startsWith("http")
                      ? user.avatar_url
                      : `${API_URL}${user.avatar_url}`,
                  }}
                  style={styles.largeAvatarImage}
                />
              ) : (
                <Text style={styles.largeAvatarText}>{initials}</Text>
              )}
              
              <View style={[styles.editBadge, { backgroundColor: colors.tint }]}>
                <Camera size={12} color="#FFF" />
              </View>
            </View>
          </TouchableOpacity>

          <View style={styles.profileInfoVertical}>
            <Text style={[styles.usernameTextVertical, { color: colors.text }]}>
              {user?.username || "Usuário"}
            </Text>
            <Text style={[styles.emailTextVertical, { color: colors.textSecondary }]}>
              {user?.email || "usuario@exemplo.com"}
            </Text>
            <TouchableOpacity
              style={styles.aboutTapArea}
              onPress={openAboutModal}
              activeOpacity={0.7}
              disabled={isUpdating}
            >
              <Text
                style={[
                  styles.aboutText,
                  {
                    color: user?.about ? colors.textSecondary : colors.textSecondary,
                    fontStyle: user?.about ? "normal" : "italic",
                  },
                ]}
                numberOfLines={2}
              >
                {user?.about || "Toque para adicionar um recado"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Section Title */}
        <Text style={[styles.sectionTitle, { color: colors.tint }]}>
          GERAL
        </Text>

        {/* Settings Group */}
        <View
          style={[
            styles.settingsGroup,
            {
              backgroundColor: colors.menuBackground,
              borderColor: colors.border,
            },
          ]}
        >
          {/* Privacy Option */}
          <TouchableOpacity
            style={[styles.settingRow, { borderBottomColor: colors.border }]}
            onPress={() => setPrivacyModalVisible(true)}
          >
            <View style={[styles.iconWrapper, { backgroundColor: "rgba(16, 185, 129, 0.1)" }]}>
              <Lock color="#10B981" size={20} />
            </View>
            <View style={styles.rowTextContainer}>
              <Text style={[styles.rowTitle, { color: colors.text }]}>
                Privacidade
              </Text>
              <Text style={[styles.rowSubtitle, { color: colors.textSecondary }]}>
                Segurança, bloqueios, confirmações
              </Text>
            </View>
            <ChevronRight color={colors.textSecondary} size={20} />
          </TouchableOpacity>

          {/* Language Option */}
          <TouchableOpacity
            style={[styles.settingRow, { borderBottomColor: colors.border }]}
            onPress={() => setLangModalVisible(true)}
          >
            <View style={[styles.iconWrapper, { backgroundColor: "rgba(245, 158, 11, 0.1)" }]}>
              <Globe color="#F59E0B" size={20} />
            </View>
            <View style={styles.rowTextContainer}>
              <Text style={[styles.rowTitle, { color: colors.text }]}>
                Idioma do app
              </Text>
              <Text style={[styles.rowSubtitle, { color: colors.textSecondary }]}>
                Português (Brasil)
              </Text>
            </View>
            <ChevronRight color={colors.textSecondary} size={20} />
          </TouchableOpacity>

          {/* Theme Option */}
          <TouchableOpacity
            style={styles.settingRow}
            onPress={() => setThemeModalVisible(true)}
          >
            <View style={[styles.iconWrapper, { backgroundColor: "rgba(59, 130, 246, 0.1)" }]}>
              <Palette color="#3B82F6" size={20} />
            </View>
            <View style={styles.rowTextContainer}>
              <Text style={[styles.rowTitle, { color: colors.text }]}>
                Tema
              </Text>
              <Text style={[styles.rowSubtitle, { color: colors.textSecondary }]}>
                {getThemeLabel(themePreference)}
              </Text>
            </View>
            <ChevronRight color={colors.textSecondary} size={20} />
          </TouchableOpacity>
        </View>

        {/* Section Title */}
        <Text style={[styles.sectionTitle, { color: colors.danger }]}>
          CONTA
        </Text>

        {/* Account Group */}
        <View
          style={[
            styles.settingsGroup,
            {
              backgroundColor: colors.menuBackground,
              borderColor: colors.border,
            },
          ]}
        >
          {/* Sign Out Option */}
          <TouchableOpacity style={styles.settingRow} onPress={handleSignOut}>
            <View style={[styles.iconWrapper, { backgroundColor: "rgba(239, 68, 68, 0.1)" }]}>
              <LogOut color={colors.danger} size={20} />
            </View>
            <View style={styles.rowTextContainer}>
              <Text style={[styles.rowTitle, { color: colors.danger, fontWeight: "600" }]}>
                Sair
              </Text>
              <Text style={[styles.rowSubtitle, { color: colors.textSecondary }]}>
                Desconectar deste dispositivo
              </Text>
            </View>
            <ChevronRight color={colors.danger} size={20} />
          </TouchableOpacity>
        </View>

        <View style={styles.infoFooter}>
          <Text style={[styles.infoFooterText, { color: colors.textSecondary }]}>
            Zapi v1.0.0
          </Text>
          <Text style={[styles.infoFooterSubtext, { color: colors.textSecondary }]}>
            Criptografado ponta a ponta
          </Text>
        </View>
      </ScrollView>

      {/* Avatar Selection Modal */}
      <Modal
        visible={avatarModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setAvatarModalVisible(false)}
      >
        <TouchableOpacity
          style={[styles.modalOverlay, { backgroundColor: colors.modalOverlay }]}
          activeOpacity={1}
          onPress={() => setAvatarModalVisible(false)}
        >
          <View
            style={[
              styles.bottomSheet,
              {
                backgroundColor: colors.menuBackground,
                borderColor: colors.border,
              },
            ]}
          >
            <View style={[styles.sheetIndicator, { backgroundColor: colors.border }]} />
            <Text style={[styles.sheetTitle, { color: colors.text }]}>
              Foto do perfil
            </Text>

            <TouchableOpacity
              style={[styles.sheetOption, { backgroundColor: colors.background }]}
              onPress={handleCamera}
              activeOpacity={0.8}
            >
              <View style={styles.sheetOptionLeft}>
                <Camera size={20} color={colors.tint} />
                <Text style={[styles.sheetOptionText, { color: colors.text, fontWeight: "600" }]}>
                  Câmera
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.sheetOption, { backgroundColor: colors.background }]}
              onPress={handleGallery}
              activeOpacity={0.8}
            >
              <View style={styles.sheetOptionLeft}>
                <ImageIcon size={20} color={colors.tint} />
                <Text style={[styles.sheetOptionText, { color: colors.text, fontWeight: "600" }]}>
                  Galeria
                </Text>
              </View>
            </TouchableOpacity>

            {user?.avatar_url && (
              <TouchableOpacity
                style={[styles.sheetOption, { backgroundColor: colors.background }]}
                onPress={handleRemovePhoto}
                activeOpacity={0.8}
              >
                <View style={styles.sheetOptionLeft}>
                  <LogOut size={20} color={colors.danger} />
                  <Text style={[styles.sheetOptionText, { color: colors.danger, fontWeight: "600" }]}>
                    Remover Foto
                  </Text>
                </View>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[styles.sheetCloseButton, { backgroundColor: colors.tint, marginTop: 8 }]}
              onPress={() => setAvatarModalVisible(false)}
            >
              <Text style={styles.sheetCloseButtonText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* About / Recado Modal */}
      <Modal
        visible={aboutModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setAboutModalVisible(false)}
      >
        <TouchableOpacity
          style={[styles.modalOverlay, { backgroundColor: colors.modalOverlay }]}
          activeOpacity={1}
          onPress={() => setAboutModalVisible(false)}
        >
          <TouchableOpacity
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
            style={[
              styles.bottomSheet,
              {
                backgroundColor: colors.menuBackground,
                borderColor: colors.border,
              },
            ]}
          >
            <View style={[styles.sheetIndicator, { backgroundColor: colors.border }]} />
            <View style={styles.sheetHeaderWithIcon}>
              <MessageSquareText size={24} color={colors.tint} />
              <Text style={[styles.sheetTitle, { color: colors.text, marginLeft: 8 }]}>
                Recado
              </Text>
            </View>

            <TextInput
              style={[
                styles.aboutInput,
                {
                  color: colors.text,
                  backgroundColor: colors.background,
                  borderColor: colors.border,
                },
              ]}
              value={aboutDraft}
              onChangeText={(text) => {
                if (text.length <= ABOUT_MAX_LEN) setAboutDraft(text);
              }}
              placeholder="Escreva um recado..."
              placeholderTextColor={colors.textSecondary}
              multiline
              maxLength={ABOUT_MAX_LEN}
              autoFocus
            />
            <Text style={[styles.aboutCounter, { color: colors.textSecondary }]}>
              {aboutDraft.length}/{ABOUT_MAX_LEN}
            </Text>

            <TouchableOpacity
              style={[styles.sheetCloseButton, { backgroundColor: colors.tint, marginTop: 8 }]}
              onPress={handleSaveAbout}
              disabled={isUpdating}
            >
              {isUpdating ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.sheetCloseButtonText}>Salvar</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.sheetCloseButton, { backgroundColor: colors.background, marginTop: 8 }]}
              onPress={() => setAboutModalVisible(false)}
              disabled={isUpdating}
            >
              <Text style={[styles.sheetCloseButtonText, { color: colors.text }]}>
                Cancelar
              </Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Language Selection Modal */}
      <Modal
        visible={langModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setLangModalVisible(false)}
      >
        <TouchableOpacity
          style={[styles.modalOverlay, { backgroundColor: colors.modalOverlay }]}
          activeOpacity={1}
          onPress={() => setLangModalVisible(false)}
        >
          <View
            style={[
              styles.bottomSheet,
              {
                backgroundColor: colors.menuBackground,
                borderColor: colors.border,
              },
            ]}
          >
            <View style={[styles.sheetIndicator, { backgroundColor: colors.border }]} />
            <Text style={[styles.sheetTitle, { color: colors.text }]}>
              Idioma do app
            </Text>

            <TouchableOpacity
              style={[styles.sheetOption, { backgroundColor: colors.background }]}
              activeOpacity={0.8}
            >
              <View style={styles.sheetOptionLeft}>
                <Globe size={20} color={colors.tint} />
                <Text style={[styles.sheetOptionText, { color: colors.text, fontWeight: "600" }]}>
                  Português (Brasil)
                </Text>
              </View>
              <View style={[styles.checkedCircle, { backgroundColor: colors.tint }]}>
                <Check size={14} color="#FFF" />
              </View>
            </TouchableOpacity>

            <Text style={[styles.sheetInfoText, { color: colors.textSecondary }]}>
              Por enquanto o Zapi está disponível somente em Português (Brasil). Novos idiomas serão adicionados em breve.
            </Text>

            <TouchableOpacity
              style={[styles.sheetCloseButton, { backgroundColor: colors.tint }]}
              onPress={() => setLangModalVisible(false)}
            >
              <Text style={styles.sheetCloseButtonText}>OK</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Privacy Settings Modal */}
      <Modal
        visible={privacyModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setPrivacyModalVisible(false)}
      >
        <TouchableOpacity
          style={[styles.modalOverlay, { backgroundColor: colors.modalOverlay }]}
          activeOpacity={1}
          onPress={() => setPrivacyModalVisible(false)}
        >
          <View
            style={[
              styles.bottomSheet,
              {
                backgroundColor: colors.menuBackground,
                borderColor: colors.border,
              },
            ]}
          >
            <View style={[styles.sheetIndicator, { backgroundColor: colors.border }]} />
            <View style={styles.sheetHeaderWithIcon}>
              <Shield size={24} color="#10B981" />
              <Text style={[styles.sheetTitle, { color: colors.text, marginLeft: 8 }]}>
                Privacidade
              </Text>
            </View>

            {/* Toggle Read Receipts */}
            <View style={[styles.toggleRow, { borderBottomColor: colors.border }]}>
              <View style={styles.toggleTextContainer}>
                <Text style={[styles.toggleTitle, { color: colors.text }]}>
                  Confirmações de leitura
                </Text>
                <Text style={[styles.toggleSubtitle, { color: colors.textSecondary }]}>
                  Se desativar, você não poderá ver nem enviar confirmações de leitura.
                </Text>
              </View>
              <Switch
                value={readReceipts}
                onValueChange={setReadReceipts}
                trackColor={{ false: colors.border, true: colors.tint }}
                thumbColor={Platform.OS === "android" ? (readReceipts ? colors.tint : "#f4f3f4") : undefined}
              />
            </View>

             {/* Toggle Online status */}
            <View style={[styles.toggleRow, { borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth }]}>
              <View style={styles.toggleTextContainer}>
                <Text style={[styles.toggleTitle, { color: colors.text }]}>
                  Visto por último e online
                </Text>
                <Text style={[styles.toggleSubtitle, { color: colors.textSecondary }]}>
                  Mostrar quando você está online ou ativo para outros contatos.
                </Text>
              </View>
              <Switch
                value={onlineStatus}
                onValueChange={setOnlineStatus}
                trackColor={{ false: colors.border, true: colors.tint }}
                thumbColor={Platform.OS === "android" ? (onlineStatus ? colors.tint : "#f4f3f4") : undefined}
              />
            </View>

            {/* Toggle Keep chats archived */}
            <View style={styles.toggleRow}>
              <View style={styles.toggleTextContainer}>
                <Text style={[styles.toggleTitle, { color: colors.text }]}>
                  Manter conversas arquivadas
                </Text>
                <Text style={[styles.toggleSubtitle, { color: colors.textSecondary }]}>
                  As conversas arquivadas continuarão arquivadas quando você receber novas mensagens.
                </Text>
              </View>
              <Switch
                value={keepChatsArchived}
                onValueChange={handleKeepChatsArchivedChange}
                trackColor={{ false: colors.border, true: colors.tint }}
                thumbColor={Platform.OS === "android" ? (keepChatsArchived ? colors.tint : "#f4f3f4") : undefined}
              />
            </View>

            <TouchableOpacity
              style={[styles.sheetCloseButton, { backgroundColor: colors.tint, marginTop: 24 }]}
              onPress={() => setPrivacyModalVisible(false)}
            >
              <Text style={styles.sheetCloseButtonText}>Salvar e Fechar</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Theme Choice Dialog Modal */}
      <Modal
        visible={themeModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setThemeModalVisible(false)}
      >
        <TouchableOpacity
          style={[styles.dialogOverlay, { backgroundColor: colors.modalOverlay }]}
          activeOpacity={1}
          onPress={() => setThemeModalVisible(false)}
        >
          <View
            style={[
              styles.themeDialog,
              {
                backgroundColor: colors.menuBackground,
                borderColor: colors.border,
              },
            ]}
          >
            <Text style={[styles.dialogTitle, { color: colors.text }]}>
              Escolher tema
            </Text>

            <TouchableOpacity
              style={styles.dialogOption}
              onPress={async () => {
                await setThemePreference("light");
                setThemeModalVisible(false);
              }}
            >
              <View style={styles.dialogOptionLabel}>
                <Sun
                  size={20}
                  color={
                    themePreference === "light"
                      ? colors.tint
                      : colors.textSecondary
                  }
                />
                <Text
                  style={[
                    styles.dialogOptionText,
                    { color: colors.text },
                    themePreference === "light" && {
                      color: colors.tint,
                      fontWeight: "600",
                    },
                  ]}
                >
                  Claro
                </Text>
              </View>
              {themePreference === "light" && (
                <Check size={18} color={colors.tint} />
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.dialogOption}
              onPress={async () => {
                await setThemePreference("dark");
                setThemeModalVisible(false);
              }}
            >
              <View style={styles.dialogOptionLabel}>
                <Moon
                  size={20}
                  color={
                    themePreference === "dark"
                      ? colors.tint
                      : colors.textSecondary
                  }
                />
                <Text
                  style={[
                    styles.dialogOptionText,
                    { color: colors.text },
                    themePreference === "dark" && {
                      color: colors.tint,
                      fontWeight: "600",
                    },
                  ]}
                >
                  Escuro
                </Text>
              </View>
              {themePreference === "dark" && (
                <Check size={18} color={colors.tint} />
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.dialogOption}
              onPress={async () => {
                await setThemePreference("system");
                setThemeModalVisible(false);
              }}
            >
              <View style={styles.dialogOptionLabel}>
                <Laptop
                  size={20}
                  color={
                    themePreference === "system"
                      ? colors.tint
                      : colors.textSecondary
                  }
                />
                <Text
                  style={[
                    styles.dialogOptionText,
                    { color: colors.text },
                    themePreference === "system" && {
                      color: colors.tint,
                      fontWeight: "600",
                    },
                  ]}
                >
                  Padrão do sistema
                </Text>
              </View>
              {themePreference === "system" && (
                <Check size={18} color={colors.tint} />
              )}
            </TouchableOpacity>

            <View
              style={[
                styles.menuDivider,
                { backgroundColor: colors.border, marginVertical: 8 },
              ]}
            />

            <TouchableOpacity
              style={styles.dialogCloseButton}
              onPress={() => setThemeModalVisible(false)}
            >
              <Text style={[styles.dialogCloseText, { color: colors.tint }]}>
                Cancelar
              </Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 56,
    paddingBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "bold",
  },
  headerRightPlaceholder: {
    width: 32,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  profileCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    marginBottom: 24,
  },
  profileCardVertical: {
    alignItems: "center",
    padding: 24,
    borderRadius: 24,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
    marginBottom: 24,
  },
  avatarButton: {
    marginBottom: 16,
  },
  largeAvatarContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
  },
  largeAvatarImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  largeAvatarText: {
    color: "#fff",
    fontSize: 32,
    fontWeight: "bold",
  },
  editBadge: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: "#FFF",
    justifyContent: "center",
    alignItems: "center",
  },
  profileInfoVertical: {
    alignItems: "center",
  },
  usernameTextVertical: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 4,
  },
  emailTextVertical: {
    fontSize: 14,
  },
  aboutTapArea: {
    marginTop: 10,
    paddingHorizontal: 16,
    maxWidth: "100%",
  },
  aboutText: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
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
  avatarContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
    position: "relative",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  avatarText: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "bold",
  },
  onlineBadge: {
    position: "absolute",
    bottom: 2,
    right: 2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "#10B981",
    borderWidth: 2,
    borderColor: "#FFF",
  },
  profileInfo: {
    flex: 1,
  },
  usernameText: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 4,
  },
  emailText: {
    fontSize: 14,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "bold",
    letterSpacing: 1,
    marginLeft: 4,
    marginBottom: 8,
  },
  settingsGroup: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 2,
    marginBottom: 24,
  },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  iconWrapper: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  rowTextContainer: {
    flex: 1,
  },
  rowTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 2,
  },
  rowSubtitle: {
    fontSize: 13,
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
    width: "85%",
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 15,
    elevation: 10,
  },
  dialogTitle: {
    fontSize: 20,
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
});
