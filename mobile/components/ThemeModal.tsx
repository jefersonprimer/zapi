import { Modal, TouchableOpacity, View, Text, StyleSheet } from "react-native";
import { Sun, Moon, Laptop, Check } from "lucide-react-native";
import { useAppTheme } from "@/context/ThemeContext";

interface ThemeModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function ThemeModal({ visible, onClose }: ThemeModalProps) {
  const { colors, themePreference, setThemePreference } = useAppTheme();

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={[
          styles.dialogOverlay,
          { backgroundColor: colors.modalOverlay },
        ]}
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
            Escolher tema
          </Text>

          <TouchableOpacity
            style={styles.dialogOption}
            onPress={async () => {
              await setThemePreference("light");
              onClose();
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
              onClose();
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
              onClose();
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
            onPress={onClose}
          >
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
