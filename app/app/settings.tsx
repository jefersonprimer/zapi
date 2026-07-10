import React, { useState } from "react";
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
} from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "@/context/AuthContext";
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
} from "lucide-react-native";

export default function SettingsScreen() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const { colors, themePreference, setThemePreference } = useAppTheme();

  // Modals visibility states
  const [langModalVisible, setLangModalVisible] = useState(false);
  const [themeModalVisible, setThemeModalVisible] = useState(false);
  const [privacyModalVisible, setPrivacyModalVisible] = useState(false);

  // Privacy dummy states
  const [readReceipts, setReadReceipts] = useState(true);
  const [onlineStatus, setOnlineStatus] = useState(true);

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
        {/* Profile Card */}
        <View
          style={[
            styles.profileCard,
            {
              backgroundColor: colors.menuBackground,
              borderColor: colors.border,
            },
          ]}
        >
          <View style={[styles.avatarContainer, { backgroundColor: colors.tint }]}>
            <Text style={styles.avatarText}>{initials}</Text>
            <View style={styles.onlineBadge} />
          </View>
          <View style={styles.profileInfo}>
            <Text style={[styles.usernameText, { color: colors.text }]}>
              {user?.username || "Usuário"}
            </Text>
            <Text style={[styles.emailText, { color: colors.textSecondary }]}>
              {user?.email || "usuario@exemplo.com"}
            </Text>
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
            <View style={styles.toggleRow}>
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
