import React, { forwardRef } from "react";
import { TextInput, StyleSheet, Platform } from "react-native";
import { useAppTheme } from "@/context/ThemeContext";

interface ChatInputProps {
  value: string;
  onChangeText: (text: string) => void;
  onFocus?: () => void;
}

export const ChatInput = forwardRef<TextInput, ChatInputProps>(
  ({ value, onChangeText, onFocus }, ref) => {
    const { colors } = useAppTheme();

    return (
      <TextInput
        ref={ref}
        style={[styles.input, { color: colors.text }]}
        placeholder="Mensagem..."
        placeholderTextColor={colors.textSecondary}
        value={value}
        onChangeText={onChangeText}
        onFocus={onFocus}
        multiline
        underlineColorAndroid="transparent"
      />
    );
  }
);
ChatInput.displayName = "ChatInput";

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
