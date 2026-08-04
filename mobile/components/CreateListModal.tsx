import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  TouchableOpacity,
  View,
  Text,
  TextInput,
  StyleSheet,
  Alert,
  Modal,
  Animated,
  Dimensions,
  Keyboard,
  TouchableWithoutFeedback,
} from "react-native";
import { EmojiKeyboard } from "rn-emoji-keyboard";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppTheme } from "@/context/ThemeContext";
import ColorModal, { DRAWING_COLORS } from "./ColorModal";

const SCREEN = Dimensions.get("screen");
const SCREEN_HEIGHT = SCREEN.height;
const SCREEN_WIDTH = SCREEN.width;
const EMOJI_SHEET_HEIGHT = 400;

const DEFAULT_COLOR = DRAWING_COLORS[6]; // #E11D48

interface CreateListModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (name: string, color: string, icon: string) => void;
  mode?: "create" | "edit";
  initialName?: string;
  initialColor?: string;
  initialIcon?: string;
}

export default function CreateListModal({
  visible,
  onClose,
  onSubmit,
  mode = "create",
  initialName = "",
  initialColor = DEFAULT_COLOR,
  initialIcon = "",
}: CreateListModalProps) {
  const { colors, isDark } = useAppTheme();
  const insets = useSafeAreaInsets();
  const inputRef = useRef<TextInput>(null);
  const [name, setName] = useState("");
  const [color, setColor] = useState(DEFAULT_COLOR);
  const [icon, setIcon] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showColorModal, setShowColorModal] = useState(false);

  const overlayAnim = useRef(new Animated.Value(0)).current;
  const sheetAnim = useRef(new Animated.Value(0)).current;
  const emojiSheetAnim = useRef(new Animated.Value(0)).current;

  const [isFocused, setIsFocused] = useState(false);

  const isEditMode = mode === "edit";
  const sheetTopInset = Math.max(insets.top, 12);
  const sheetBottomInset = Math.max(insets.bottom, 24);
  const sheetHeight = SCREEN_HEIGHT - sheetTopInset;

  const resetForm = useCallback(() => {
    if (isEditMode) {
      setName(initialName);
      setColor(initialColor || DEFAULT_COLOR);
      setIcon(initialIcon);
    } else {
      setName("");
      setColor(DEFAULT_COLOR);
      setIcon("");
    }
    setShowEmojiPicker(false);
    setShowColorModal(false);
  }, [isEditMode, initialName, initialColor, initialIcon]);

  const openSheet = useCallback(() => {
    overlayAnim.setValue(0);
    sheetAnim.setValue(SCREEN_HEIGHT);
    Animated.parallel([
      Animated.timing(overlayAnim, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.spring(sheetAnim, {
        toValue: 0,
        tension: 80,
        friction: 12,
        useNativeDriver: true,
      }),
    ]).start();
  }, [overlayAnim, sheetAnim]);

  const closeSheet = (callback?: () => void) => {
    Animated.parallel([
      Animated.timing(overlayAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(sheetAnim, {
        toValue: SCREEN_HEIGHT,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      resetForm();
      onClose();
      callback?.();
    });
  };

  const openEmojiPicker = () => {
    inputRef.current?.blur();
    Keyboard.dismiss();
    setShowEmojiPicker(true);
    emojiSheetAnim.setValue(SCREEN_HEIGHT);
    Animated.spring(emojiSheetAnim, {
      toValue: 0,
      tension: 80,
      friction: 12,
      useNativeDriver: true,
    }).start();
  };

  const closeEmojiPicker = (callback?: () => void, showKeyboard = true) => {
    Animated.timing(emojiSheetAnim, {
      toValue: SCREEN_HEIGHT,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      setShowEmojiPicker(false);
      callback?.();
      if (showKeyboard) {
        setTimeout(() => inputRef.current?.focus(), 100);
      }
    });
  };

  useEffect(() => {
    if (visible) {
      resetForm();
      openSheet();
    }
  }, [
    visible,
    mode,
    initialName,
    initialColor,
    initialIcon,
    openSheet,
    resetForm,
  ]);

  const handleEmojiSelected = (emojiObject: { emoji: string }) => {
    setIcon(emojiObject.emoji);
    closeEmojiPicker(undefined, false);
  };

  const handleSubmit = () => {
    if (!name.trim()) {
      Alert.alert("Erro", "Por favor, digite o nome da lista.");
      return;
    }
    const submittedName = name;
    const submittedColor = color;
    const submittedIcon = icon;
    closeSheet(() => {
      onSubmit(submittedName, submittedColor, submittedIcon);
    });
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={() => closeSheet()}
    >
      <View style={styles.overlay}>
        <TouchableWithoutFeedback onPress={() => Keyboard.dismiss()}>
          <Animated.View
            style={[
              styles.overlayBg,
              {
                opacity: overlayAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, 1],
                }),
              },
            ]}
          />
        </TouchableWithoutFeedback>

        {/* Main form sheet — anchored by top so Android keyboard resize doesn't push it */}
        <Animated.View
          style={[
            styles.sheet,
            {
              backgroundColor: isDark
                ? "rgba(30, 30, 30, 0.98)"
                : "rgba(255, 255, 255, 0.98)",
              top: sheetTopInset,
              height: sheetHeight,
              paddingBottom: sheetBottomInset,
              transform: [{ translateY: sheetAnim }],
            },
          ]}
        >
          <View style={styles.handle} />
          <View style={styles.headerRow}>
            <TouchableOpacity
              onPress={() => closeSheet()}
              style={[styles.headerButton, { borderColor: colors.border }]}
            >
              <Ionicons name="close" size={24} color={colors.textSecondary} />
            </TouchableOpacity>
            <Text style={[styles.title, { color: colors.text }]}>
              {isEditMode ? "Editar Tag" : "Nova Tag"}
            </Text>
            <TouchableOpacity
              onPress={handleSubmit}
              style={[
                styles.headerButton,
                { backgroundColor: "#34C759", borderColor: "#34C759" },
              ]}
            >
              <Ionicons name="checkmark" size={24} color="#ffffff" />
            </TouchableOpacity>
          </View>

          <Text
            style={{
              color: colors.textSecondary,
              marginBottom: 8,
              fontSize: 14,
              fontWeight: "400",
            }}
          >
            Nome da Tag
          </Text>

          <View style={styles.inputRow}>
            <View
              style={[
                styles.inputWithIcon,
                {
                  borderColor: isFocused ? colors.brandGreen : colors.border,
                  borderWidth: isFocused ? 2 : 1.5,
                },
              ]}
            >
              {icon ? <Text style={styles.selectedIcon}>{icon}</Text> : null}
              <TextInput
                ref={inputRef}
                placeholder="Trabalho, Faculdade"
                placeholderTextColor={colors.textSecondary}
                style={[styles.nameInput, { color: colors.text }]}
                value={name}
                onChangeText={setName}
                autoFocus
                onFocus={() => {
                  setIsFocused(true);
                  if (showEmojiPicker) {
                    emojiSheetAnim.setValue(SCREEN_HEIGHT);
                    setShowEmojiPicker(false);
                  }
                }}
                onBlur={() => setIsFocused(false)}
              />
            </View>
            <TouchableOpacity
              style={[styles.emojiButton, { backgroundColor: colors.border }]}
              onPress={
                showEmojiPicker ? () => closeEmojiPicker() : openEmojiPicker
              }
            >
              {showEmojiPicker ? (
                <Ionicons name="keyboard-outline" size={24} color={colors.text} />
              ) : icon ? (
                <Text style={styles.emojiButtonIcon}>{icon}</Text>
              ) : (
                <Ionicons name="happy-outline" size={22} color={colors.textSecondary} />
              )}
            </TouchableOpacity>
          </View>

          <Text
            style={{
              color: colors.textSecondary,
              fontSize: 12,
              marginTop: -12,
              marginBottom: 20,
              lineHeight: 16,
            }}
          >
            As tags que você cria ficarão na parte de cima da aba de contatos na
            tela inicial.
          </Text>

          <Text
            style={{
              color: colors.textSecondary,
              marginBottom: 8,
              fontSize: 14,
            }}
          >
            Cor
          </Text>
          <TouchableOpacity
            activeOpacity={0.8}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
              padding: 12,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.surface,
              marginBottom: 20,
            }}
            onPress={() => setShowColorModal(true)}
          >
            <View
              style={{
                width: 28,
                height: 28,
                borderRadius: 14,
                backgroundColor: color,
                borderWidth: color.toUpperCase() === "#FFFFFF" ? 1 : 0,
                borderColor: colors.border,
                justifyContent: "center",
                alignItems: "center",
              }}
            />
            <Text style={{ flex: 1, fontSize: 15, color: colors.text }}>
              {color}
            </Text>
            <Ionicons
              name="color-palette-outline"
              size={22}
              color={colors.textSecondary}
            />
          </TouchableOpacity>

          <ColorModal
            visible={showColorModal}
            selectedColor={color}
            onSelectColor={(selectedHex) => setColor(selectedHex)}
            onClose={() => setShowColorModal(false)}
          />
        </Animated.View>

        {/* Emoji picker overlay — replaces keyboard without resizing the sheet */}
        {showEmojiPicker && (
          <Animated.View
            style={[
              styles.emojiSheet,
              {
                backgroundColor: isDark
                  ? "rgba(30, 30, 30, 0.95)"
                  : "rgba(255, 255, 255, 0.95)",
                paddingBottom: sheetBottomInset,
                transform: [{ translateY: emojiSheetAnim }],
              },
            ]}
          >
            <View style={styles.handle} />
            <View style={styles.emojiHeader}>
              <TouchableOpacity onPress={() => closeEmojiPicker()}>
                <Ionicons name="close-outline" size={22} color={colors.text} />
              </TouchableOpacity>
              <Text
                style={[styles.title, { color: colors.text, marginBottom: 0 }]}
              >
                Escolher ícone
              </Text>
              <View style={{ width: 22 }} />
            </View>
            <EmojiKeyboard
              onEmojiSelected={handleEmojiSelected}
              defaultHeight={EMOJI_SHEET_HEIGHT - 80}
              expandable={false}
              hideHeader={true}
              enableRecentlyUsed={true}
              categoryOrder={[
                "recently_used",
                "smileys_emotion",
                "people_body",
                "animals_nature",
                "food_drink",
                "travel_places",
                "activities",
                "objects",
                "symbols",
                "flags",
              ]}
              theme={{
                backdrop: "transparent",
                knob: colors.brandGreen,
                container: isDark
                  ? "rgba(30, 30, 30, 0.95)"
                  : "rgba(255, 255, 255, 0.95)",
                header: colors.text,
                skinTonesContainer: isDark
                  ? "rgba(30, 30, 30, 0.95)"
                  : "rgba(255, 255, 255, 0.95)",
                category: {
                  icon: colors.icon,
                  iconActive: colors.brandGreen,
                  container: isDark
                    ? "rgba(30, 30, 30, 0.95)"
                    : "rgba(255, 255, 255, 0.95)",
                  containerActive: isDark
                    ? "rgba(30, 30, 30, 0.95)"
                    : "rgba(255, 255, 255, 0.95)",
                },
                search: {
                  text: colors.text,
                  placeholder: colors.textSecondary,
                  icon: colors.icon,
                  background: colors.background,
                },
                emoji: {
                  selected: isDark
                    ? "rgba(30, 30, 30, 0.95)"
                    : "rgba(255, 255, 255, 0.95)",
                },
              }}
            />
          </Animated.View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  overlayBg: {
    position: "absolute",
    top: 0,
    left: 0,
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    backgroundColor: "rgba(0,0,0,0.7)",
  },
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
  },
  emojiSheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 10,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 40,
    height: EMOJI_SHEET_HEIGHT,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(128,128,128,0.4)",
    alignSelf: "center",
    marginBottom: 16,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  title: {
    fontSize: 20,
    fontWeight: "500",
    textAlign: "center",
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
    gap: 10,
  },
  inputWithIcon: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderRadius: 8,
    paddingHorizontal: 12,
    gap: 8,
  },
  selectedIcon: {
    fontSize: 20,
  },
  nameInput: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 8,
  },
  emojiButtonIcon: {
    fontSize: 22,
  },
  emojiButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
  },
  emojiHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 20,
    paddingBottom: 10,
  },
});
