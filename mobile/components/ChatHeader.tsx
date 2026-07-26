import React from "react";
import { View, Text, TouchableOpacity, Image, StyleSheet } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useAppTheme } from "@/context/ThemeContext";
import { voiceCallManager } from "@/services/voiceCallManager";
import { API_URL } from "@/services/api";

interface ChatHeaderProps {
  insets: { top: number; bottom: number; left: number; right: number };
  chatId: string;
  participantId?: string;
  participantUsername?: string;
  participantAvatarUrl?: string;
  displayTitle: string;
  isGroup: boolean;
  isSelectionMode: boolean;
  selectedCount: number;
  hasOnlyMessagesSelected: boolean;
  selectedMessageIds: string[];
  clearSelection: () => void;
  onReencaminhar: () => void;
  onEncaminhar: () => void;
  onDeletePress: () => void;
  onOptionsPress: () => void;
  onMenuPress: () => void;
  participantStoreId?: string | null;
}

export const ChatHeader: React.FC<ChatHeaderProps> = ({
  insets,
  chatId,
  participantId,
  participantUsername = "Unknown",
  participantAvatarUrl,
  displayTitle,
  isGroup,
  isSelectionMode,
  selectedCount,
  hasOnlyMessagesSelected,
  selectedMessageIds,
  clearSelection,
  onReencaminhar,
  onEncaminhar,
  onDeletePress,
  onOptionsPress,
  onMenuPress,
  participantStoreId,
}) => {
  const router = useRouter();
  const { colors } = useAppTheme();

  return (
    <View
      style={[
        styles.customHeader,
        {
          paddingTop: insets.top,
          height: insets.top + 60,
          backgroundColor: colors.surface,
          borderBottomColor: colors.border,
        },
      ]}
    >
      <View style={styles.headerLeftContainer}>
        <TouchableOpacity
          onPress={() => (isSelectionMode ? clearSelection() : router.back())}
          style={styles.headerBackBtn}
        >
          <MaterialCommunityIcons
            name="arrow-left"
            size={24}
            color={colors.text}
          />
        </TouchableOpacity>
        {isSelectionMode ? (
          <Text
            style={[
              styles.headerTitleText,
              { color: colors.text, marginLeft: 4 },
            ]}
          >
            {selectedCount}
          </Text>
        ) : null}
        {!isSelectionMode && (
          <TouchableOpacity
            onPress={() => {
              if (isGroup) {
                router.push({
                  pathname: "/group-detail",
                  params: {
                    chatId,
                    participantUsername: displayTitle,
                  },
                });
              } else if (participantId) {
                router.push({
                  pathname: "/contact-detail",
                  params: {
                    participantId,
                    participantUsername,
                    chatId,
                    avatarUrl: participantAvatarUrl || undefined,
                  },
                });
              }
            }}
            style={styles.avatarTitleContainer}
          >
            <View
              style={[
                styles.avatarContainer,
                {
                  backgroundColor: isGroup ? "#34C759" : colors.tint,
                },
              ]}
            >
              {participantAvatarUrl ? (
                <Image
                  source={{
                    uri: participantAvatarUrl.startsWith("http")
                      ? participantAvatarUrl
                      : `${API_URL}${participantAvatarUrl}`,
                  }}
                  style={styles.avatarImage}
                />
              ) : (
                <Text style={styles.avatarPlaceholderText}>
                  {displayTitle[0]?.toUpperCase()}
                </Text>
              )}
            </View>
            <View style={{ flex: 1, justifyContent: "center" }}>
              <Text
                style={[
                  styles.headerTitleText,
                  { color: colors.text, flex: 0 },
                ]}
                numberOfLines={1}
              >
                {displayTitle}
              </Text>
              {participantStoreId ? (
                <Text
                  style={[styles.subTitleText, { color: colors.textSecondary }]}
                  numberOfLines={1}
                >
                  Conta comercial
                </Text>
              ) : null}
            </View>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.headerRightContainer}>
        {isSelectionMode ? (
          <>
            {hasOnlyMessagesSelected && selectedMessageIds.length === 1 && (
              <TouchableOpacity
                onPress={onReencaminhar}
                style={styles.headerActionBtn}
              >
                <MaterialCommunityIcons
                  name="reply"
                  size={22}
                  color={colors.text}
                />
              </TouchableOpacity>
            )}
            {hasOnlyMessagesSelected && (
              <TouchableOpacity
                onPress={onEncaminhar}
                style={styles.headerActionBtn}
              >
                <MaterialCommunityIcons
                  name="share"
                  size={22}
                  color={colors.text}
                />
              </TouchableOpacity>
            )}
            <TouchableOpacity
              onPress={onDeletePress}
              style={styles.headerActionBtn}
            >
              <MaterialCommunityIcons
                name="trash-can-outline"
                size={22}
                color={colors.text}
              />
            </TouchableOpacity>
            {hasOnlyMessagesSelected && selectedMessageIds.length === 1 && (
              <TouchableOpacity
                onPress={onOptionsPress}
                style={styles.headerActionBtn}
              >
                <MaterialCommunityIcons
                  name="dots-vertical"
                  size={22}
                  color={colors.text}
                />
              </TouchableOpacity>
            )}
          </>
        ) : (
          <>
            {participantStoreId && (
              <TouchableOpacity
                onPress={() =>
                  router.push({
                    pathname: "/delivery/[storeId]",
                    params: { storeId: participantStoreId },
                  })
                }
                style={styles.headerActionBtn}
              >
                <MaterialCommunityIcons
                  name="shopping"
                  size={22}
                  color={colors.tint}
                />
              </TouchableOpacity>
            )}
            {!participantStoreId && (
              <TouchableOpacity
                onPress={() =>
                  voiceCallManager.startCall(
                    participantId,
                    participantUsername,
                    true,
                    participantAvatarUrl,
                  )
                }
                style={styles.headerActionBtn}
              >
                <MaterialCommunityIcons
                  name="video-outline"
                  size={22}
                  color={colors.text}
                />
              </TouchableOpacity>
            )}
            <TouchableOpacity
              onPress={() =>
                voiceCallManager.startCall(
                  participantId,
                  participantUsername,
                  false,
                  participantAvatarUrl,
                )
              }
              style={styles.headerActionBtn}
            >
              <MaterialCommunityIcons
                name="phone-outline"
                size={22}
                color={colors.text}
              />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={onMenuPress}
              style={styles.headerActionBtn}
            >
              <MaterialCommunityIcons
                name="dots-vertical"
                size={22}
                color={colors.text}
              />
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  customHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#ffffff",
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
  },
  headerLeftContainer: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  headerBackBtn: {
    padding: 8,
    marginRight: 4,
  },
  headerTitleText: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#272727",
    flex: 1,
  },
  subTitleText: {
    fontSize: 12,
    marginTop: 2,
  },
  headerRightContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  headerActionBtn: {
    padding: 8,
    marginLeft: 12,
  },
  avatarTitleContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
  },
  avatarContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
    overflow: "hidden",
  },
  avatarImage: {
    width: "100%",
    height: "100%",
  },
  avatarPlaceholderText: {
    color: "#FFF",
    fontSize: 14,
    fontWeight: "bold",
  },
});
