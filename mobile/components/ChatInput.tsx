import React from "react";
import { TextInput, StyleSheet, Platform } from "react-native";
import { useAppTheme } from "@/context/ThemeContext";

interface ChatInputProps {
  value: string;
  onChangeText: (text: string) => void;
}

export const ChatInput: React.FC<ChatInputProps> = ({
  value,
  onChangeText,
}) => {
  const { colors } = useAppTheme();

  return (
    <TextInput
      style={[styles.input, { color: colors.text }]}
      placeholder="Mensagem..."
      placeholderTextColor={colors.textSecondary}
      value={value}
      onChangeText={onChangeText}
      multiline
      underlineColorAndroid="transparent"
    />
  );
};

const styles = StyleSheet.create({
  input: {
    flex: 1,
    fontSize: 16,
    paddingHorizontal: 8,
    ...Platform.select({
      web: {
        outlineStyle: "none",
        margin: 0,
        height: 36,
        paddingTop: 6,
        paddingBottom: 6,
        lineHeight: 24,
      } as any,
      default: {
        height: 36,
        paddingTop: 6,
        paddingBottom: 6,
        textAlignVertical: "center",
      },
    }),
  },
});
