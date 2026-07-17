import { TouchableOpacity, View, Text, Image, StyleSheet } from "react-native";
import { useAppTheme } from "@/context/ThemeContext";
import { CheckCircle } from "lucide-react-native";
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

  const borderColor = viewed
    ? isDark
      ? "#4B5563"
      : "#D1D5DB"
    : isDark
      ? "#0A84FF"
      : "#007AFF";

  const avatarUri = avatarUrl ? getFullRemoteUrl(avatarUrl) : null;

  return (
    <TouchableOpacity style={styles.container} onPress={onPress}>
      <View style={[styles.avatarWrapper, { borderColor }]}>
        <Image
          source={
            avatarUri ? { uri: avatarUri } : require("@/assets/images/icon.png")
          }
          style={styles.avatar}
        />
        {isVerified && (
          <CheckCircle
            size={16}
            color={isDark ? "#60A5FA" : "#3B82F6"}
            style={styles.verifiedBadge}
          />
        )}
      </View>
      <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
        {name}
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
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 4,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 50,
  },
  verifiedBadge: {
    position: "absolute",
    bottom: -2,
    right: -2,
  },
  name: {
    fontSize: 12,
    textAlign: "center",
    maxWidth: 68,
  },
});
