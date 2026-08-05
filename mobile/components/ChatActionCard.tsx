import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { IntentSuggestion } from "@/services/chatIntentEngine";
import { useItemsStore } from "@/store/useItemsStore";
import { useAppTheme } from "@/context/ThemeContext";

interface Props {
  suggestion: IntentSuggestion;
  onDismiss: () => void;
  onSuccess?: () => void;
}

export function ChatActionCard({ suggestion, onDismiss, onSuccess }: Props) {
  const { colors, isDark } = useAppTheme();
  const { createNote, createReminder, createEvent } = useItemsStore();

  const isNote = suggestion.type === "note";
  const isReminder = suggestion.type === "reminder";
  const isEvent = suggestion.type === "event";

  const handleAction = async () => {
    try {
      if (isNote) {
        await createNote({
          title: suggestion.title,
          content: suggestion.content,
          noteType: "text",
        });
      } else if (isReminder) {
        await createReminder({
          title: suggestion.title,
          content: suggestion.content,
          dueDate: suggestion.dueDate || new Date().toISOString(),
          repeat: "none",
          priority: "none",
        });
      } else if (isEvent) {
        await createEvent({
          title: suggestion.title,
          content: suggestion.content,
          start: suggestion.start || new Date().toISOString(),
          end: suggestion.end || new Date(Date.now() + 3600000).toISOString(),
          allDay: false,
          participants: [],
          repeat: "none",
        });
      }

      onDismiss();
      if (onSuccess) onSuccess();
    } catch (e) {
      console.error("Erro ao aceitar sugestão do card:", e);
    }
  };

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: isDark ? "#1E293B" : "#F1F5F9",
          borderColor: isNote ? "#6366F1" : isReminder ? "#F59E0B" : "#10B981",
        },
      ]}
    >
      <View style={styles.header}>
        <View style={styles.titleRow}>
          {isNote && <Ionicons name="document-text" size={18} color="#6366F1" />}
          {isReminder && <Ionicons name="alarm" size={18} color="#F59E0B" />}
          {isEvent && <Ionicons name="calendar" size={18} color="#10B981" />}

          <Text style={[styles.headerTitle, { color: colors.text }]}>
            {isNote
              ? "📝 Sugestão: Criar Nota"
              : isReminder
              ? "⏰ Sugestão: Criar Lembrete"
              : "📅 Sugestão: Agendar Evento"}
          </Text>
        </View>

        <TouchableOpacity onPress={onDismiss} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="close" size={18} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      <Text style={[styles.itemTitle, { color: colors.text }]} numberOfLines={1}>
        {suggestion.title}
      </Text>

      {suggestion.dueDate && (
        <Text style={styles.timeText}>
          ⏰ Vencimento: {new Date(suggestion.dueDate).toLocaleString("pt-BR")}
        </Text>
      )}

      {suggestion.start && (
        <Text style={styles.timeText}>
          📅 Início: {new Date(suggestion.start).toLocaleString("pt-BR")}
        </Text>
      )}

      <TouchableOpacity
        style={[
          styles.actionBtn,
          {
            backgroundColor: isNote ? "#6366F1" : isReminder ? "#F59E0B" : "#10B981",
          },
        ]}
        onPress={handleAction}
      >
        <Text style={styles.actionBtnText}>
          {isNote ? "Criar Nota" : isReminder ? "Criar Lembrete" : "Criar Evento"}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginVertical: 8,
    padding: 12,
    borderRadius: 12,
    borderLeftWidth: 4,
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  headerTitle: {
    fontSize: 13,
    fontWeight: "bold",
  },
  itemTitle: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 4,
  },
  timeText: {
    fontSize: 12,
    color: "#64748B",
    marginBottom: 8,
  },
  actionBtn: {
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 4,
  },
  actionBtnText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "bold",
  },
});
