import React from "react";
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  StyleProp,
  ViewStyle,
} from "react-native";
import { useAppTheme } from "@/context/ThemeContext";
import { API_URL } from "@/services/api";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";

export interface UserContactCardProps {
  avatarUrl?: string | null;
  name?: string | null;
  username: string;
  email?: string | null;
  onPress?: () => void;
  onLongPress?: () => void;
  leftElement?: React.ReactNode;
  rightElement?: React.ReactNode;
  containerStyle?: StyleProp<ViewStyle>;
  showCheckbox?: boolean;
  checked?: boolean;
}

// Helper to get consistent background color for avatars based on user's name
function getAvatarColor(name: string) {
  const colors = [
    "#FF5733",
    "#33FF57",
    "#3357FF",
    "#F3FF33",
    "#FF33F3",
    "#33FFF0",
    "#FFA833",
    "#AF33FF",
    "#33FFA8",
    "#FF3383",
    "#07C160",
    "#10B981",
    "#3B82F6",
    "#8B5CF6",
    "#EC4899",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % colors.length;
  return colors[index];
}

export const UserContactCard: React.FC<UserContactCardProps> = ({
  avatarUrl,
  name,
  username,
  email,
  onPress,
  onLongPress,
  leftElement,
  rightElement,
  containerStyle,
  showCheckbox,
  checked,
}) => {
  const { colors, isDark } = useAppTheme();
  const displayName = name || username;
  const avatarBg = avatarUrl ? "transparent" : getAvatarColor(displayName);

  const renderAvatar = () => {
    if (avatarUrl) {
      const uri = avatarUrl.startsWith("http")
        ? avatarUrl
        : `${API_URL}${avatarUrl.startsWith("/") ? "" : "/"}${avatarUrl}`;
      return <Image source={{ uri }} style={styles.avatarImage} />;
    }
    return (
      <Text
        style={[styles.avatarText, { color: isDark ? colors.text : "#FFF" }]}
      >
        {displayName[0]?.toUpperCase() ?? "?"}
      </Text>
    );
  };

  const CardWrapper = onPress || onLongPress ? TouchableOpacity : View;

  return (
    <CardWrapper
      style={[
        styles.container,
        { borderBottomColor: colors.border },
        containerStyle,
      ]}
      onPress={onPress}
      onLongPress={onLongPress}
      activeOpacity={onPress || onLongPress ? 0.7 : 1}
    >
      <View style={styles.leftRow}>
        {leftElement && <View style={styles.leftElement}>{leftElement}</View>}

        <View
          style={[
            styles.avatar,
            { backgroundColor: avatarUrl ? "transparent" : avatarBg },
          ]}
        >
          {renderAvatar()}
        </View>

        <View style={styles.userInfo}>
          <Text
            style={[styles.nameText, { color: colors.text }]}
            numberOfLines={1}
          >
            {displayName}
          </Text>

          {email && (
            <Text
              style={[styles.emailText, { color: colors.textSecondary }]}
              numberOfLines={1}
            >
              {email}
            </Text>
          )}
        </View>
      </View>

      {rightElement && <View style={styles.rightElement}>{rightElement}</View>}

      {showCheckbox && (
        <View
          style={[
            styles.checkbox,
            { borderColor: colors.border },
            checked && {
              backgroundColor: colors.fab,
              borderColor: colors.fab,
            },
          ]}
        >
          {checked && (
            <MaterialCommunityIcons
              name="check"
              size={14}
              color={isDark ? "#121212" : "#FFFFFF"}
            />
          )}
        </View>
      )}
    </CardWrapper>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  leftRow: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  leftElement: {
    marginRight: 4,
  },
  rightElement: {
    paddingLeft: 8,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
    overflow: "hidden",
  },
  avatarImage: {
    width: "100%",
    height: "100%",
  },
  avatarText: {
    fontSize: 16,
  },
  userInfo: {
    flex: 1,
    justifyContent: "center",
  },
  nameText: {
    fontSize: 16,
  },
  handleText: {
    fontSize: 12,
    marginTop: 1,
  },
  emailText: {
    fontSize: 14,
    marginTop: 2,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 12,
  },
});
