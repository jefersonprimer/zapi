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
  Clipboard,
} from "react-native";
import { useRouter } from "expo-router";
import { useAuth, getStorageItem, setStorageItem } from "@/context/AuthContext";
import { useAppTheme } from "@/context/ThemeContext";
import { useSafeAreaInsets } from "react-native-safe-area-context";
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
  MessageSquareText,
  User,
} from "lucide-react-native";
import { API_URL, uploadImage, updateProfile } from "@/services/api";
import ImagePickerModal from "@/components/ImagePickerModal";

const ABOUT_MAX_LEN = 139;

export default function SettingsScreen() {
  const router = useRouter();
  const { user, token, signOut, updateUser } = useAuth();
  const { colors, themePreference, setThemePreference, isDark } = useAppTheme();
  const insets = useSafeAreaInsets();

  // Modals visibility states
  const [langModalVisible, setLangModalVisible] = useState(false);
  const [themeModalVisible, setThemeModalVisible] = useState(false);
  const [privacyModalVisible, setPrivacyModalVisible] = useState(false);
  const [avatarModalVisible, setAvatarModalVisible] = useState(false);
  const [aboutModalVisible, setAboutModalVisible] = useState(false);
  const [aboutDraft, setAboutDraft] = useState("");
  const [nameModalVisible, setNameModalVisible] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [usernameModalVisible, setUsernameModalVisible] = useState(false);
  const [usernameDraft, setUsernameDraft] = useState("");

  const [isUpdating, setIsUpdating] = useState(false);
  const [showHeaderProfile, setShowHeaderProfile] = useState(false);

  // Privacy dummy states
  const [readReceipts, setReadReceipts] = useState(true);
  const [onlineStatus, setOnlineStatus] = useState(true);
  const [keepChatsArchived, setKeepChatsArchived] = useState(false);

  // Privacy settings states
  const [privacyMessages, setPrivacyMessages] = useState<string>("all");
  const [privacyCalls, setPrivacyCalls] = useState<string>("contacts");

  useEffect(() => {
    if (user) {
      setPrivacyMessages(user.privacy_messages || "all");
      setPrivacyCalls(user.privacy_calls || "contacts");
    }
  }, [user]);

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

  const openNameModal = () => {
    setNameDraft(user?.name || user?.username || "");
    setNameModalVisible(true);
  };

  const handleSaveName = async () => {
    if (!token) return;
    const trimmed = nameDraft.trim();
    if (trimmed.length > 100) {
      Alert.alert("Erro", "O nome pode ter no máximo 100 caracteres.");
      return;
    }
    setIsUpdating(true);
    try {
      await updateProfile(token, undefined, undefined, undefined, trimmed || null);
      await updateUser({ name: trimmed || null });
      setNameModalVisible(false);
    } catch (err: any) {
      Alert.alert("Erro", err.message || "Falha ao atualizar nome");
    } finally {
      setIsUpdating(false);
    }
  };

  const openUsernameModal = () => {
    setUsernameDraft(user?.username || "");
    setUsernameModalVisible(true);
  };

  const handleSaveUsername = async () => {
    if (!token) return;
    const trimmed = usernameDraft.trim().toLowerCase();
    
    // Client-side validations
    const len = trimmed.length;
    if (len < 3 || len > 30) {
      Alert.alert("Erro", "O username deve ter entre 3 e 30 caracteres.");
      return;
    }

    // Check characters: lowercase a-z, 0-9, _
    for (let i = 0; i < trimmed.length; i++) {
      const c = trimmed[i];
      const code = trimmed.charCodeAt(i);
      const isLetter = (code >= 97 && code <= 122); // a-z
      const isDigit = (code >= 48 && code <= 57);   // 0-9
      const isUnderscore = (c === '_');
      if (!isLetter && !isDigit && !isUnderscore) {
        Alert.alert("Erro", "O username só pode conter letras minúsculas, números e underlines (_).");
        return;
      }
    }

    const reserved = ["admin", "support", "zapi", "api", "root", "system", "security", "official"];
    if (reserved.includes(trimmed)) {
      Alert.alert("Erro", `O username '${trimmed}' é reservado.`);
      return;
    }

    setIsUpdating(true);
    try {
      await updateProfile(token, undefined, undefined, undefined, undefined, trimmed);
      await updateUser({ username: trimmed });
      setUsernameModalVisible(false);
    } catch (err: any) {
      Alert.alert("Erro", err.message || "Falha ao atualizar username");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleSavePrivacy = async () => {
    if (!token) return;
    setIsUpdating(true);
    try {
      await updateProfile(
        token,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        privacyMessages,
        privacyCalls
      );
      await updateUser({
        privacy_messages: privacyMessages,
        privacy_calls: privacyCalls,
      });
      setPrivacyModalVisible(false);
    } catch (err: any) {
      Alert.alert("Erro", err.message || "Falha ao salvar configurações de privacidade");
    } finally {
      setIsUpdating(false);
    }
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
                  <Image source={{ uri: avatarUri }} style={styles.miniAvatarImage} />
                ) : (
                  <Text style={[styles.miniAvatarText, { color: colors.textSecondary }]}>
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
              style={[styles.headerTitle, { color: colors.headerText, flex: 1 }]}
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
                <Text style={[styles.avatarText, { color: colors.textSecondary }]}>
                  {nameInitial}
                </Text>
              )}
            </View>
            <View style={[styles.editBadge, { backgroundColor: colors.tint, borderColor: colors.background }]}>
              <Camera size={12} color="#FFF" />
            </View>
          </TouchableOpacity>

          <TouchableOpacity onPress={openNameModal} activeOpacity={0.7} disabled={isUpdating}>
            <Text style={[styles.displayName, { color: colors.text }]}>
              {displayName}
            </Text>
          </TouchableOpacity>

          {!!user?.username && (
            <TouchableOpacity onPress={openUsernameModal} activeOpacity={0.7} disabled={isUpdating}>
              <Text style={[styles.usernameText, { color: colors.textSecondary }]}>
                @{user?.username}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={[styles.sectionDivider, { backgroundColor: colors.border }]} />

        {/* Informações Section (Telegram style: value-first, label-second, copy/edit on press) */}
        <View style={styles.infoSection}>
          {/* Recado Item */}
          <TouchableOpacity
            activeOpacity={0.6}
            onPress={openAboutModal}
            style={styles.infoItem}
            disabled={isUpdating}
          >
            <Text style={[styles.infoValueText, { color: colors.text }]}>
              {user?.about || "Toque para adicionar um recado"}
            </Text>
            <Text style={[styles.infoLabelText, { color: colors.textSecondary }]}>
              Recado
            </Text>
          </TouchableOpacity>

          <View style={[styles.innerDivider, { backgroundColor: colors.border }]} />

          {/* Nome Item */}
          <TouchableOpacity
            activeOpacity={0.6}
            onPress={openNameModal}
            style={styles.infoItem}
            disabled={isUpdating}
          >
            <Text style={[styles.infoValueText, { color: colors.text }]}>
              {user?.name || user?.username || "Sem nome"}
            </Text>
            <Text style={[styles.infoLabelText, { color: colors.textSecondary }]}>
              Nome
            </Text>
          </TouchableOpacity>

          <View style={[styles.innerDivider, { backgroundColor: colors.border }]} />

          {/* Username Item */}
          <TouchableOpacity
            activeOpacity={0.6}
            onPress={openUsernameModal}
            style={styles.infoItem}
            disabled={isUpdating}
          >
            <Text style={[styles.infoValueText, { color: colors.text }]}>
              @{user?.username || "Sem username"}
            </Text>
            <Text style={[styles.infoLabelText, { color: colors.textSecondary }]}>
              Nome de usuário
            </Text>
          </TouchableOpacity>

          <View style={[styles.innerDivider, { backgroundColor: colors.border }]} />

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
            <Text style={[styles.infoLabelText, { color: colors.textSecondary }]}>
              E-mail
            </Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.sectionDivider, { backgroundColor: colors.border }]} />

        {/* Options Section */}
        <View style={styles.optionsSection}>
          {/* Privacidade */}
          <TouchableOpacity
            style={styles.optionRowClickable}
            onPress={() => setPrivacyModalVisible(true)}
          >
            <View style={styles.optionLeft}>
              <Lock size={20} color={colors.textSecondary} />
              <View style={styles.optionTextContainer}>
                <Text style={[styles.optionTitle, { color: colors.text }]}>
                  Privacidade
                </Text>
                <Text style={[styles.optionSub, { color: colors.textSecondary }]}>
                  Segurança, bloqueios, confirmações
                </Text>
              </View>
            </View>
            <ChevronRight size={20} color={colors.textSecondary} />
          </TouchableOpacity>

          {/* Idioma do app */}
          <TouchableOpacity
            style={styles.optionRowClickable}
            onPress={() => setLangModalVisible(true)}
          >
            <View style={styles.optionLeft}>
              <Globe size={20} color={colors.textSecondary} />
              <View style={styles.optionTextContainer}>
                <Text style={[styles.optionTitle, { color: colors.text }]}>
                  Idioma do app
                </Text>
                <Text style={[styles.optionSub, { color: colors.textSecondary }]}>
                  Português (Brasil)
                </Text>
              </View>
            </View>
            <ChevronRight size={20} color={colors.textSecondary} />
          </TouchableOpacity>

          {/* Tema */}
          <TouchableOpacity
            style={styles.optionRowClickable}
            onPress={() => setThemeModalVisible(true)}
          >
            <View style={styles.optionLeft}>
              <Palette size={20} color={colors.textSecondary} />
              <View style={styles.optionTextContainer}>
                <Text style={[styles.optionTitle, { color: colors.text }]}>
                  Tema
                </Text>
                <Text style={[styles.optionSub, { color: colors.textSecondary }]}>
                  {getThemeLabel(themePreference)}
                </Text>
              </View>
            </View>
            <ChevronRight size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        <View style={[styles.sectionDivider, { backgroundColor: colors.border }]} />

        {/* Danger Zone Options */}
        <View style={styles.optionsSection}>
          <TouchableOpacity
            style={styles.optionRowClickable}
            onPress={handleSignOut}
          >
            <View style={styles.optionLeft}>
              <LogOut size={20} color={colors.danger} />
              <View style={styles.optionTextContainer}>
                <Text style={[styles.optionTitle, { color: colors.danger, fontWeight: "500" }]}>
                  Sair da conta
                </Text>
                <Text style={[styles.optionSub, { color: colors.textSecondary }]}>
                  Desconectar deste dispositivo
                </Text>
              </View>
            </View>
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
      <ImagePickerModal
        visible={avatarModalVisible}
        onClose={() => setAvatarModalVisible(false)}
        onImageSelected={uploadAndSaveAvatar}
        onRemoveImage={handleRemovePhoto}
        hasImage={!!user?.avatar_url}
        title="Foto do perfil"
      />

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

      {/* Name / Nome Modal */}
      <Modal
        visible={nameModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setNameModalVisible(false)}
      >
        <TouchableOpacity
          style={[styles.modalOverlay, { backgroundColor: colors.modalOverlay }]}
          activeOpacity={1}
          onPress={() => setNameModalVisible(false)}
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
              <User size={24} color={colors.tint} />
              <Text style={[styles.sheetTitle, { color: colors.text, marginLeft: 8 }]}>
                Nome
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
              value={nameDraft}
              onChangeText={setNameDraft}
              placeholder="Digite seu nome..."
              placeholderTextColor={colors.textSecondary}
              maxLength={100}
              autoFocus
            />

            <TouchableOpacity
              style={[styles.sheetCloseButton, { backgroundColor: colors.tint, marginTop: 8 }]}
              onPress={handleSaveName}
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
              onPress={() => setNameModalVisible(false)}
              disabled={isUpdating}
            >
              <Text style={[styles.sheetCloseButtonText, { color: colors.text }]}>
                Cancelar
              </Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Username Modal */}
      <Modal
        visible={usernameModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setUsernameModalVisible(false)}
      >
        <TouchableOpacity
          style={[styles.modalOverlay, { backgroundColor: colors.modalOverlay }]}
          activeOpacity={1}
          onPress={() => setUsernameModalVisible(false)}
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
              <User size={24} color={colors.tint} />
              <Text style={[styles.sheetTitle, { color: colors.text, marginLeft: 8 }]}>
                Username
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
              value={usernameDraft}
              onChangeText={setUsernameDraft}
              placeholder="Digite seu username..."
              placeholderTextColor={colors.textSecondary}
              autoCapitalize="none"
              maxLength={30}
              autoFocus
            />

            <TouchableOpacity
              style={[styles.sheetCloseButton, { backgroundColor: colors.tint, marginTop: 8 }]}
              onPress={handleSaveUsername}
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
              onPress={() => setUsernameModalVisible(false)}
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
              <Text style={[styles.sheetTitle, { color: colors.text, marginLeft: 8, marginBottom: 0 }]}>
                Privacidade
              </Text>
            </View>

            <ScrollView style={{ maxHeight: 350 }} showsVerticalScrollIndicator={false}>
              {/* Seção Mensagens */}
              <Text style={[{ color: colors.text, marginTop: 12, marginBottom: 8, fontWeight: "600", fontSize: 14 }]}>
                Quem pode me enviar mensagens?
              </Text>
              <View style={[{ backgroundColor: colors.background, borderRadius: 12, padding: 4, marginBottom: 16 }]}>
                {[
                  { value: "all", label: "Todos" },
                  { value: "contacts", label: "Somente contatos" },
                  { value: "nobody", label: "Ninguém" },
                ].map((opt) => (
                  <TouchableOpacity
                    key={opt.value}
                    style={[
                      styles.privacyOptionRow,
                      { borderBottomColor: colors.border }
                    ]}
                    onPress={() => setPrivacyMessages(opt.value)}
                  >
                    <Text style={[styles.privacyOptionText, { color: colors.text }]}>
                      {opt.label}
                    </Text>
                    {privacyMessages === opt.value && (
                      <Check size={18} color={colors.tint} />
                    )}
                  </TouchableOpacity>
                ))}
              </View>

              {/* Seção Ligações */}
              <Text style={[{ color: colors.text, marginTop: 12, marginBottom: 8, fontWeight: "600", fontSize: 14 }]}>
                Quem pode me ligar?
              </Text>
              <View style={[{ backgroundColor: colors.background, borderRadius: 12, padding: 4, marginBottom: 16 }]}>
                {[
                  { value: "all", label: "Todos" },
                  { value: "contacts", label: "Somente contatos" },
                  { value: "nobody", label: "Ninguém" },
                ].map((opt) => (
                  <TouchableOpacity
                    key={opt.value}
                    style={[
                      styles.privacyOptionRow,
                      { borderBottomColor: colors.border }
                    ]}
                    onPress={() => setPrivacyCalls(opt.value)}
                  >
                    <Text style={[styles.privacyOptionText, { color: colors.text }]}>
                      {opt.label}
                    </Text>
                    {privacyCalls === opt.value && (
                      <Check size={18} color={colors.tint} />
                    )}
                  </TouchableOpacity>
                ))}
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
                  trackColor={{
                    false: isDark ? "#2C2C2E" : "#E5E5EA",
                    true: isDark ? "#48484A" : "#C7C7CC",
                  }}
                  thumbColor={
                    Platform.OS === "android"
                      ? (readReceipts ? (isDark ? "#D1D1D6" : "#FFFFFF") : "#F4F3F4")
                      : undefined
                  }
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
                  trackColor={{
                    false: isDark ? "#2C2C2E" : "#E5E5EA",
                    true: isDark ? "#48484A" : "#C7C7CC",
                  }}
                  thumbColor={
                    Platform.OS === "android"
                      ? (onlineStatus ? (isDark ? "#D1D1D6" : "#FFFFFF") : "#F4F3F4")
                      : undefined
                  }
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
                  trackColor={{
                    false: isDark ? "#2C2C2E" : "#E5E5EA",
                    true: isDark ? "#48484A" : "#C7C7CC",
                  }}
                  thumbColor={
                    Platform.OS === "android"
                      ? (keepChatsArchived ? (isDark ? "#D1D1D6" : "#FFFFFF") : "#F4F3F4")
                      : undefined
                  }
                />
              </View>
            </ScrollView>

            <TouchableOpacity
              style={[styles.sheetCloseButton, { backgroundColor: colors.tint, marginTop: 24 }]}
              onPress={handleSavePrivacy}
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
    borderWidth: 1,
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
});
