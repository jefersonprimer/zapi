import { useState } from "react";
import {
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  View,
  ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/context/AuthContext";
import { useAppTheme } from "@/context/ThemeContext";
import { login } from "@/services/api";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";

export default function LoginScreen() {
  const router = useRouter();
  const { signIn } = useAuth();
  const { colors, isDark } = useAppTheme();
  const insets = useSafeAreaInsets();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);

  async function handleLogin() {
    if (!email.trim() || !password) {
      setError("E-mail e senha são obrigatórios.");
      Alert.alert("Erro", "E-mail e senha são obrigatórios.");
      return;
    }

    setError(null);
    setLoading(true);
    try {
      const data = await login(email.trim(), password);
      await signIn(data.token, {
        user_id: data.user_id,
        username: data.username,
        email: data.email,
        name: data.name,
        avatar_url: data.avatar_url,
      });
    } catch (err: any) {
      console.error("Login error:", err);
      const message = err.message || "Ocorreu um erro inesperado";
      setError(message);
      Alert.alert("Erro", message);
    } finally {
      setLoading(false);
    }
  }

  // Theme-based colors
  const pageBg = colors.background;
  const textColor = colors.text;
  const textSecondary = colors.textSecondary;
  const inputBg = colors.cardBackground;
  const borderDefault = colors.border;
  const borderFocused = colors.text;

  const buttonBg = colors.text;
  const buttonText = colors.background;

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: pageBg }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
    >
      {/* Header */}
      <View
        style={{
          paddingTop: insets.top > 0 ? insets.top : 12,
          paddingHorizontal: 16,
          backgroundColor: pageBg,
          flexDirection: "row",
          alignItems: "center",
          height: insets.top > 0 ? insets.top + 48 : 56,
        }}
      >
        <TouchableOpacity
          onPress={() => router.push("/select-profile")}
          style={{ padding: 8, marginLeft: 4 }}
          activeOpacity={0.7}
        >
          <MaterialCommunityIcons name="arrow-left" color={textColor} size={24} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: 10,
            paddingBottom: insets.bottom > 0 ? insets.bottom + 16 : 24,
          },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.contentWrapper}>
          <View style={styles.topSection}>
            <Text style={[styles.title, { color: textColor }]}>
              Seja bem-vindo de volta
            </Text>
            <Text style={[styles.subtitle, { color: textSecondary }]}>
              Conecte-se com seus amigos e comunidades instantaneamente.
            </Text>
          </View>

          <View style={styles.formSection}>
            {error ? (
              <View
                style={[
                  styles.errorContainer,
                  {
                    backgroundColor: isDark
                      ? "rgba(239, 68, 68, 0.1)"
                      : "#FEF2F2",
                    borderColor: isDark ? "rgba(239, 68, 68, 0.2)" : "#FEE2E2",
                  },
                ]}
              >
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            {/* E-mail Input */}
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: textSecondary }]}>
                E-MAIL
              </Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: inputBg,
                    borderColor: emailFocused ? borderFocused : borderDefault,
                    color: textColor,
                  },
                ]}
                placeholder="nome@exemplo.com"
                placeholderTextColor={isDark ? "#4B5563" : "#9CA3AF"}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                onFocus={() => setEmailFocused(true)}
                onBlur={() => setEmailFocused(false)}
              />
            </View>

            {/* Password Input */}
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: textSecondary }]}>
                SENHA
              </Text>
              <View
                style={[
                  styles.passwordContainer,
                  {
                    backgroundColor: inputBg,
                    borderColor: passwordFocused
                      ? borderFocused
                      : borderDefault,
                  },
                ]}
              >
                <TextInput
                  style={[styles.passwordInput, { color: textColor }]}
                  placeholder="••••••••"
                  placeholderTextColor={isDark ? "#4B5563" : "#9CA3AF"}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  onFocus={() => setPasswordFocused(true)}
                  onBlur={() => setPasswordFocused(false)}
                />
                <TouchableOpacity
                  style={styles.eyeButton}
                  onPress={() => setShowPassword(!showPassword)}
                  activeOpacity={0.7}
                >
                  {showPassword ? (
                    <MaterialCommunityIcons name="eye-off-outline" size={18} color={textSecondary} />
                  ) : (
                    <MaterialCommunityIcons name="eye-outline" size={18} color={textSecondary} />
                  )}
                </TouchableOpacity>
              </View>
            </View>

            {/* Login Button */}
            <TouchableOpacity
              style={[styles.button, { backgroundColor: buttonBg }]}
              onPress={handleLogin}
              disabled={loading}
              activeOpacity={0.9}
            >
              {loading ? (
                <ActivityIndicator color={buttonText} size="small" />
              ) : (
                <Text style={[styles.buttonText, { color: buttonText }]}>
                  Entrar
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Footer Section */}
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
    </KeyboardAvoidingView>
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
  contentWrapper: {
    width: "100%",
    alignItems: "stretch",
  },
  topSection: {
    alignItems: "flex-start",
    marginTop: 8,
    marginBottom: 20,
  },
  title: {
    fontSize: 26,
    fontWeight: "800",
    letterSpacing: -0.8,
    textAlign: "left",
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: "left",
    marginTop: 6,
  },
  formSection: {
    marginTop: 8,
  },
  errorContainer: {
    borderWidth: 1,
    borderRadius: 6,
    padding: 12,
    marginBottom: 20,
    alignItems: "center",
  },
  errorText: {
    color: "#EF4444",
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
  },
  passwordContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 6,
  },
  passwordInput: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
  },
  eyeButton: {
    paddingHorizontal: 16,
  },
  button: {
    borderRadius: 50,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "500",
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
  switchProfilesLink: {
    alignItems: "center",
    marginTop: 20,
    paddingVertical: 8,
  },
  switchProfilesLinkText: {
    fontSize: 14,
    fontWeight: "700",
  },
});
