import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import {
  Flag, EyeOff, VolumeX, Bookmark,
} from "lucide-react-native";
import { useAppTheme } from "@/context/ThemeContext";

interface PostOptionsMenuProps {
  visible: boolean;
  onClose: () => void;
  onReport: () => void;
  onHide: () => void;
  onMute: () => void;
  onSave: () => void;
  isSaved?: boolean;
}

export default function PostOptionsMenu({
  visible,
  onClose,
  onReport,
  onHide,
  onMute,
  onSave,
  isSaved,
}: PostOptionsMenuProps) {
  const { colors } = useAppTheme();

  if (!visible) return null;

  return (
    <View style={styles.overlay}>
      <TouchableOpacity style={styles.backdrop} onPress={onClose} />
      <View style={[styles.menu, { backgroundColor: colors.menuBackground }]}>
        <TouchableOpacity style={styles.item} onPress={() => { onSave(); onClose(); }}>
          <Bookmark size={20} color={colors.text} />
          <Text style={[styles.itemText, { color: colors.text }]}>
            {isSaved ? "Remover dos salvos" : "Salvar post"}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.item} onPress={() => { onHide(); onClose(); }}>
          <EyeOff size={20} color={colors.text} />
          <Text style={[styles.itemText, { color: colors.text }]}>Não tenho interesse</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.item} onPress={() => { onMute(); onClose(); }}>
          <VolumeX size={20} color={colors.text} />
          <Text style={[styles.itemText, { color: colors.text }]}>Silenciar publisher</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.item} onPress={() => { onReport(); onClose(); }}>
          <Flag size={20} color={colors.danger} />
          <Text style={[styles.itemText, { color: colors.danger }]}>Denunciar</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "flex-end",
    zIndex: 100,
  },
  backdrop: {
    flex: 1,
  },
  menu: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 8,
    paddingBottom: 24,
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
  },
  itemText: {
    fontSize: 16,
  },
});
