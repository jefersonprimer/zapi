import { useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Image,
} from "react-native";
import { useFocusEffect } from "expo-router";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useAuth } from "@/context/AuthContext";
import {
  getCallHistory,
  deleteCallHistoryItem,
  type CallHistoryItem,
} from "@/services/callApi";
import { voiceCallManager } from "@/services/voiceCallManager";
import { useAppTheme } from "@/context/ThemeContext";
import { API_URL } from "@/services/api";

export default function CallsScreen() {
  const { token, user } = useAuth();
  const { colors, isDark } = useAppTheme();
  const [calls, setCalls] = useState<CallHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCallIds, setSelectedCallIds] = useState<string[]>([]);

  const isSelectionMode = selectedCallIds.length > 0;

  const fetchCalls = useCallback(async () => {
    if (!token) return;
    try {
      const data = await getCallHistory(token);
      setCalls(data);
    } catch (err: any) {
      console.error("Failed to fetch call history:", err);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      fetchCalls();
    }, [fetchCalls]),
  );

  const toggleSelection = (id: string) => {
    setSelectedCallIds((prev) => {
      if (prev.includes(id)) {
        return prev.filter((item) => item !== id);
      } else {
        return [...prev, id];
      }
    });
  };

  const deleteSelectedCalls = async () => {
    if (!token || selectedCallIds.length === 0) return;
    try {
      await Promise.all(
        selectedCallIds.map((id) => deleteCallHistoryItem(token, id)),
      );
      setCalls((prevCalls) =>
        prevCalls.filter((c) => !selectedCallIds.includes(c.id)),
      );
      setSelectedCallIds([]);
    } catch (err: any) {
      console.error("Failed to delete selected calls:", err);
      Alert.alert("Erro", "Não foi possível excluir as ligações selecionadas.");
    }
  };

  const handleDeleteSelectedPrompt = () => {
    Alert.alert(
      "Excluir ligações",
      `Deseja apagar as ${selectedCallIds.length} ligações selecionadas do seu histórico?`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Excluir",
          style: "destructive",
          onPress: deleteSelectedCalls,
        },
      ],
      { cancelable: true },
    );
  };

  const handlePressItem = (item: CallHistoryItem) => {
    if (isSelectionMode) {
      toggleSelection(item.id);
    }
  };

  const handleLongPress = (item: CallHistoryItem) => {
    toggleSelection(item.id);
  };

  const handleCallBack = (
    userId: string,
    username: string,
    avatarUrl?: string | null,
  ) => {
    voiceCallManager.startCall(userId, username, false, avatarUrl);
  };

  const resolveAvatarUri = (avatarUrl?: string | null): string | null => {
    if (!avatarUrl) return null;
    return avatarUrl.startsWith("http")
      ? avatarUrl
      : `${API_URL}${avatarUrl.startsWith("/") ? "" : "/"}${avatarUrl}`;
  };

  const renderItem = ({ item }: { item: CallHistoryItem }) => {
    const isOutgoing = item.caller_id === user?.user_id;
    const peerName = isOutgoing ? item.callee_username : item.caller_username;
    const peerId = isOutgoing ? item.callee_id : item.caller_id;
    const peerAvatarUrl = isOutgoing
      ? item.callee_avatar_url
      : item.caller_avatar_url;
    const peerAvatarUri = resolveAvatarUri(peerAvatarUrl);

    if (!peerName) return null;

    let statusIconName = "phone-incoming";
    let iconColor = "#34C759"; // Green

    if (isOutgoing) {
      statusIconName = "phone-outgoing";
    }

    if (
      item.status === "missed" ||
      item.status === "rejected" ||
      item.status === "busy"
    ) {
      statusIconName = "phone-missed";
      iconColor = "#FF3B30"; // Red
    } else if (item.status === "failed") {
      statusIconName = "phone-off";
      iconColor = "#FF9500"; // Orange
    }

    const formattedDate = new Date(item.created_at).toLocaleDateString([], {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    const formatDuration = (secs: number) => {
      if (secs === 0) return "";
      const mins = Math.floor(secs / 60);
      const remainingSecs = secs % 60;
      if (mins > 0) {
        return `${mins}m ${remainingSecs}s`;
      }
      return `${remainingSecs}s`;
    };

    const isSelected = selectedCallIds.includes(item.id);

    return (
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => handlePressItem(item)}
        onLongPress={() => handleLongPress(item)}
        delayLongPress={500}
        style={[
          styles.callItem,
          { borderBottomColor: colors.border },
          isSelected && {
            backgroundColor: isDark
              ? "rgba(10, 132, 255, 0.15)"
              : "rgba(0, 122, 255, 0.1)",
          },
        ]}
      >
        <View style={styles.leftContainer}>
          <View
            style={[
              styles.avatar,
              { backgroundColor: isOutgoing ? colors.tint : "#34C759" },
            ]}
          >
            {peerAvatarUri ? (
              <Image
                source={{ uri: peerAvatarUri }}
                style={styles.avatarImage}
              />
            ) : (
              <Text style={styles.avatarText}>
                {peerName[0]?.toUpperCase() ?? "?"}
              </Text>
            )}
          </View>
          <View style={styles.info}>
            <Text style={[styles.peerName, { color: colors.text }]}>
              {peerName}
            </Text>
            <View style={styles.statusRow}>
              <MaterialCommunityIcons
                name={statusIconName}
                size={14}
                color={iconColor}
                style={{ marginRight: 6 }}
              />
              <Text
                style={[styles.statusText, { color: colors.textSecondary }]}
              >
                {isOutgoing ? "Efetuada" : "Recebida"} • {formattedDate}
                {item.duration > 0 && ` • ${formatDuration(item.duration)}`}
              </Text>
            </View>
          </View>
        </View>
        {isSelectionMode ? (
          <View style={styles.selectionIndicator}>
            {isSelected ? (
              <View
                style={[
                  styles.selectedCircle,
                  { backgroundColor: colors.tint },
                ]}
              >
                <View style={styles.selectedCircleInner} />
              </View>
            ) : (
              <View
                style={[
                  styles.unselectedCircle,
                  { borderColor: colors.textSecondary },
                ]}
              />
            )}
          </View>
        ) : (
          <TouchableOpacity
            style={[styles.callButton, { backgroundColor: colors.surface }]}
            onPress={() => handleCallBack(peerId, peerName, peerAvatarUrl)}
          >
            <MaterialCommunityIcons
              name="phone"
              size={18}
              color={colors.tint}
            />
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={[styles.loading, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.tint} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {isSelectionMode ? (
        <View
          style={[styles.headerContainer, { borderBottomColor: colors.border }]}
        >
          <TouchableOpacity
            onPress={() => setSelectedCallIds([])}
            style={styles.headerButton}
          >
            <MaterialCommunityIcons
              name="arrow-left"
              size={24}
              color={colors.text}
            />
          </TouchableOpacity>
          <Text style={[styles.headerTitleSelection, { color: colors.text }]}>
            {selectedCallIds.length} selecionadas
          </Text>
          <TouchableOpacity
            onPress={handleDeleteSelectedPrompt}
            style={styles.headerButton}
          >
            <MaterialCommunityIcons
              name="delete-outline"
              size={24}
              color={colors.headerText}
            />
          </TouchableOpacity>
        </View>
      ) : (
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          Ligações
        </Text>
      )}
      {calls.length === 0 ? (
        <View style={styles.empty}>
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            Nenhuma ligação recente
          </Text>
        </View>
      ) : (
        <FlatList
          data={calls}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={{ paddingBottom: 100 }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 40,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "400",
    paddingHorizontal: 20,
    marginVertical: 10,
  },
  loading: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  callItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  leftContainer: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
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
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  avatarText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  info: {
    flex: 1,
  },
  peerName: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 4,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  statusText: {
    fontSize: 12,
  },
  callButton: {
    padding: 10,
    borderRadius: 20,
    marginLeft: 12,
  },
  empty: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
  },
  emptyText: {
    fontSize: 16,
  },
  headerContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    marginVertical: 10,
    height: 56,
  },
  headerButton: {
    padding: 8,
  },
  headerTitleSelection: {
    fontSize: 20,
    fontWeight: "600",
    flex: 1,
    marginLeft: 16,
  },
  selectionIndicator: {
    padding: 10,
    marginLeft: 12,
  },
  selectedCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: "center",
    alignItems: "center",
  },
  selectedCircleInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#ffffff",
  },
  unselectedCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
  },
});
