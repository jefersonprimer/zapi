import React from "react";
import { TextInput, StyleSheet, Platform } from "react-native";

interface ChatInputProps {
  value: string;
  onChangeText: (text: string) => void;
}

export const ChatInput: React.FC<ChatInputProps> = ({
  value,
  onChangeText,
}) => {
  return (
    <TextInput
      style={styles.input}
      placeholder="Message..."
      placeholderTextColor="#272727"
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
    color: "#272727",
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
