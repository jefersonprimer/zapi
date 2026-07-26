import React from "react";
import { TouchableOpacity, StyleSheet } from "react-native";
import { Smile, Keyboard } from "lucide-react-native";
import { useAppTheme } from "@/context/ThemeContext";

interface ChatEmojiPickerProps {
  onPress: () => void;
  isEmojiOpen?: boolean;
}

export const ChatEmojiPicker: React.FC<ChatEmojiPickerProps> = ({
  onPress,
  isEmojiOpen = false,
}) => {
  const { colors } = useAppTheme();

  return (
    <TouchableOpacity
      style={styles.iconBtn}
      onPress={onPress}
    >
      {isEmojiOpen ? (
        <Keyboard size={24} color={colors.icon} />
      ) : (
        <Smile size={24} color={colors.icon} />
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  iconBtn: {
    width: 36,
    height: 36,
    justifyContent: "center",
    alignItems: "center",
  },
});

