import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useAppTheme } from "@/context/ThemeContext";

interface ChatBlockedBarProps {
  isBlockedByMe: boolean;
  isBlockedByThem: boolean;
  messagesRestrictedReason: "contacts" | "nobody" | null;
  onUnblock: () => void;
}

export const ChatBlockedBar: React.FC<ChatBlockedBarProps> = ({
  isBlockedByMe,
  isBlockedByThem,
  messagesRestrictedReason,
  onUnblock,
}) => {
  const { colors, isDark } = useAppTheme();

  if (!isBlockedByMe && !isBlockedByThem && !messagesRestrictedReason) {
    return null;
  }

  return (
    <View
      style={[
        styles.blockedContainer,
        { backgroundColor: isDark ? "#1E293B" : "#F1F5F9" },
      ]}
    >
      <Text style={[styles.blockedText, { color: colors.textSecondary }]}>
        {isBlockedByMe
          ? "Você bloqueou este contato. Desbloqueie para enviar mensagens."
          : isBlockedByThem
            ? "Você está bloqueado. Não é possível enviar mensagens."
            : messagesRestrictedReason === "nobody"
              ? "Este usuário não recebe mensagens de ninguém."
              : "Este usuário recebe mensagens apenas de contatos."}
      </Text>
      {isBlockedByMe && (
        <TouchableOpacity
          onPress={onUnblock}
          style={[styles.unblockButton, { backgroundColor: colors.tint }]}
        >
          <Text style={styles.unblockButtonText}>Desbloquear</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  blockedContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 12,
    borderRadius: 12,
    marginHorizontal: 12,
    marginVertical: 4,
  },
  blockedText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 18,
    marginRight: 10,
  },
  unblockButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  unblockButtonText: {
    color: "#ffffff",
    fontWeight: "bold",
    fontSize: 13,
  },
});
