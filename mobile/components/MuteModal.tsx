import { Modal, TouchableOpacity, View, Text, StyleSheet } from "react-native";
import { useAppTheme } from "@/context/ThemeContext";

interface MuteModalProps {
  visible: boolean;
  onClose: () => void;
  onMute: (durationHours: number | "always") => void;
}

export default function MuteModal({
  visible,
  onClose,
  onMute,
}: MuteModalProps) {
  const { colors } = useAppTheme();

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

          <TouchableOpacity
            style={styles.dialogOption}
            onPress={() => onMute(1)}
          >
            <View style={styles.dialogOptionLabel}>
              <Text style={[styles.dialogOptionText, { color: colors.text }]}>
                1 hora
              </Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.dialogOption}
            onPress={() => onMute(8)}
          >
            <View style={styles.dialogOptionLabel}>
              <Text style={[styles.dialogOptionText, { color: colors.text }]}>
                8 horas
              </Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.dialogOption}
            onPress={() => onMute(24)}
          >
            <View style={styles.dialogOptionLabel}>
              <Text style={[styles.dialogOptionText, { color: colors.text }]}>
                24 horas
              </Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.dialogOption}
            onPress={() => onMute(7 * 24)}
          >
            <View style={styles.dialogOptionLabel}>
              <Text style={[styles.dialogOptionText, { color: colors.text }]}>
                1 semana
              </Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.dialogOption}
            onPress={() => onMute(30 * 24)}
          >
            <View style={styles.dialogOptionLabel}>
              <Text style={[styles.dialogOptionText, { color: colors.text }]}>
                1 mês
              </Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.dialogOption}
            onPress={() => onMute("always")}
          >
            <View style={styles.dialogOptionLabel}>
              <Text style={[styles.dialogOptionText, { color: colors.text }]}>
                Sempre
              </Text>
            </View>
          </TouchableOpacity>

          <View
            style={[
              styles.menuDivider,
              { backgroundColor: colors.border, marginVertical: 8 },
            ]}
          />

          <TouchableOpacity style={styles.dialogCloseButton} onPress={onClose}>
            <Text style={[styles.dialogCloseText, { color: colors.tint }]}>
              Cancelar
            </Text>
          </TouchableOpacity>
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
    marginHorizontal: 12,
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
