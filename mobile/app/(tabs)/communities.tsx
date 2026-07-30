import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Alert,
  Share,
} from "react-native";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useAppTheme } from "@/context/ThemeContext";
import { useAuth } from "@/context/AuthContext";
import {
  communityApi,
  Community,
  CommunityChannel,
  CommunityPost,
  CreateCommunityPayload,
  CreateChannelPayload,
  CreateEventPayload,
} from "@/services/communityApi";

// Modals
import {
  CreateCommunityModal,
  JoinCommunityModal,
  CreateChannelModal,
  CreatePostModal,
  CreateEventModal,
} from "@/components/communities/Modals";
import { PostDetailModal } from "@/components/communities/PostDetailModal";

// Views
import { CommunityChatView } from "@/components/communities/CommunityChatView";
import { CommunityPostsView } from "@/components/communities/CommunityPostsView";
import { CommunityEventsView } from "@/components/communities/CommunityEventsView";

export default function CommunitiesScreen() {
  const { colors, isDark } = useAppTheme();
  const { token, user } = useAuth();

  const [communities, setCommunities] = useState<Community[]>([]);
  const [selectedCommunity, setSelectedCommunity] = useState<Community | null>(
    null,
  );
  const [channels, setChannels] = useState<CommunityChannel[]>([]);
  const [selectedChannel, setSelectedChannel] =
    useState<CommunityChannel | null>(null);
  const [loading, setLoading] = useState(true);

  // Active view states
  const [activeChannelView, setActiveChannelView] = useState<
    "list" | "chat" | "posts" | "events"
  >("list");

  // Modals state
  const [showCreateCommunity, setShowCreateCommunity] = useState(false);
  const [showJoinCommunity, setShowJoinCommunity] = useState(false);
  const [showCreateChannel, setShowCreateChannel] = useState(false);
  const [showCreatePost, setShowCreatePost] = useState(false);
  const [showCreateEvent, setShowCreateEvent] = useState(false);

  // Post detail modal state
  const [selectedPost, setSelectedPost] = useState<CommunityPost | null>(null);

  // Load communities
  useEffect(() => {
    const loadCommunities = async () => {
      if (!token) return;
      setLoading(true);
      try {
        const data = await communityApi.listCommunities(token);
        setCommunities(data);
        if (data.length > 0) {
          setSelectedCommunity(data[0]);
        } else {
          setSelectedCommunity(null);
        }
      } catch (err) {
        console.warn("Failed to load communities", err);
      } finally {
        setLoading(false);
      }
    };
    loadCommunities();
  }, [token]);

  // Load channels when selected community changes
  useEffect(() => {
    if (!token || !selectedCommunity) {
      setChannels([]);
      setSelectedChannel(null);
      setActiveChannelView("list");
      return;
    }

    const loadChannels = async () => {
      if (!token || !selectedCommunity) return;
      try {
        const data = await communityApi.listChannels(
          token,
          selectedCommunity.id,
        );
        setChannels(data);
      } catch (err) {
        console.warn("Failed to load channels", err);
      }
    };
    loadChannels();
  }, [token, selectedCommunity]);

  // View state handlers
  const handleSelectChannel = (channel: CommunityChannel) => {
    setSelectedChannel(channel);
    setActiveChannelView("chat");
  };

  const handleCreateCommunitySubmit = async (
    payload: CreateCommunityPayload,
  ) => {
    if (!token) return;
    try {
      const newComm = await communityApi.createCommunity(token, payload);
      setCommunities((prev) => [...prev, newComm]);
      setSelectedCommunity(newComm);
      setShowCreateCommunity(false);
      Alert.alert("Sucesso", "Comunidade criada com sucesso!");
    } catch (err: any) {
      Alert.alert(
        "Erro",
        err?.message || "Não foi possível criar a comunidade.",
      );
    }
  };

  const handleJoinCommunitySubmit = async (code: string) => {
    if (!token) return;
    try {
      const comm = await communityApi.joinCommunity(token, code);
      setCommunities((prev) => {
        if (prev.some((c) => c.id === comm.id)) return prev;
        return [...prev, comm];
      });
      setSelectedCommunity(comm);
      setShowJoinCommunity(false);
      Alert.alert("Sucesso", "Você entrou na comunidade!");
    } catch (err: any) {
      Alert.alert("Erro", err?.message || "Não foi possível entrar.");
    }
  };

  const handleCreateChannelSubmit = async (payload: CreateChannelPayload) => {
    if (!token || !selectedCommunity) return;
    try {
      const newChan = await communityApi.createChannel(
        token,
        selectedCommunity.id,
        payload,
      );
      setChannels((prev) => [...prev, newChan]);
      setShowCreateChannel(false);
      Alert.alert("Sucesso", "Canal criado!");
    } catch (err: any) {
      Alert.alert("Erro", err?.message || "Erro ao criar canal.");
    }
  };

  const handleCreatePostSubmit = async (title: string, content: string) => {
    if (!token || !selectedCommunity) return;
    try {
      await communityApi.createPost(token, selectedCommunity.id, {
        title,
        content,
      });
      setShowCreatePost(false);
      Alert.alert("Sucesso", "Post criado!");
    } catch (err: any) {
      Alert.alert("Erro", err?.message || "Erro ao criar post.");
    }
  };

  const handleCreateEventSubmit = async (payload: CreateEventPayload) => {
    if (!token || !selectedCommunity) return;
    try {
      await communityApi.createEvent(token, selectedCommunity.id, payload);
      setShowCreateEvent(false);
      Alert.alert("Sucesso", "Evento criado!");
    } catch (err: any) {
      Alert.alert("Erro", err?.message || "Erro ao criar evento.");
    }
  };

  const handleShareInvite = () => {
    if (!selectedCommunity) return;
    const inviteLink = `zapi://join?code=${selectedCommunity.invite_code}`;
    Share.share({
      message: `Entre na minha comunidade "${selectedCommunity.name}" no Zapi! Use o código: ${selectedCommunity.invite_code}\nOu clique no link: ${inviteLink}`,
    });
  };

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.brandGreen} />
      </View>
    );
  }

  if (activeChannelView === "chat") {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <CommunityChatView
          token={token!}
          currentUser={user!}
          communityId={selectedCommunity!.id}
          channel={selectedChannel!}
          onBack={() => setActiveChannelView("list")}
        />
      </View>
    );
  }

  if (activeChannelView === "posts") {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <CommunityPostsView
          token={token!}
          currentUser={user!}
          communityId={selectedCommunity!.id}
          onBack={() => setActiveChannelView("list")}
          onCreatePostClick={() => setShowCreatePost(true)}
          onPostClick={(post) => setSelectedPost(post)}
        />
        <CreatePostModal
          visible={showCreatePost}
          onClose={() => setShowCreatePost(false)}
          onSubmit={handleCreatePostSubmit}
        />
        {selectedPost && (
          <PostDetailModal
            visible={!!selectedPost}
            post={selectedPost}
            token={token!}
            currentUser={user!}
            onClose={() => setSelectedPost(null)}
          />
        )}
      </View>
    );
  }

  if (activeChannelView === "events") {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <CommunityEventsView
          token={token!}
          currentUser={user!}
          communityId={selectedCommunity!.id}
          channel={selectedChannel}
          onBack={() => setActiveChannelView("list")}
          onCreateEventClick={() => setShowCreateEvent(true)}
        />
      </View>
    );
  }

  const textChans = channels.filter((c) => c.type === "text");
  const forumChans = channels.filter((c) => c.type === "forum");
  const eventChans = channels.filter((c) => c.type === "event");

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View
        style={[
          styles.appHeader,
          { backgroundColor: colors.headerBackground },
        ]}
      >
        <Text
          style={[
            styles.appTitle,
            { color: isDark ? colors.headerText : colors.tint },
          ]}
        >
          Comunidades
        </Text>
        <View style={styles.headerButtons}>
          <TouchableOpacity
            style={[styles.headerBtn, { backgroundColor: colors.background }]}
            onPress={() => setShowJoinCommunity(true)}
          >
            <MaterialCommunityIcons
              name="compass"
              size={20}
              color={colors.brandGreen}
            />
            <Text style={[styles.headerBtnText, { color: colors.text }]}>
              Entrar
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.headerBtn, { backgroundColor: colors.brandGreen }]}
            onPress={() => setShowCreateCommunity(true)}
          >
            <MaterialCommunityIcons name="plus" size={20} color="#fff" />
            <Text style={[styles.headerBtnText, { color: "#fff" }]}>Criar</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Communities Horizontal List */}
      <View
        style={[
          styles.commBar,
          { borderBottomColor: colors.border, backgroundColor: colors.surface },
        ]}
      >
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}
        >
          {communities.map((comm) => {
            const isSelected = selectedCommunity?.id === comm.id;
            return (
              <TouchableOpacity
                key={comm.id}
                onPress={() => setSelectedCommunity(comm)}
                style={[
                  styles.commCircle,
                  {
                    borderColor: isSelected ? colors.brandGreen : colors.border,
                    backgroundColor: colors.background,
                  },
                ]}
              >
                {comm.icon_url ? (
                  <Image
                    source={{ uri: comm.icon_url }}
                    style={styles.commIcon}
                  />
                ) : (
                  <Text
                    style={[
                      styles.commInitial,
                      { color: isSelected ? colors.brandGreen : colors.text },
                    ]}
                  >
                    {comm.name.substring(0, 2).toUpperCase()}
                  </Text>
                )}
                {isSelected && (
                  <View
                    style={[
                      styles.dotIndicator,
                      { backgroundColor: colors.brandGreen },
                    ]}
                  />
                )}
              </TouchableOpacity>
            );
          })}
          {communities.length === 0 && !loading && (
            <View style={styles.emptyBar}>
              <Text
                style={[styles.emptyBarText, { color: colors.textSecondary }]}
              >
                Crie ou entre em uma comunidade para começar!
              </Text>
            </View>
          )}
        </ScrollView>
      </View>

      {/* Active Community Workspace */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.brandGreen} />
        </View>
      ) : selectedCommunity ? (
        <ScrollView
          style={styles.workspace}
          contentContainerStyle={{ paddingBottom: 32 }}
        >
          {/* Banner & Name */}
          <View
            style={[styles.bannerContainer, { backgroundColor: colors.border }]}
          >
            {selectedCommunity.banner_url ? (
              <Image
                source={{ uri: selectedCommunity.banner_url }}
                style={styles.bannerImg}
              />
            ) : (
              <View
                style={[
                  styles.bannerDefault,
                  { backgroundColor: colors.brandGreen + "15" },
                ]}
              >
                <MaterialCommunityIcons
                  name="account-group"
                  size={48}
                  color={colors.brandGreen}
                  style={{ opacity: 0.3 }}
                />
              </View>
            )}
            <View style={styles.bannerOverlay}>
              <View style={styles.bannerMeta}>
                {selectedCommunity.visibility === "private" ? (
                  <MaterialCommunityIcons name="lock" size={12} color="#fff" />
                ) : (
                  <MaterialCommunityIcons name="earth" size={12} color="#fff" />
                )}
                <Text style={styles.bannerMetaText}>
                  {selectedCommunity.category || "Geral"}
                </Text>
              </View>
              <Text style={styles.bannerName}>{selectedCommunity.name}</Text>
              <Text style={styles.bannerStats}>
                {selectedCommunity.member_count}{" "}
                {selectedCommunity.member_count === 1 ? "membro" : "membros"}
              </Text>
            </View>
          </View>

          {/* Description & Action Cards */}
          <View style={styles.detailsContainer}>
            {selectedCommunity.description ? (
              <Text style={[styles.commDesc, { color: colors.textSecondary }]}>
                {selectedCommunity.description}
              </Text>
            ) : null}

            <View style={styles.actionRow}>
              <TouchableOpacity
                onPress={handleShareInvite}
                style={[
                  styles.actionCard,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                  },
                ]}
              >
                <MaterialCommunityIcons
                  name="share-variant"
                  size={20}
                  color={colors.brandGreen}
                />
                <Text style={[styles.actionCardText, { color: colors.text }]}>
                  Convidar Amigos
                </Text>
              </TouchableOpacity>

              {selectedCommunity.owner_id === user?.user_id && (
                <TouchableOpacity
                  onPress={() => setShowCreateChannel(true)}
                  style={[
                    styles.actionCard,
                    {
                      backgroundColor: colors.surface,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <MaterialCommunityIcons
                    name="plus-circle"
                    size={20}
                    color={colors.brandGreen}
                  />
                  <Text style={[styles.actionCardText, { color: colors.text }]}>
                    Criar Canal
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Channels Group */}
          <View style={styles.channelsGroup}>
            {/* TEXT CHANNELS */}
            {textChans.length > 0 && (
              <View style={styles.categoryBlock}>
                <Text
                  style={[
                    styles.categoryHeader,
                    { color: colors.textSecondary },
                  ]}
                >
                  CANAIS DE TEXTO
                </Text>
                {textChans.map((chan) => (
                  <TouchableOpacity
                    key={chan.id}
                    onPress={() => handleSelectChannel(chan)}
                    style={[
                      styles.channelRow,
                      { borderBottomColor: colors.border },
                    ]}
                  >
                    <MaterialCommunityIcons
                      name="pound"
                      size={18}
                      color={colors.textSecondary}
                      style={{ marginRight: 10 }}
                    />
                    <View style={{ flex: 1 }}>
                      <Text
                        style={[styles.channelLabel, { color: colors.text }]}
                      >
                        {chan.name}
                      </Text>
                      {chan.description ? (
                        <Text
                          style={[
                            styles.channelSubLabel,
                            { color: colors.textSecondary },
                          ]}
                          numberOfLines={1}
                        >
                          {chan.description}
                        </Text>
                      ) : null}
                    </View>
                    <MaterialCommunityIcons
                      name="chevron-right"
                      size={16}
                      color={colors.textSecondary}
                    />
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* FORUM CHANNELS */}
            {forumChans.length > 0 && (
              <View style={styles.categoryBlock}>
                <Text
                  style={[
                    styles.categoryHeader,
                    { color: colors.textSecondary },
                  ]}
                >
                  FÓRUNS DE DISCUSSÃO
                </Text>
                {forumChans.map((chan) => (
                  <TouchableOpacity
                    key={chan.id}
                    onPress={() => handleSelectChannel(chan)}
                    style={[
                      styles.channelRow,
                      { borderBottomColor: colors.border },
                    ]}
                  >
                    <MaterialCommunityIcons
                      name="forum-outline"
                      size={18}
                      color={colors.textSecondary}
                      style={{ marginRight: 10 }}
                    />
                    <View style={{ flex: 1 }}>
                      <Text
                        style={[styles.channelLabel, { color: colors.text }]}
                      >
                        {chan.name}
                      </Text>
                      {chan.description ? (
                        <Text
                          style={[
                            styles.channelSubLabel,
                            { color: colors.textSecondary },
                          ]}
                          numberOfLines={1}
                        >
                          {chan.description}
                        </Text>
                      ) : null}
                    </View>
                    <MaterialCommunityIcons
                      name="chevron-right"
                      size={16}
                      color={colors.textSecondary}
                    />
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* EVENT CHANNELS */}
            {eventChans.length > 0 && (
              <View style={styles.categoryBlock}>
                <Text
                  style={[
                    styles.categoryHeader,
                    { color: colors.textSecondary },
                  ]}
                >
                  CANAIS DE EVENTOS
                </Text>
                {eventChans.map((chan) => (
                  <TouchableOpacity
                    key={chan.id}
                    onPress={() => handleSelectChannel(chan)}
                    style={[
                      styles.channelRow,
                      { borderBottomColor: colors.border },
                    ]}
                  >
                    <MaterialCommunityIcons
                      name="calendar"
                      size={18}
                      color={colors.textSecondary}
                      style={{ marginRight: 10 }}
                    />
                    <View style={{ flex: 1 }}>
                      <Text
                        style={[styles.channelLabel, { color: colors.text }]}
                      >
                        {chan.name}
                      </Text>
                      {chan.description ? (
                        <Text
                          style={[
                            styles.channelSubLabel,
                            { color: colors.textSecondary },
                          ]}
                          numberOfLines={1}
                        >
                          {chan.description}
                        </Text>
                      ) : null}
                    </View>
                    <MaterialCommunityIcons
                      name="chevron-right"
                      size={16}
                      color={colors.textSecondary}
                    />
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {channels.length === 0 && (
              <View style={[styles.noChannels, { borderColor: colors.border }]}>
                <MaterialCommunityIcons
                  name="pound"
                  size={36}
                  color={colors.textSecondary}
                  style={{ marginBottom: 8 }}
                />
                <Text style={[styles.noChannelsTitle, { color: colors.text }]}>
                  Nenhum canal neste workspace
                </Text>
                {selectedCommunity.owner_id === user?.user_id ? (
                  <TouchableOpacity
                    onPress={() => setShowCreateChannel(true)}
                    style={[
                      styles.noChannelsBtn,
                      { backgroundColor: colors.brandGreen },
                    ]}
                  >
                    <Text style={{ color: "#fff", fontWeight: "bold" }}>
                      Criar Canal
                    </Text>
                  </TouchableOpacity>
                ) : (
                  <Text
                    style={[
                      styles.noChannelsDesc,
                      { color: colors.textSecondary },
                    ]}
                  >
                    Aguarde o administrador criar os canais.
                  </Text>
                )}
              </View>
            )}
          </View>
        </ScrollView>
      ) : (
        <View style={styles.center}>
          <MaterialCommunityIcons
            name="account-group"
            size={64}
            color={colors.textSecondary}
            style={{ marginBottom: 16 }}
          />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>
            Você não faz parte de nenhuma comunidade
          </Text>
          <Text style={[styles.emptyDesc, { color: colors.textSecondary }]}>
            Participe de comunidades do Zapi para debater assuntos, participar
            de eventos ou crie a sua própria comunidade!
          </Text>
          <View style={styles.emptyButtons}>
            <TouchableOpacity
              onPress={() => setShowJoinCommunity(true)}
              style={[
                styles.emptyBtn,
                { borderColor: colors.brandGreen, borderWidth: 1 },
              ]}
            >
              <Text style={{ color: colors.brandGreen, fontWeight: "bold" }}>
                Entrar com Código
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setShowCreateCommunity(true)}
              style={[styles.emptyBtn, { backgroundColor: colors.brandGreen }]}
            >
              <Text style={{ color: "#fff", fontWeight: "bold" }}>
                Criar Nova Comunidade
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* MODALS */}
      <CreateCommunityModal
        visible={showCreateCommunity}
        onClose={() => setShowCreateCommunity(false)}
        onSubmit={handleCreateCommunitySubmit}
      />
      <JoinCommunityModal
        visible={showJoinCommunity}
        onClose={() => setShowJoinCommunity(false)}
        onSubmit={handleJoinCommunitySubmit}
      />
      <CreateChannelModal
        visible={showCreateChannel}
        onClose={() => setShowCreateChannel(false)}
        onSubmit={handleCreateChannelSubmit}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  appHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 16,
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  appTitle: {
    fontSize: 22,
    fontWeight: "500",
  },
  headerButtons: {
    flexDirection: "row",
    gap: 8,
  },
  headerBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 4,
  },
  headerBtnText: {
    fontSize: 13,
    fontWeight: "bold",
  },
  commBar: {
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  commCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    position: "relative",
  },
  commIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  commInitial: {
    fontSize: 16,
    fontWeight: "bold",
  },
  dotIndicator: {
    position: "absolute",
    bottom: -4,
    width: 8,
    height: 8,
    borderRadius: 4,
    alignSelf: "center",
  },
  emptyBar: {
    justifyContent: "center",
    paddingLeft: 4,
  },
  emptyBarText: {
    fontSize: 13,
  },
  workspace: {
    flex: 1,
  },
  bannerContainer: {
    height: 180,
    position: "relative",
    overflow: "hidden",
  },
  bannerImg: {
    width: "100%",
    height: "100%",
  },
  bannerDefault: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  bannerOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
  },
  bannerMeta: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    gap: 4,
    marginBottom: 6,
  },
  bannerMetaText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "bold",
  },
  bannerName: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#fff",
  },
  bannerStats: {
    fontSize: 12,
    color: "rgba(255, 255, 255, 0.8)",
    marginTop: 2,
  },
  detailsContainer: {
    padding: 16,
  },
  commDesc: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
  actionRow: {
    flexDirection: "row",
    gap: 12,
  },
  actionCard: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 10,
    gap: 6,
  },
  actionCardText: {
    fontSize: 13,
    fontWeight: "600",
  },
  channelsGroup: {
    paddingHorizontal: 16,
    gap: 20,
  },
  categoryBlock: {
    gap: 4,
  },
  categoryHeader: {
    fontSize: 11,
    fontWeight: "bold",
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  channelRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  channelLabel: {
    fontSize: 15,
    fontWeight: "600",
  },
  channelSubLabel: {
    fontSize: 12,
    marginTop: 2,
  },
  noChannels: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderStyle: "dashed",
    borderRadius: 12,
    padding: 24,
    marginTop: 12,
  },
  noChannelsTitle: {
    fontSize: 15,
    fontWeight: "bold",
    marginBottom: 4,
  },
  noChannelsDesc: {
    fontSize: 12,
    textAlign: "center",
  },
  noChannelsBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    marginTop: 10,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 8,
  },
  emptyDesc: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 20,
  },
  emptyButtons: {
    width: "100%",
    gap: 12,
  },
  emptyBtn: {
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
});
