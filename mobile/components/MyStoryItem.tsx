import { TouchableOpacity, View, Text, Image, StyleSheet } from "react-native";
import { useAppTheme } from "@/context/ThemeContext";
import { getFullRemoteUrl } from "@/services/mediaCache";
import { MaterialCommunityIcons } from "@expo/vector-icons";

interface MyStoryItemProps {
  avatarUrl: string | null;
  onPress: () => void;
}

export default function MyStoryItem({ avatarUrl, onPress }: MyStoryItemProps) {
  const { colors } = useAppTheme();
  const avatarUri = avatarUrl ? getFullRemoteUrl(avatarUrl) : null;

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={[styles.ring, { borderColor: colors.tint }]}>
        <Image
          source={
            avatarUri ? { uri: avatarUri } : require("@/assets/images/icon.png")
          }
          style={styles.avatar}
        />
        <View style={[styles.plusBadge, { backgroundColor: colors.tint }]}>
          <MaterialCommunityIcons
            name="plus"
            size={14}
            color="white"
            strokeWidth={2.5}
          />
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
  plusBadge: {
    position: "absolute",
    bottom: -1,
    right: -1,
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "white",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 2,
    elevation: 2,
  },
  name: {
    fontSize: 11,
    textAlign: "center",
    maxWidth: 76,
  },
});
