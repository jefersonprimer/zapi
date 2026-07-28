import React from "react";
import { Modal, View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useAppTheme } from "@/context/ThemeContext";

interface ChatDeleteModalProps {
  visible: boolean;
  onClose: () => void;
  deleteModalTitle: string;
  isDeleteForEveryoneAvailable: boolean;
  onDeleteForEveryone: () => void;
  onDeleteForMe: () => void;
}

export const ChatDeleteModal: React.FC<ChatDeleteModalProps> = ({
  visible,
  onClose,
  deleteModalTitle,
  isDeleteForEveryoneAvailable,
  onDeleteForEveryone,
  onDeleteForMe,
}) => {
  const { colors, isDark } = useAppTheme();

  return (
    <Modal
      transparent={true}
      visible={visible}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View
        style={[
          styles.modalOverlayCentered,
          { backgroundColor: colors.modalOverlay },
        ]}
      >
        <View
          style={[
            styles.alertContainer,
            { backgroundColor: colors.menuBackground },
          ]}
        >
          <Text style={[styles.alertTitle, { color: colors.text }]}>
            {deleteModalTitle}
          </Text>
          <View
            style={
              isDeleteForEveryoneAvailable
                ? styles.alertButtonsVertical
                : styles.alertButtons
            }
          >
            {isDeleteForEveryoneAvailable ? (
              <>
                <TouchableOpacity
                  style={[
                    styles.alertButtonVertical,
                    styles.deleteEveryoneButton,
                    { backgroundColor: colors.danger },
                  ]}
                  onPress={onDeleteForEveryone}
                >
                  <Text style={styles.deleteButtonText}>Apagar para todos</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.alertButtonVertical,
                    styles.deleteMeButton,
                    { backgroundColor: isDark ? "#2C2C2E" : "#f5f5f5" },
                  ]}
                  onPress={onDeleteForMe}
                >
                  <Text
                    style={[styles.deleteMeButtonText, { color: colors.tint }]}
                  >
                    Apagar para mim
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.alertButtonVertical,
                    styles.cancelButtonVertical,
                    { backgroundColor: isDark ? "#2C2C2E" : "#e0e0e0" },
                  ]}
                  onPress={onClose}
                >
                  <Text
                    style={[
                      styles.cancelButtonText,
                      { color: colors.textSecondary },
                    ]}
                  >
                    Cancelar
                  </Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <TouchableOpacity
                  style={[styles.alertButton, styles.cancelButton]}
                  onPress={onClose}
                >
                  <Text
                    style={[
                      styles.cancelButtonText,
                      { color: colors.textSecondary },
                    ]}
                  >
                    Cancelar
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.alertButton, styles.deleteButton]}
                  onPress={onDeleteForMe}
                >
                  <Text style={styles.deleteButtonText}>Apagar para mim</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlayCentered: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    justifyContent: "center",
    alignItems: "center",
  },
  alertContainer: {
    width: "80%",
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  alertTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#272727",
    marginBottom: 24,
    textAlign: "center",
  },
  alertButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
  },
  alertButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  cancelButton: {
    fontSize: 16,
    marginRight: 8,
  },
  deleteButton: {
    fontSize: 16,
    marginLeft: 8,
  },
  cancelButtonText: {
    color: "#666",
    fontSize: 14,
    fontWeight: "600",
  },
  deleteButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  alertButtonsVertical: {
    flexDirection: "column",
    width: "100%",
    gap: 10,
  },
  alertButtonVertical: {
    width: "100%",
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  deleteEveryoneButton: {
    backgroundColor: "#ff3b30",
  },
  deleteMeButton: {
    backgroundColor: "#f5f5f5",
  },
  deleteMeButtonText: {
    color: "#ff9500",
    fontSize: 14,
    fontWeight: "600",
  },
  cancelButtonVertical: {
    backgroundColor: "#e0e0e0",
  },
});
