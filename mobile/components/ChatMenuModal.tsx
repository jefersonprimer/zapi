import React from "react";
import { Modal, TouchableOpacity, View, Text, StyleSheet } from "react-native";
import { useAppTheme } from "@/context/ThemeContext";

interface ChatMenuModalProps {
  visible: boolean;
  onClose: () => void;
  isContact: boolean;
  onToggleContact: () => void;
  onViewContact?: () => void;
  isGroup?: boolean;
  isBlocked?: boolean;
  onMutePress?: () => void;
  onBlockPress?: () => void;
  onClearChatPress?: () => void;
  onAddToListPress?: () => void;
}

export const ChatMenuModal: React.FC<ChatMenuModalProps> = ({
  visible,
  onClose,
  isContact,
  onToggleContact,
  onViewContact,
  isGroup = false,
  isBlocked = false,
  onMutePress,
  onBlockPress,
  onClearChatPress,
  onAddToListPress,
}) => {
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
          {onViewContact && (
            <TouchableOpacity
              style={[
                styles.menuItem,
                {
                  borderBottomWidth: StyleSheet.hairlineWidth,
                  borderBottomColor: colors.border,
                },
              ]}
              onPress={() => {
                onViewContact();
                onClose();
              }}
            >
              <Text style={[styles.menuItemText, { color: colors.text }]}>
                {isGroup ? "Dados do grupo" : "Ver contato"}
              </Text>
            </TouchableOpacity>
          )}

          {onMutePress && (
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                onMutePress();
                onClose();
              }}
            >
              <Text style={[styles.menuItemText, { color: colors.text }]}>
                Silenciar notificações
              </Text>
            </TouchableOpacity>
          )}

          {onAddToListPress && (
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                onAddToListPress();
                onClose();
              }}
            >
              <Text style={[styles.menuItemText, { color: colors.text }]}>
                Adicionar à lista
              </Text>
            </TouchableOpacity>
          )}

          {onClearChatPress && (
            <TouchableOpacity
              style={[
                styles.menuItem,
                onViewContact && {
                  borderBottomWidth: StyleSheet.hairlineWidth,
                  borderBottomColor: colors.border,
                },
              ]}
              onPress={() => {
                onClearChatPress();
                onClose();
              }}
            >
              <Text style={[styles.menuItemText, { color: colors.text }]}>
                Limpar conversa
              </Text>
            </TouchableOpacity>
          )}

          {!isGroup && onBlockPress && (
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                onBlockPress();
                onClose();
              }}
            >
              <Text style={[styles.menuItemText, { color: colors.danger }]}>
                {isBlocked ? "Desbloquear" : "Bloquear"}
              </Text>
            </TouchableOpacity>
          )}

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
                !isContact
                  ? [styles.addText, { color: colors.tint }]
                  : [styles.removeText, { color: colors.danger }],
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
    backgroundColor: "transparent",
  },
  menuContainer: {
    position: "absolute",
    top: 60,
    right: 6,
    borderRadius: 12,
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
  addText: {},
  removeText: {},
});
