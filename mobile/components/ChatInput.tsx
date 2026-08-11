import React, { forwardRef, useState, useEffect } from "react";
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
    const [inputHeight, setInputHeight] = useState(36);

    useEffect(() => {
      if (!value) {
        setInputHeight(36);
      }
    }, [value]);

    return (
      <TextInput
        ref={ref}
        style={[styles.input, { color: colors.text, height: Math.max(36, Math.min(120, inputHeight)) }]}
        placeholder="Mensagem..."
        placeholderTextColor={colors.textSecondary}
        value={value}
        onChangeText={onChangeText}
        onFocus={onFocus}
        multiline
        underlineColorAndroid="transparent"
        onContentSizeChange={(e) => {
          setInputHeight(e.nativeEvent.contentSize.height);
        }}
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
        paddingTop: 6,
        paddingBottom: 6,
        lineHeight: 24,
      } as any,
      default: {
        paddingTop: 6,
        paddingBottom: 6,
        textAlignVertical: "center",
      },
    }),
  },
});
