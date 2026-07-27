import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
  ScrollView,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useAuth } from "@/context/AuthContext";
import { useAppTheme } from "@/context/ThemeContext";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowLeft } from "lucide-react-native";
import { updateProfile } from "@/services/api";

const ABOUT_MAX_LEN = 139;

export default function EditProfileScreen() {
  const router = useRouter();
  const { field } = useLocalSearchParams<{ field: "name" | "about" | "username" }>();
  const { user, token, updateUser } = useAuth();
  const { colors, isDark } = useAppTheme();
  const insets = useSafeAreaInsets();

  const [value, setValue] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);

  // Initialize value based on the field being edited
  useEffect(() => {
    if (user) {
      if (field === "name") {
        setValue(user.name || user.username || "");
      } else if (field === "about") {
        setValue(user.about || "");
      } else if (field === "username") {
        setValue(user.username || "");
      }
    }
  }, [user, field]);

  const handleSave = async () => {
    if (!token) return;
    const trimmed = value.trim();

    if (field === "name") {
      if (trimmed.length > 100) {
        Alert.alert("Erro", "O nome pode ter no máximo 100 caracteres.");
        return;
      }
      setIsUpdating(true);
      try {
        await updateProfile(token, undefined, undefined, undefined, trimmed || null);
        await updateUser({ name: trimmed || null });
        router.back();
      } catch (err: any) {
        Alert.alert("Erro", err.message || "Falha ao atualizar nome");
      } finally {
        setIsUpdating(false);
      }
    } else if (field === "about") {
      if (trimmed.length > ABOUT_MAX_LEN) {
        Alert.alert("Erro", `O recado pode ter no máximo ${ABOUT_MAX_LEN} caracteres.`);
        return;
      }
      setIsUpdating(true);
      try {
        await updateProfile(token, undefined, undefined, trimmed);
        await updateUser({ about: trimmed || null });
        router.back();
      } catch (err: any) {
        Alert.alert("Erro", err.message || "Falha ao atualizar recado");
      } finally {
        setIsUpdating(false);
      }
    } else if (field === "username") {
      const lower = trimmed.toLowerCase();
      const len = lower.length;
      if (len < 3 || len > 30) {
        Alert.alert("Erro", "O nome de usuário deve ter entre 3 e 30 caracteres.");
        return;
      }

      // Check characters: lowercase a-z, 0-9, _
      for (let i = 0; i < lower.length; i++) {
        const c = lower[i];
        const code = lower.charCodeAt(i);
        const isLetter = (code >= 97 && code <= 122); // a-z
        const isDigit = (code >= 48 && code <= 57);   // 0-9
        const isUnderscore = (c === '_');
        if (!isLetter && !isDigit && !isUnderscore) {
          Alert.alert("Erro", "O nome de usuário só pode conter letras minúsculas, números e underlines (_).");
          return;
        }
      }

      const reserved = ["admin", "support", "zapi", "api", "root", "system", "security", "official"];
      if (reserved.includes(lower)) {
        Alert.alert("Erro", `O nome de usuário '${lower}' é reservado.`);
        return;
      }

      setIsUpdating(true);
      try {
        await updateProfile(token, undefined, undefined, undefined, undefined, lower);
        await updateUser({ username: lower });
        router.back();
      } catch (err: any) {
        Alert.alert("Erro", err.message || "Falha ao atualizar nome de usuário");
      } finally {
        setIsUpdating(false);
      }
    }
  };

  // Get dynamic strings based on editing field
  const getFieldInfo = () => {
    switch (field) {
      case "name":
        return {
          title: "Editar Nome",
          label: "Nome",
          placeholder: "Digite seu nome...",
          helper: "Este nome será exibido para seus contatos e nas suas conversas do Zapi.",
          multiline: false,
          maxLength: 100,
        };
      case "about":
        return {
          title: "Editar Recado",
          label: "Recado",
          placeholder: "Escreva um recado...",
          helper: "Este recado será exibido no seu perfil para outros usuários do aplicativo.",
          multiline: true,
          maxLength: ABOUT_MAX_LEN,
        };
      case "username":
        return {
          title: "Editar Nome de Usuário",
          label: "Nome de usuário",
          placeholder: "Escolha um nome de usuário...",
          helper: "Seu nome de usuário é exclusivo e permite que outras pessoas te encontrem sem precisar do seu e-mail ou número de telefone.",
          multiline: false,
          maxLength: 30,
        };
      default:
        return {
          title: "Editar Perfil",
          label: "Valor",
          placeholder: "Digite algo...",
          helper: "",
          multiline: false,
          maxLength: 100,
        };
    }
  };

  const info = getFieldInfo();

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      {/* Header */}
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
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
            <ArrowLeft size={24} color={colors.headerText} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.headerText, flex: 1 }]}>
            {info.title}
          </Text>
          <TouchableOpacity 
            onPress={handleSave} 
            disabled={isUpdating}
            activeOpacity={0.7}
          >
            {isUpdating ? (
              <ActivityIndicator size="small" color={colors.tint} />
            ) : (
              <Text style={[styles.saveText, { color: colors.tint }]}>Salvar</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.inputContainer}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>
            {info.label.toUpperCase()}
          </Text>

          <TextInput
            style={[
              styles.input,
              {
                color: colors.text,
                backgroundColor: colors.menuBackground,
                borderColor: colors.border,
              },
              info.multiline && styles.multilineInput,
            ]}
            value={value}
            onChangeText={setValue}
            placeholder={info.placeholder}
            placeholderTextColor={colors.textSecondary}
            multiline={info.multiline}
            maxLength={info.maxLength}
            autoFocus
            autoCapitalize={field === "username" ? "none" : "sentences"}
            textAlignVertical={info.multiline ? "top" : "center"}
          />

          {field === "about" && (
            <Text style={[styles.counter, { color: colors.textSecondary }]}>
              {value.length}/{ABOUT_MAX_LEN}
            </Text>
          )}

          <Text style={[styles.helperText, { color: colors.textSecondary }]}>
            {info.helper}
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
  },
  saveText: {
    fontSize: 16,
    fontWeight: "600",
    paddingHorizontal: 8,
  },
  scrollContent: {
    padding: 20,
  },
  inputContainer: {
    marginTop: 10,
  },
  label: {
    fontSize: 11,
    fontWeight: "600",
    marginBottom: 8,
    letterSpacing: 0.8,
    paddingHorizontal: 4,
  },
  input: {
    height: 48,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 16,
  },
  multilineInput: {
    height: 100,
    paddingVertical: 12,
  },
  counter: {
    alignSelf: "flex-end",
    fontSize: 12,
    marginTop: 6,
    marginRight: 4,
  },
  helperText: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 12,
    paddingHorizontal: 4,
  },
});
