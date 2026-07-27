import React, { useEffect, useRef, useState } from "react";
import {
  TouchableOpacity,
  View,
  Text,
  TextInput,
  StyleSheet,
  Alert,
  Animated,
} from "react-native";
import { useAppTheme } from "@/context/ThemeContext";

interface CreateListModalProps {
  visible: boolean;
  onClose: () => void;
  onCreate: (name: string, color: string, icon: string) => void;
}

export default function CreateListModal({
  visible,
  onClose,
  onCreate,
}: CreateListModalProps) {
  const { colors, isDark } = useAppTheme();
  const [name, setName] = useState("");
  const [color, setColor] = useState("🔴");
  const [icon, setIcon] = useState("❤️");

  const dialogAnimation = useRef(new Animated.Value(0)).current;
  const [shouldRender, setShouldRender] = useState(visible);

  useEffect(() => {
    if (visible) {
      setShouldRender(true);
      dialogAnimation.setValue(0);
      Animated.spring(dialogAnimation, {
        toValue: 1,
        tension: 90,
        friction: 9,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(dialogAnimation, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }).start(() => {
        setShouldRender(false);
      });
    }
  }, [visible, dialogAnimation]);

  const handleClose = (callback?: () => void) => {
    Animated.timing(dialogAnimation, {
      toValue: 0,
      duration: 150,
      useNativeDriver: true,
    }).start(() => {
      setName("");
      setColor("🔴");
      setIcon("❤️");
      onClose();
      if (callback) callback();
    });
  };

  const handleCreate = () => {
    if (!name.trim()) {
      Alert.alert("Erro", "Por favor, digite o nome da lista.");
      return;
    }
    handleClose(() => {
      onCreate(name, color, icon);
    });
  };

  if (!shouldRender) return null;

  const dialogScale = dialogAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [0.93, 1],
  });

  const dialogTranslateY = dialogAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [20, 0],
  });

  const dialogOpacity = dialogAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  return (
    <TouchableOpacity
      style={[
        StyleSheet.absoluteFillObject,
        styles.dialogOverlay,
        { zIndex: 1000 },
      ]}
      activeOpacity={1}
      onPress={() => handleClose()}
    >
      <Animated.View
        style={[
          StyleSheet.absoluteFillObject,
          {
            backgroundColor: colors.modalOverlay,
            opacity: dialogOpacity,
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
            opacity: dialogOpacity,
            transform: [{ scale: dialogScale }, { translateY: dialogTranslateY }],
          },
        ]}
      >
        <Text style={[styles.dialogTitle, { color: colors.text }]}>
          Nova Tag
        </Text>

        <TextInput
          placeholder="Nome da lista"
          placeholderTextColor={colors.textSecondary}
          style={{
            borderBottomWidth: 1,
            borderBottomColor: colors.tint,
            color: colors.text,
            fontSize: 16,
            paddingVertical: 8,
            marginBottom: 20,
          }}
          value={name}
          onChangeText={setName}
          autoFocus
        />

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
          {["🔴", "🟠", "🟡", "🟢", "🔵", "🟣"].map((c) => (
            <TouchableOpacity
              key={c}
              style={[
                { padding: 8, borderRadius: 20 },
                color === c && {
                  backgroundColor: colors.border,
                },
              ]}
              onPress={() => setColor(c)}
            >
              <Text style={{ fontSize: 20 }}>{c}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text
          style={{
            color: colors.textSecondary,
            marginBottom: 8,
            fontSize: 14,
          }}
        >
          Ícone
        </Text>
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            marginBottom: 20,
          }}
        >
          {["❤️", "⭐", "💼", "🏠", "🎮", "📚"].map((i) => (
            <TouchableOpacity
              key={i}
              style={[
                { padding: 8, borderRadius: 20 },
                icon === i && { backgroundColor: colors.border },
              ]}
              onPress={() => setIcon(i)}
            >
              <Text style={{ fontSize: 20 }}>{i}</Text>
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
          <TouchableOpacity onPress={() => handleClose()}>
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
          <TouchableOpacity onPress={handleCreate}>
            <Text
              style={{
                color: colors.tint,
                fontSize: 16,
                fontWeight: "bold",
                padding: 8,
              }}
            >
              Criar
            </Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
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
});
