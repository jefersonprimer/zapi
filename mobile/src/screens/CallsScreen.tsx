import { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { Phone, PhoneIncoming, PhoneOutgoing, PhoneMissed, PhoneOff } from "lucide-react-native";
import { useAuth } from "../context/AuthContext";
import { getCallHistory, type CallHistoryItem } from "../services/callApi";
import { voiceCallManager } from "../services/voiceCallManager";
import { useNavigation } from "@react-navigation/native";

export default function CallsScreen() {
  const { token, user } = useAuth();
  const [calls, setCalls] = useState<CallHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const navigation = useNavigation<any>();

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

  useEffect(() => {
    fetchCalls();
  }, [fetchCalls]);

  useEffect(() => {
    const unsubscribe = navigation.addListener("focus", fetchCalls);
    return unsubscribe;
  }, [navigation, fetchCalls]);

  const handleCallBack = (userId: string, username: string) => {
    voiceCallManager.startCall(userId, username);
  };

  const renderItem = ({ item }: { item: CallHistoryItem }) => {
    const isOutgoing = item.caller_id === user?.user_id;
    const peerName = isOutgoing ? item.callee_username : item.caller_username;
    const peerId = isOutgoing ? item.callee_id : item.caller_id;

    if (!peerName) return null;

    let StatusIcon = PhoneIncoming;
    let iconColor = "#34C759"; // Green

    if (isOutgoing) {
      StatusIcon = PhoneOutgoing;
    }

    if (item.status === "missed" || item.status === "rejected" || item.status === "busy") {
      StatusIcon = PhoneMissed;
      iconColor = "#FF3B30"; // Red
    } else if (item.status === "failed") {
      StatusIcon = PhoneOff;
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

    return (
      <View style={styles.callItem}>
        <View style={styles.leftContainer}>
          <View style={[styles.avatar, { backgroundColor: isOutgoing ? "#007AFF" : "#34C759" }]}>
            <Text style={styles.avatarText}>{peerName[0]?.toUpperCase() ?? "?"}</Text>
          </View>
          <View style={styles.info}>
            <Text style={styles.peerName}>{peerName}</Text>
            <View style={styles.statusRow}>
              <StatusIcon size={14} color={iconColor} style={{ marginRight: 6 }} />
              <Text style={styles.statusText}>
                {isOutgoing ? "Efetuada" : "Recebida"} • {formattedDate}
                {item.duration > 0 && ` • ${formatDuration(item.duration)}`}
              </Text>
            </View>
          </View>
        </View>
        <TouchableOpacity
          style={styles.callButton}
          onPress={() => handleCallBack(peerId, peerName)}
        >
          <Phone size={18} color="#007AFF" />
        </TouchableOpacity>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.headerTitle}>Ligações</Text>
      {calls.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>Nenhuma ligação recente</Text>
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
    backgroundColor: "#fff",
    paddingTop: 20,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#333",
    paddingHorizontal: 16,
    marginVertical: 16,
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
    borderBottomColor: "#eee",
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
    color: "#333",
    marginBottom: 4,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  statusText: {
    fontSize: 12,
    color: "#8e8e93",
  },
  callButton: {
    padding: 10,
    borderRadius: 20,
    backgroundColor: "#f2f2f7",
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
    color: "#8e8e93",
  },
});
