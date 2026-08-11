import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TextInput,
  ScrollView,
  Switch,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAppTheme } from "@/context/ThemeContext";
import * as Haptics from "expo-haptics";

interface PollModalProps {
  visible: boolean;
  onClose: () => void;
  onSendPoll: (question: string, options: string[], multipleAnswers: boolean) => void;
}

export function PollModal({ visible, onClose, onSendPoll }: PollModalProps) {
  const { colors, isDark } = useAppTheme();
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState<string[]>(["", ""]);
  const [multipleAnswers, setMultipleAnswers] = useState(false);

  const handleAddOption = () => {
    if (options.length >= 10) {
      Alert.alert("Limite", "Você pode adicionar no máximo 10 opções.");
      return;
    }
    setOptions((prev) => [...prev, ""]);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleRemoveOption = (index: number) => {
    if (options.length <= 2) {
      Alert.alert("Aviso", "Uma enquete precisa de pelo menos 2 opções.");
      return;
    }
    setOptions((prev) => prev.filter((_, i) => i !== index));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleOptionChange = (text: string, index: number) => {
    setOptions((prev) => {
      const next = [...prev];
      next[index] = text;
      return next;
    });
  };

  const handleCreate = () => {
    if (!question.trim()) {
      Alert.alert("Aviso", "Por favor, digite a pergunta da enquete.");
      return;
    }

    const filledOptions = options.map((opt) => opt.trim()).filter(Boolean);
    if (filledOptions.length < 2) {
      Alert.alert("Aviso", "Por favor, preencha pelo menos 2 opções válidas.");
      return;
    }

    onSendPoll(question.trim(), filledOptions, multipleAnswers);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    
    // Reset state
    setQuestion("");
    setOptions(["", ""]);
    setMultipleAnswers(false);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={[styles.container, { backgroundColor: colors.background }]}
      >
        {/* Header */}
        <View
          style={[
            styles.header,
            {
              borderBottomColor: colors.border,
              backgroundColor: isDark ? "#1E1E1E" : "#FFFFFF",
            },
          ]}
        >
          <TouchableOpacity onPress={onClose} style={styles.headerButton}>
            <Ionicons name="close" size={26} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            Criar Enquete
          </Text>
          <TouchableOpacity onPress={handleCreate} style={styles.headerButton}>
            <Ionicons name="checkmark" size={26} color={colors.tint} />
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Question Input */}
          <View style={styles.section}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>
              Pergunta
            </Text>
            <TextInput
              style={[
                styles.questionInput,
                {
                  color: colors.text,
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                },
              ]}
              value={question}
              onChangeText={setQuestion}
              placeholder="Indique a pergunta da enquete"
              placeholderTextColor={colors.textSecondary + "80"}
              maxLength={150}
              multiline
            />
          </View>

          {/* Options Section */}
          <View style={styles.section}>
            <View style={styles.optionsHeader}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>
                Opções
              </Text>
              <Text style={{ fontSize: 12, color: colors.textSecondary }}>
                {options.length}/10
              </Text>
            </View>

            {options.map((option, index) => (
              <View key={index} style={styles.optionRow}>
                <TextInput
                  style={[
                    styles.optionInput,
                    {
                      color: colors.text,
                      backgroundColor: colors.surface,
                      borderColor: colors.border,
                    },
                  ]}
                  value={option}
                  onChangeText={(text) => handleOptionChange(text, index)}
                  placeholder={`Opção ${index + 1}`}
                  placeholderTextColor={colors.textSecondary + "80"}
                  maxLength={80}
                />
                <TouchableOpacity
                  onPress={() => handleRemoveOption(index)}
                  style={styles.deleteButton}
                  disabled={options.length <= 2}
                >
                  <Ionicons
                    name="trash-outline"
                    size={20}
                    color={options.length <= 2 ? colors.textSecondary + "40" : "#FF3B30"}
                  />
                </TouchableOpacity>
              </View>
            ))}

            <TouchableOpacity
              onPress={handleAddOption}
              style={[styles.addOptionButton, { borderColor: colors.tint }]}
            >
              <Ionicons name="add" size={20} color={colors.tint} style={{ marginRight: 6 }} />
              <Text style={[styles.addOptionText, { color: colors.tint }]}>
                Adicionar Opção
              </Text>
            </TouchableOpacity>
          </View>

          {/* Settings Section */}
          <View
            style={[
              styles.settingsRow,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
              },
            ]}
          >
            <View style={styles.settingsLabelContainer}>
              <Text style={[styles.settingsTitle, { color: colors.text }]}>
                Permitir várias respostas
              </Text>
              <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>
                Permite que os participantes votem em mais de uma opção
              </Text>
            </View>
            <Switch
              value={multipleAnswers}
              onValueChange={(val) => {
                setMultipleAnswers(val);
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
              trackColor={{ false: colors.border, true: colors.tint + "80" }}
              thumbColor={multipleAnswers ? colors.tint : "#f4f3f4"}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    height: 60,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    ...Platform.select({
      ios: {
        paddingTop: 10,
      },
    }),
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  headerButton: {
    width: 44,
    height: 44,
    justifyContent: "center",
    alignItems: "center",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  section: {
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  questionInput: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    fontSize: 16,
    minHeight: 80,
    textAlignVertical: "top",
  },
  optionsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  optionInput: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    fontSize: 16,
  },
  deleteButton: {
    width: 44,
    height: 44,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 8,
  },
  addOptionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderStyle: "dashed",
    borderRadius: 12,
    padding: 14,
    marginTop: 8,
  },
  addOptionText: {
    fontSize: 16,
    fontWeight: "600",
  },
  settingsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginTop: 8,
  },
  settingsLabelContainer: {
    flex: 1,
    paddingRight: 16,
  },
  settingsTitle: {
    fontSize: 16,
    fontWeight: "600",
  },
});
