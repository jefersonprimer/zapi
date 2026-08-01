import React from "react";
import { TouchableOpacity, StyleSheet } from "react-native";
import { useAppTheme } from "@/context/ThemeContext";
import { MaterialCommunityIcons } from "@expo/vector-icons";

interface AttachDocumentButtonProps {
  onPress: () => void;
}

export const AttachDocumentButton: React.FC<AttachDocumentButtonProps> = ({
  onPress,
}) => {
  const { colors } = useAppTheme();

  return (
    <TouchableOpacity style={styles.iconBtn} onPress={onPress}>
      <MaterialCommunityIcons name="paperclip" size={22} color={colors.icon} />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  iconBtn: {
    width: 36,
    height: 36,
    justifyContent: "center",
    alignItems: "center",
    marginHorizontal: 2,
  },
});
