import { TouchableOpacity, View, Text, Image, StyleSheet } from "react-native";
import { Plus } from "lucide-react-native";
import { useAppTheme } from "@/context/ThemeContext";
import { getFullRemoteUrl } from "@/services/mediaCache";

interface MyStoryItemProps {
  avatarUrl: string | null;
  onPress: () => void;
}

export default function MyStoryItem({ avatarUrl, onPress }: MyStoryItemProps) {
  const { colors } = useAppTheme();
  const avatarUri = avatarUrl ? getFullRemoteUrl(avatarUrl) : null;

  return (
    <TouchableOpacity style={styles.container} onPress={onPress}>
      <View style={styles.avatarWrapper}>
        <Image
          source={
            avatarUri ? { uri: avatarUri } : require("@/assets/images/icon.png")
          }
          style={styles.avatar}
        />
        <View style={[styles.plusBadge, { backgroundColor: colors.tint }]}>
          <Plus size={16} color="white" />
        </View>
      </View>
      <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
        Seu status
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    marginRight: 16,
    width: 90,
  },
  avatarWrapper: {
    width: 90,
    height: 90,
    borderRadius: 50,
    borderWidth: 3,
    borderColor: "#D1D5DB",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 4,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 50,
  },
  plusBadge: {
    position: "absolute",
    bottom: -2,
    right: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: "center",
    alignItems: "center",
  },
  name: {
    fontSize: 12,
    textAlign: "center",
    maxWidth: 68,
  },
});
