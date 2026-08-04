import { TouchableOpacity, View, Text, Image, StyleSheet } from "react-native";
import { useAppTheme } from "@/context/ThemeContext";
import { Ionicons } from "@expo/vector-icons";
import { getFullRemoteUrl } from "@/services/mediaCache";

interface StoryItemProps {
  name: string;
  avatarUrl: string | null;
  isVerified: boolean;
  viewed: boolean;
  onPress: () => void;
}

export default function StoryItem({
  name,
  avatarUrl,
  isVerified,
  viewed,
  onPress,
}: StoryItemProps) {
  const { colors, isDark } = useAppTheme();
  const avatarUri = avatarUrl ? getFullRemoteUrl(avatarUrl) : null;

  const ringColor = viewed
    ? isDark
      ? "#3A3A3C"
      : "#E5E5EA"
    : "#07C160";

  return (
    <TouchableOpacity style={styles.container} onPress={onPress} activeOpacity={0.7}>
      <View style={[styles.ring, { borderColor: ringColor }]}>
        <Image
          source={
            avatarUri ? { uri: avatarUri } : require("@/assets/images/icon.png")
          }
          style={styles.avatar}
        />
        {isVerified && (
          <Ionicons
            name="checkmark-circle"
            size={15}
            color={isDark ? "#60A5FA" : "#3B82F6"}
            style={styles.verifiedBadge}
          />
        )}
      </View>
      <Text
        style={[styles.name, { color: viewed ? colors.textSecondary : colors.text }]}
        numberOfLines={1}
      >
        {name}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    marginRight: 18,
    width: 80,
  },
  ring: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 3,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
    elevation: 1,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
  },
  verifiedBadge: {
    position: "absolute",
    bottom: -1,
    right: -1,
  },
  name: {
    fontSize: 11,
    textAlign: "center",
    maxWidth: 76,
  },
});
