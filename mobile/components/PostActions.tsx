import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Heart, MessageCircle, Share2, Bookmark } from "lucide-react-native";
import { useAppTheme } from "@/context/ThemeContext";

interface PostActionsProps {
  liked: boolean;
  likesCount: number;
  commentsCount: number;
  saved: boolean;
  onLike: () => void;
  onComment: () => void;
  onShare: () => void;
  onSave: () => void;
}

export default function PostActions({
  liked,
  likesCount,
  commentsCount,
  saved,
  onLike,
  onComment,
  onShare,
  onSave,
}: PostActionsProps) {
  const { colors, isDark } = useAppTheme();

  return (
    <View style={styles.container}>
      <View style={styles.left}>
        <TouchableOpacity onPress={onLike} style={styles.action} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Heart
            size={22}
            color={liked ? (isDark ? "#F87171" : "#EF4444") : colors.icon}
            fill={liked ? (isDark ? "#F87171" : "#EF4444") : "transparent"}
          />
          {likesCount > 0 && (
            <Text style={[styles.count, { color: colors.textSecondary }]}>{likesCount}</Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity onPress={onComment} style={styles.action} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <MessageCircle size={22} color={colors.icon} />
          {commentsCount > 0 && (
            <Text style={[styles.count, { color: colors.textSecondary }]}>{commentsCount}</Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity onPress={onShare} style={styles.action} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Share2 size={22} color={colors.icon} />
        </TouchableOpacity>
      </View>
      <TouchableOpacity onPress={onSave} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <Bookmark
          size={22}
          color={saved ? (isDark ? "#FBBF24" : "#F59E0B") : colors.icon}
          fill={saved ? (isDark ? "#FBBF24" : "#F59E0B") : "transparent"}
        />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  left: {
    flexDirection: "row",
    alignItems: "center",
  },
  action: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: 20,
  },
  count: {
    fontSize: 13,
    marginLeft: 4,
  },
});
