import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Image,
} from "react-native";
import { MessageSquare, Plus, ArrowLeft } from "lucide-react-native";
import { useAppTheme } from "@/context/ThemeContext";
import { communityApi, CommunityPost, CommunityChannel } from "@/services/communityApi";

interface CommunityPostsViewProps {
  token: string;
  communityId: string;
  channel: CommunityChannel;
  onBack: () => void;
  onSelectPost: (post: CommunityPost) => void;
  onCreatePostClick: () => void;
}

export function CommunityPostsView({
  token,
  communityId,
  channel,
  onBack,
  onSelectPost,
  onCreatePostClick,
}: CommunityPostsViewProps) {
  const { colors } = useAppTheme();
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchPosts = useCallback(async () => {
    try {
      const data = await communityApi.listPosts(token, communityId, channel.id);
      // Sort by created_at descending
      const sorted = data.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setPosts(sorted);
    } catch (err) {
      console.warn(err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token, communityId, channel.id]);

  useEffect(() => {
    setLoading(true);
    fetchPosts();
  }, [channel.id, fetchPosts]);

  const formatDate = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString([], { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
    } catch {
      return "";
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border, backgroundColor: colors.surface }]}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <ArrowLeft size={24} color={colors.text} />
        </TouchableOpacity>
        <MessageSquare size={20} color={colors.brandGreen} style={{ marginRight: 6 }} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.channelName, { color: colors.text }]} numberOfLines={1}>
            {channel.name}
          </Text>
          <Text style={[styles.channelDesc, { color: colors.textSecondary }]} numberOfLines={1}>
            Fórum de Discussões
          </Text>
        </View>
        <TouchableOpacity
          onPress={onCreatePostClick}
          style={[styles.createBtn, { backgroundColor: colors.brandGreen }]}
        >
          <Plus size={16} color="#fff" />
          <Text style={styles.createBtnText}>Novo Post</Text>
        </TouchableOpacity>
      </View>

      {/* Post List */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.brandGreen} />
        </View>
      ) : posts.length === 0 ? (
        <View style={styles.center}>
          <MessageSquare size={48} color={colors.textSecondary} style={{ marginBottom: 12 }} />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>Nenhum post ainda</Text>
          <Text style={[styles.emptyDesc, { color: colors.textSecondary }]}>Seja o primeiro a publicar alguma coisa neste fórum!</Text>
          <TouchableOpacity
            onPress={onCreatePostClick}
            style={[styles.emptyBtn, { backgroundColor: colors.brandGreen }]}
          >
            <Text style={{ color: "#fff", fontWeight: "bold" }}>Criar Tópico</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchPosts(); }} tintColor={colors.brandGreen} />
          }
          contentContainerStyle={{ padding: 16, gap: 16 }}
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() => onSelectPost(item)}
              style={[styles.postCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              <View style={styles.cardHeader}>
                <View style={[styles.avatar, { backgroundColor: colors.background }]}>
                  {item.author_avatar_url ? (
                    <Image source={{ uri: item.author_avatar_url }} style={styles.avatarImg} />
                  ) : (
                    <Text style={[styles.avatarText, { color: colors.textSecondary }]}>
                      {(item.author_username || "U").substring(0, 1).toUpperCase()}
                    </Text>
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.authorName, { color: colors.text }]}>{item.author_username || "Membro"}</Text>
                  <Text style={[styles.postDate, { color: colors.textSecondary }]}>{formatDate(item.created_at)}</Text>
                </View>
              </View>

              <Text style={[styles.postTitle, { color: colors.text }]}>{item.title}</Text>
              <Text style={[styles.postExcerpt, { color: colors.textSecondary }]} numberOfLines={3}>
                {item.content}
              </Text>

              <View style={[styles.cardFooter, { borderTopColor: colors.border }]}>
                <View style={styles.footerStat}>
                  <MessageSquare size={16} color={colors.textSecondary} />
                  <Text style={[styles.footerStatText, { color: colors.textSecondary }]}>
                    {item.comment_count} {item.comment_count === 1 ? "Comentário" : "Comentários"}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          )}
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
  postCard: {
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
    gap: 10,
    marginBottom: 12,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatarImg: {
    width: 36,
    height: 36,
  },
  avatarText: {
    fontSize: 14,
    fontWeight: "bold",
  },
  authorName: {
    fontSize: 14,
    fontWeight: "bold",
  },
  postDate: {
    fontSize: 11,
  },
  postTitle: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 6,
  },
  postExcerpt: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 14,
  },
  cardFooter: {
    flexDirection: "row",
    borderTopWidth: 1,
    paddingTop: 12,
    marginTop: 4,
  },
  footerStat: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  footerStatText: {
    fontSize: 13,
  },
});
