import React from "react";
import { Modal, TouchableOpacity, View, Text, StyleSheet } from "react-native";

interface ChatMenuModalProps {
  visible: boolean;
  onClose: () => void;
  isContact: boolean;
  onToggleContact: () => void;
}

export const ChatMenuModal: React.FC<ChatMenuModalProps> = ({
  visible,
  onClose,
  isContact,
  onToggleContact,
}) => {
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
        <View style={styles.menuContainer}>
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => {
              onToggleContact();
              onClose();
            }}
          >
            <Text
              style={[
                styles.menuItemText,
                !isContact ? styles.addText : styles.removeText,
              ]}
            >
              {isContact ? "Remover dos contatos" : "Adicionar aos contatos"}
            </Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.05)",
  },
  menuContainer: {
    position: "absolute",
    top: 60,
    right: 16,
    backgroundColor: "#fff",
    borderRadius: 12,
    paddingVertical: 6,
    width: 200,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    borderWidth: 1,
    borderColor: "#f0f0f0",
  },
  menuItem: {
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  menuItemText: {
    fontSize: 16,
    fontWeight: "500",
  },
  addText: {
    color: "#007AFF",
  },
  removeText: {
    color: "#ff3b30",
  },
});
