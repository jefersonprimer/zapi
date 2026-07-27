import React, { useState } from "react";
import { Modal, TouchableOpacity, View, Text, StyleSheet } from "react-native";
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
  <View style={[styles.radioOuter, { borderColor: selected ? ACTIVE_GREEN : (isDark ? "#48484A" : "#C7C7CC") }]}>
    {selected && <View style={[styles.radioInner, { backgroundColor: ACTIVE_GREEN }]} />}
  </View>
);

export default function MuteModal({
  visible,
  onClose,
  onMute,
}: MuteModalProps) {
  const { colors, isDark } = useAppTheme();
  const [selectedOption, setSelectedOption] = useState<MuteOptionValue>(8); // Default to 8 hours

  const handleConfirm = () => {
    onMute(selectedOption);
  };

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
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={[styles.dialogOverlay, { backgroundColor: colors.modalOverlay }]}
        activeOpacity={1}
        onPress={onClose}
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
            Silenciar Notificações
          </Text>

          <Text style={[styles.dialogDescription, { color: colors.textSecondary }]}>
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
              <RadioButton selected={selectedOption === opt.value} isDark={isDark} />
            </TouchableOpacity>
          ))}

          <View
            style={[
              styles.menuDivider,
              { backgroundColor: colors.border, marginVertical: 8 },
            ]}
          />

          <View style={styles.footerButtons}>
            <TouchableOpacity onPress={onClose} style={styles.footerBtn}>
              <Text style={{ color: colors.textSecondary, fontSize: 16, fontWeight: "500" }}>
                Cancelar
              </Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleConfirm} style={styles.footerBtn}>
              <Text style={{ color: colors.tint, fontSize: 16, fontWeight: "600" }}>
                OK
              </Text>
            </TouchableOpacity>
          </View>
        </View>
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
    marginBottom: 8,
  },
  dialogDescription: {
    fontSize: 14,
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
