import { TouchableOpacity, View, Text, Image, StyleSheet } from "react-native";
import { CheckCircle, MoreHorizontal } from "lucide-react-native";
import { useAppTheme } from "@/context/ThemeContext";
import { getFullRemoteUrl } from "@/services/mediaCache";

interface PostHeaderProps {
  publisherName: string;
  publisherAvatar: string | null;
  publisherType: string;
  isVerified: boolean;
  createdAt: string;
  onPress: () => void;
  onMenuPress: () => void;
}

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const date = new Date(dateStr).getTime();
  const diff = Math.floor((now - date) / 1000);
  if (diff < 60) return "agora";
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  if (diff < 2592000) return `${Math.floor(diff / 86400)}d`;
  return new Date(dateStr).toLocaleDateString("pt-BR");
}

export default function PostHeader({
  publisherName,
  publisherAvatar,
  publisherType,
  isVerified,
  createdAt,
  onPress,
  onMenuPress,
}: PostHeaderProps) {
  const { colors, isDark } = useAppTheme();

  const typeLabel = publisherType === "channel" ? "Canal" : publisherType === "business" ? "Loja" : null;
  const avatarUri = publisherAvatar ? getFullRemoteUrl(publisherAvatar) : null;

  return (
    <TouchableOpacity style={styles.container} onPress={onPress} activeOpacity={0.7}>
      <Image
        source={avatarUri ? { uri: avatarUri } : require("@/assets/images/icon.png")}
        style={styles.avatar}
      />
      <View style={styles.info}>
        <View style={styles.nameRow}>
          <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
            {publisherName}
          </Text>
          {isVerified && (
            <CheckCircle size={14} color={isDark ? "#60A5FA" : "#3B82F6"} style={styles.verifiedIcon} />
          )}
          {typeLabel && (
            <Text style={[styles.typeLabel, { color: colors.textSecondary }]}>{typeLabel}</Text>
          )}
        </View>
        <Text style={[styles.time, { color: colors.textSecondary }]}>{timeAgo(createdAt)}</Text>
      </View>
      <TouchableOpacity onPress={onMenuPress} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
        <MoreHorizontal size={20} color={colors.icon} />
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 10,
  },
  info: {
    flex: 1,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  name: {
    fontSize: 14,
    fontWeight: "600",
  },
  verifiedIcon: {
    marginLeft: 4,
  },
  typeLabel: {
    fontSize: 12,
    marginLeft: 6,
  },
  time: {
    fontSize: 12,
    marginTop: 1,
  },
});
