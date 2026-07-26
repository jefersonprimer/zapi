import { Modal, TouchableOpacity, View, Text, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "@/context/AuthContext";
import { useAppTheme } from "@/context/ThemeContext";

interface MainMenuModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function MainMenuModal({
  visible,
  onClose,
}: MainMenuModalProps) {
  const router = useRouter();
  const { signOut } = useAuth();
  const { colors } = useAppTheme();

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.modalOverlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <View
          style={[
            styles.menuContainer,
            {
              backgroundColor: colors.menuBackground,
              borderColor: colors.border,
            },
          ]}
        >
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => {
              onClose();
              router.push("/new-group");
            }}
          >
            <Text style={[styles.menuItemText, { color: colors.text }]}>
              Conversas em grupo
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => {
              onClose();
              router.push("/payments");
            }}
          >
            <Text style={[styles.menuItemText, { color: colors.text }]}>
              Pagamentos
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => {
              onClose();
              router.push("/settings");
            }}
          >
            <Text style={[styles.menuItemText, { color: colors.text }]}>
              Configurações
            </Text>
          </TouchableOpacity>

          <View
            style={[styles.menuDivider, { backgroundColor: colors.border }]}
          />

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => {
              onClose();
              signOut();
            }}
          >
            <Text style={[styles.menuItemText, { color: colors.danger }]}>
              Sair
            </Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "transparent",
  },
  menuContainer: {
    position: "absolute",
    top: 60,
    right: 6,
    borderRadius: 16,
    paddingVertical: 6,
    width: 220,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    borderWidth: 1,
  },
  menuItem: {
    padding: 14,
  },
  menuItemText: {
    fontSize: 16,
    fontWeight: "500",
  },
  menuDivider: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: 12,
  },
});
