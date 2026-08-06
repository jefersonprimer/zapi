import React from "react";
import { TouchableOpacity, StyleSheet } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
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
    <TouchableOpacity style={styles.iconBtn} onPress={onPress}>
      {isEmojiOpen ? (
        <MaterialCommunityIcons
          name="keyboard-outline"
          size={24}
          color={colors.icon}
        />
      ) : (
        <MaterialCommunityIcons
          name="sticker-emoji"
          size={24}
          color={colors.icon}
        />
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
