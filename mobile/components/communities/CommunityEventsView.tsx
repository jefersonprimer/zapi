import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAppTheme } from "@/context/ThemeContext";
import { communityApi, CommunityEvent, CommunityChannel, EventRsvpStatus } from "@/services/communityApi";

interface CommunityEventsViewProps {
  token: string;
  communityId: string;
  channel: CommunityChannel;
  onBack: () => void;
  onCreateEventClick: () => void;
}

export function CommunityEventsView({
  token,
  communityId,
  channel,
  onBack,
  onCreateEventClick,
}: CommunityEventsViewProps) {
  const { colors } = useAppTheme();
  const [events, setEvents] = useState<CommunityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [rsvpLoadingId, setRsvpLoadingId] = useState<string | null>(null);

  const fetchEvents = useCallback(async () => {
    try {
      const data = await communityApi.listEvents(token, communityId);
      // Sort by start_time ascending
      const sorted = data.sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
      setEvents(sorted);
    } catch (err) {
      console.warn(err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token, communityId]);

  useEffect(() => {
    setLoading(true);
    fetchEvents();
  }, [channel.id, fetchEvents]);

  const handleRsvp = async (eventId: string, status: EventRsvpStatus) => {
    setRsvpLoadingId(eventId);
    try {
      const success = await communityApi.rsvpEvent(token, communityId, eventId, status);
      if (success) {
        setEvents((prev) =>
          prev.map((ev) => {
            if (ev.id === eventId) {
              const wasGoing = ev.user_rsvp === "going";
              const isGoing = status === "going";
              const diff = isGoing ? (wasGoing ? 0 : 1) : (wasGoing ? -1 : 0);
              return {
                ...ev,
                user_rsvp: status,
                attendee_count: Math.max(0, ev.attendee_count + diff),
              };
            }
            return ev;
          })
        );
      }
    } catch (err) {
      console.warn("Failed to RSVP", err);
    } finally {
      setRsvpLoadingId(null);
    }
  };

  const formatDate = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString([], { weekday: "short", day: "2-digit", month: "short", year: "numeric" });
    } catch {
      return "";
    }
  };

  const formatTime = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    } catch {
      return "";
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border, backgroundColor: colors.surface }]}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Ionicons name="arrow-back-outline" size={24} color={colors.text} />
        </TouchableOpacity>
        <Ionicons name="calendar-outline" size={20} color={colors.brandGreen} style={{ marginRight: 6 }} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.channelName, { color: colors.text }]} numberOfLines={1}>
            {channel.name}
          </Text>
          <Text style={[styles.channelDesc, { color: colors.textSecondary }]} numberOfLines={1}>
            Próximos Eventos
          </Text>
        </View>
        <TouchableOpacity
          onPress={onCreateEventClick}
          style={[styles.createBtn, { backgroundColor: colors.brandGreen }]}
        >
          <Ionicons name="add-outline" size={16} color="#fff" />
          <Text style={styles.createBtnText}>Criar Evento</Text>
        </TouchableOpacity>
      </View>

      {/* Events List */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.brandGreen} />
        </View>
      ) : events.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="calendar-outline" size={48} color={colors.textSecondary} style={{ marginBottom: 12 }} />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>Nenhum evento agendado</Text>
          <Text style={[styles.emptyDesc, { color: colors.textSecondary }]}>Planeje uma reunião ou evento online com os membros!</Text>
          <TouchableOpacity
            onPress={onCreateEventClick}
            style={[styles.emptyBtn, { backgroundColor: colors.brandGreen }]}
          >
            <Text style={{ color: "#fff", fontWeight: "bold" }}>Criar Evento</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={events}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchEvents(); }} tintColor={colors.brandGreen} />
          }
          contentContainerStyle={{ padding: 16, gap: 16 }}
          renderItem={({ item }) => {
            const isGoing = item.user_rsvp === "going";
            const isInterested = item.user_rsvp === "interested";

            return (
              <View style={[styles.eventCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={styles.cardHeader}>
                  <Ionicons name="calendar-outline" size={24} color={colors.brandGreen} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.eventTitle, { color: colors.text }]}>{item.title}</Text>
                    <Text style={[styles.eventCreator, { color: colors.textSecondary }]}>Criado por {item.creator_username || "Organizador"}</Text>
                  </View>
                </View>

                {item.description ? (
                  <Text style={[styles.eventDesc, { color: colors.text }]}>{item.description}</Text>
                ) : null}

                <View style={styles.detailsList}>
                  <View style={styles.detailRow}>
                    <Ionicons name="time-outline" size={16} color={colors.textSecondary} />
                    <Text style={[styles.detailText, { color: colors.text }]}>
                      {formatDate(item.start_time)} às {formatTime(item.start_time)}
                    </Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Ionicons name="location-outline" size={16} color={colors.textSecondary} />
                    <Text style={[styles.detailText, { color: colors.text }]} numberOfLines={1}>
                      {item.location || "Zapi Voice Lounge"}
                    </Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Ionicons name="people-outline" size={16} color={colors.textSecondary} />
                    <Text style={[styles.detailText, { color: colors.text }]}>
                      {item.attendee_count} {item.attendee_count === 1 ? "confirmado" : "confirmados"}
                    </Text>
                  </View>
                </View>

                {/* RSVP Controls */}
                <View style={[styles.rsvpContainer, { borderTopColor: colors.border }]}>
                  {rsvpLoadingId === item.id ? (
                    <ActivityIndicator size="small" color={colors.brandGreen} style={{ marginVertical: 8 }} />
                  ) : (
                    <>
                      <TouchableOpacity
                        onPress={() => handleRsvp(item.id, "going")}
                        style={[
                          styles.rsvpBtn,
                          { borderColor: colors.border },
                          isGoing && { backgroundColor: colors.brandGreen, borderColor: colors.brandGreen },
                        ]}
                      >
                        <Text style={[styles.rsvpText, { color: isGoing ? "#fff" : colors.text, fontWeight: isGoing ? "bold" : "400" }]}>
                          Vou
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        onPress={() => handleRsvp(item.id, "interested")}
                        style={[
                          styles.rsvpBtn,
                          { borderColor: colors.border },
                          isInterested && { backgroundColor: colors.listBgGreen, borderColor: colors.brandGreen },
                        ]}
                      >
                        <Text style={[styles.rsvpText, { color: isInterested ? colors.brandGreen : colors.text, fontWeight: isInterested ? "bold" : "400" }]}>
                          Tenho Interesse
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        onPress={() => handleRsvp(item.id, "not_going")}
                        style={[
                          styles.rsvpBtn,
                          { borderColor: colors.border },
                          item.user_rsvp === "not_going" && { backgroundColor: colors.background },
                        ]}
                      >
                        <Text style={[styles.rsvpText, { color: colors.textSecondary }]}>
                          Não vou
                        </Text>
                      </TouchableOpacity>
                    </>
                  )}
                </View>
              </View>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backBtn: {
    padding: 6,
    marginRight: 10,
  },
  channelName: {
    fontSize: 16,
    fontWeight: "bold",
  },
  channelDesc: {
    fontSize: 12,
  },
  createBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 4,
  },
  createBtnText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "bold",
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 6,
  },
  emptyDesc: {
    fontSize: 14,
    textAlign: "center",
    marginBottom: 16,
  },
  emptyBtn: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  eventCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
  },
  eventTitle: {
    fontSize: 16,
    fontWeight: "bold",
  },
  eventCreator: {
    fontSize: 12,
    marginTop: 2,
  },
  eventDesc: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },
  detailsList: {
    gap: 8,
    marginBottom: 14,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  detailText: {
    fontSize: 13,
  },
  rsvpContainer: {
    flexDirection: "row",
    borderTopWidth: 1,
    paddingTop: 12,
    gap: 8,
  },
  rsvpBtn: {
    flex: 1,
    borderWidth: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  rsvpText: {
    fontSize: 12,
  },
});
