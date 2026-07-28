import React, { useEffect, useRef, useState } from "react";
import {
  Modal,
  TouchableOpacity,
  View,
  Text,
  StyleSheet,
  Animated,
} from "react-native";
import { useAppTheme } from "@/context/ThemeContext";

const ACTIVE_GREEN = "#34C759";

interface MuteModalProps {
  visible: boolean;
  onClose: () => void;
  onMute: (durationHours: number | "always") => void;
}

type MuteOptionValue = number | "always";

interface RadioButtonProps {
  selected: boolean;
  isDark: boolean;
}

const RadioButton = ({ selected, isDark }: RadioButtonProps) => (
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

export default function MuteModal({
  visible,
  onClose,
  onMute,
}: MuteModalProps) {
  const { colors, isDark } = useAppTheme();
  const [selectedOption, setSelectedOption] = useState<MuteOptionValue>(8); // Default to 8 hours

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
      onClose();
      if (callback) callback();
    });
  };

  const handleConfirm = () => {
    handleClose(() => {
      onMute(selectedOption);
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

  const options: { value: MuteOptionValue; label: string }[] = [
    { value: 1, label: "1 hora" },
    { value: 8, label: "8 horas" },
    { value: 24, label: "24 horas" },
    { value: 7 * 24, label: "1 semana" },
    { value: 30 * 24, label: "1 mês" },
    { value: "always", label: "Sempre" },
  ];

  return (
    <Modal
      visible={shouldRender}
      transparent={true}
      animationType="none"
      statusBarTranslucent={true}
      onRequestClose={() => handleClose()}
    >
      <TouchableOpacity
        style={[styles.dialogOverlay, { zIndex: 1000 }]}
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
              transform: [
                { scale: dialogScale },
                { translateY: dialogTranslateY },
              ],
            },
          ]}
        >
          <Text style={[styles.dialogTitle, { color: colors.text }]}>
            Silenciar Notificações
          </Text>

          <Text
            style={[styles.dialogDescription, { color: colors.textSecondary }]}
          >
            Seus contatos não saberão que você silenciou a conversa.
          </Text>

          {options.map((opt) => (
            <TouchableOpacity
              key={opt.value.toString()}
              style={styles.dialogOption}
              onPress={() => setSelectedOption(opt.value)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.dialogOptionText,
                  { color: colors.text },
                  selectedOption === opt.value && {
                    color: colors.tint,
                    fontWeight: "600",
                  },
                ]}
              >
                {opt.label}
              </Text>
              <RadioButton
                selected={selectedOption === opt.value}
                isDark={isDark}
              />
            </TouchableOpacity>
          ))}

          <View
            style={[
              styles.menuDivider,
              { backgroundColor: colors.border, marginVertical: 8 },
            ]}
          />

          <View style={styles.footerButtons}>
            <TouchableOpacity
              onPress={() => handleClose()}
              style={styles.footerBtn}
            >
              <Text
                style={{
                  color: colors.textSecondary,
                  fontSize: 16,
                }}
              >
                Cancelar
              </Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleConfirm} style={styles.footerBtn}>
              <Text style={{ color: colors.tint, fontSize: 16 }}>OK</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </TouchableOpacity>
    </Modal>
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
    fontSize: 20,
    fontWeight: "500",
    textAlign: "center",
    marginBottom: 16,
  },
  dialogDescription: {
    fontSize: 14,
    textAlign: "center",
    marginBottom: 16,
    lineHeight: 20,
  },
  dialogOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
  dialogOptionText: {
    fontSize: 16,
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
  menuDivider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: 12,
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
