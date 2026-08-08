import React, { useState, useEffect, useRef } from "react";
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
} from "react-native";
import { useAppTheme } from "@/context/ThemeContext";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface RenameContactModalProps {
  visible: boolean;
  initialName: string;
  onClose: () => void;
  onSubmit: (newName: string | null) => void;
}

export default function RenameContactModal({
  visible,
  initialName,
  onClose,
  onSubmit,
}: RenameContactModalProps) {
  const { colors, isDark } = useAppTheme();
  const insets = useSafeAreaInsets();
  const [name, setName] = useState(initialName);
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (visible) {
      setName(initialName);
      // Small timeout to ensure modal is loaded before focusing
      setTimeout(() => {
        inputRef.current?.focus();
      }, 300);
    }
  }, [visible, initialName]);

  const handleSave = () => {
    onSubmit(name.trim() === "" ? null : name.trim());
  };

  const handleClear = () => {
    setName("");
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View
          style={[styles.overlay, { backgroundColor: "rgba(0, 0, 0, 0.4)" }]}
        >
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <KeyboardAvoidingView
              behavior={Platform.OS === "ios" ? "padding" : "height"}
              style={styles.keyboardView}
            >
              <View
                style={[
                  styles.container,
                  {
                    backgroundColor: isDark ? "#1C1C1E" : "#FFFFFF",
                    paddingTop: 12,
                    paddingBottom: Math.max(insets.bottom, 20),
                  },
                ]}
              >
                {/* Drag Handle Indicator */}
                <View
                  style={[
                    styles.dragHandle,
                    { backgroundColor: isDark ? "#3A3A3C" : "#E5E5EA" },
                  ]}
                />

                <View style={styles.header}>
                  <TouchableOpacity
                    onPress={onClose}
                    style={[
                      styles.headerBtn,
                      {
                        borderColor: colors.border,
                      },
                    ]}
                  >
                    <Ionicons
                      name="close"
                      size={24}
                      color={colors.textSecondary}
                    />
                  </TouchableOpacity>

                  <Text style={[styles.title, { color: colors.text }]}>
                    Editar Contato
                  </Text>

                  <TouchableOpacity
                    onPress={handleSave}
                    style={[
                      styles.headerBtn,
                      {
                        borderColor: "#34C759",
                        backgroundColor: "#34C759",
                      },
                    ]}
                  >
                    <Ionicons name="checkmark" size={24} color="#ffffff" />
                  </TouchableOpacity>
                </View>

                <View
                  style={[
                    styles.inputContainer,
                    {
                      borderColor: isFocused ? "#10b981" : colors.border,
                      backgroundColor: isDark ? "#2C2C2E" : "#F2F2F7",
                    },
                  ]}
                >
                  <TextInput
                    ref={inputRef}
                    value={name}
                    onChangeText={setName}
                    onFocus={() => setIsFocused(true)}
                    onBlur={() => setIsFocused(false)}
                    placeholder="Apelido do contato"
                    placeholderTextColor={colors.textSecondary}
                    style={[styles.input, { color: colors.text }]}
                    maxLength={50}
                    returnKeyType="done"
                    onSubmitEditing={handleSave}
                  />
                  {name.length > 0 && (
                    <TouchableOpacity
                      onPress={handleClear}
                      style={styles.clearBtn}
                    >
                      <Ionicons
                        name="close-outline"
                        size={24}
                        color={colors.textSecondary}
                      />
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            </KeyboardAvoidingView>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  keyboardView: {
    width: "100%",
    height: "100%",
  },
  container: {
    width: "100%",
    height: "100%",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 24,
  },
  dragHandle: {
    width: 36,
    height: 5,
    borderRadius: 2.5,
    alignSelf: "center",
    marginTop: 8,
    marginBottom: 20,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
  },
  title: {
    fontSize: 20,
    fontWeight: "600",
  },
  headerBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 24,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 54,
    marginBottom: 24,
  },
  input: {
    flex: 1,
    fontSize: 16,
    height: "100%",
    padding: 0,
  },
  clearBtn: {
    padding: 4,
  },
});
