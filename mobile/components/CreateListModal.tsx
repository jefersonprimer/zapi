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
import { Smile, Keyboard as KeyboardIcon, X } from "lucide-react-native";
import { useAppTheme } from "@/context/ThemeContext";

const SCREEN = Dimensions.get("screen");
const SCREEN_HEIGHT = SCREEN.height;
const SCREEN_WIDTH = SCREEN.width;
const SHEET_HEIGHT = SCREEN_HEIGHT * 0.9;
const SHEET_TOP = SCREEN_HEIGHT * 0.1;
const EMOJI_SHEET_HEIGHT = 400;

const COLOR_OPTIONS = [
  { emoji: "🔴", hex: "#ef4444" },
  { emoji: "🟠", hex: "#f97316" },
  { emoji: "🟡", hex: "#eab308" },
  { emoji: "🟢", hex: "#22c55e" },
  { emoji: "🔵", hex: "#3b82f6" },
  { emoji: "🟣", hex: "#a855f7" },
];

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
  initialColor = COLOR_OPTIONS[0].emoji,
  initialIcon = "",
}: CreateListModalProps) {
  const { colors, isDark } = useAppTheme();
  const inputRef = useRef<TextInput>(null);
  const [name, setName] = useState("");
  const [color, setColor] = useState(COLOR_OPTIONS[0].emoji);
  const [icon, setIcon] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const overlayAnim = useRef(new Animated.Value(0)).current;
  const sheetAnim = useRef(new Animated.Value(0)).current;
  const emojiSheetAnim = useRef(new Animated.Value(0)).current;

  const isEditMode = mode === "edit";

  const resetForm = useCallback(() => {
    if (isEditMode) {
      setName(initialName);
      setColor(initialColor || COLOR_OPTIONS[0].emoji);
      setIcon(initialIcon);
    } else {
      setName("");
      setColor(COLOR_OPTIONS[0].emoji);
      setIcon("");
    }
    setShowEmojiPicker(false);
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
                ? "rgba(30, 30, 30, 0.95)"
                : "rgba(255, 255, 255, 0.95)",
              transform: [{ translateY: sheetAnim }],
            },
          ]}
        >
          <View style={styles.handle} />
          <Text style={[styles.title, { color: colors.text }]}>
            {isEditMode ? "Editar Tag" : "Nova Tag"}
          </Text>

          <View style={styles.inputRow}>
            <View
              style={[styles.inputWithIcon, { borderBottomColor: colors.tint }]}
            >
              {icon ? <Text style={styles.selectedIcon}>{icon}</Text> : null}
              <TextInput
                ref={inputRef}
                placeholder="Nome da tag"
                placeholderTextColor={colors.textSecondary}
                style={[styles.nameInput, { color: colors.text }]}
                value={name}
                onChangeText={setName}
                autoFocus
                onFocus={() => {
                  if (showEmojiPicker) {
                    emojiSheetAnim.setValue(SCREEN_HEIGHT);
                    setShowEmojiPicker(false);
                  }
                }}
              />
            </View>
            <TouchableOpacity
              style={[styles.emojiButton, { backgroundColor: colors.border }]}
              onPress={
                showEmojiPicker ? () => closeEmojiPicker() : openEmojiPicker
              }
            >
              {showEmojiPicker ? (
                <KeyboardIcon size={22} color={colors.text} />
              ) : icon ? (
                <Text style={styles.emojiButtonIcon}>{icon}</Text>
              ) : (
                <Smile size={22} color={colors.textSecondary} />
              )}
            </TouchableOpacity>
          </View>

          <Text
            style={{
              color: colors.textSecondary,
              marginBottom: 8,
              fontSize: 14,
            }}
          >
            Cor
          </Text>
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              marginBottom: 20,
            }}
          >
            {COLOR_OPTIONS.map((c) => (
              <TouchableOpacity
                key={c.hex}
                style={[
                  { padding: 8, borderRadius: 20 },
                  color === c.emoji && { backgroundColor: colors.border },
                ]}
                onPress={() => setColor(c.emoji)}
              >
                <View
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: 12,
                    backgroundColor: c.hex,
                  }}
                />
              </TouchableOpacity>
            ))}
          </View>

          <View
            style={{
              flexDirection: "row",
              justifyContent: "flex-end",
              gap: 12,
            }}
          >
            <TouchableOpacity onPress={() => closeSheet()}>
              <Text
                style={{
                  color: colors.textSecondary,
                  fontSize: 16,
                  padding: 8,
                }}
              >
                Cancelar
              </Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleSubmit}>
              <Text style={{ color: colors.tint, fontSize: 16, padding: 8 }}>
                {isEditMode ? "Salvar" : "Criar"}
              </Text>
            </TouchableOpacity>
          </View>
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
                transform: [{ translateY: emojiSheetAnim }],
              },
            ]}
          >
            <View style={styles.handle} />
            <View style={styles.emojiHeader}>
              <TouchableOpacity onPress={() => closeEmojiPicker()}>
                <X size={22} color={colors.text} />
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
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    top: SHEET_TOP,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 40,
    height: SHEET_HEIGHT,
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
  title: {
    fontSize: 20,
    fontWeight: "500",
    textAlign: "center",
    marginBottom: 16,
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
    borderBottomWidth: 1,
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
