import React from "react";
import { TouchableOpacity, StyleSheet } from "react-native";
import { Paperclip } from "lucide-react-native";
import { useAppTheme } from "@/context/ThemeContext";

interface AttachDocumentButtonProps {
  onPress: () => void;
}

export const AttachDocumentButton: React.FC<AttachDocumentButtonProps> = ({
  onPress,
}) => {
  const { colors } = useAppTheme();

  return (
    <TouchableOpacity style={styles.iconBtn} onPress={onPress}>
      <Paperclip size={22} color={colors.icon} />
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
