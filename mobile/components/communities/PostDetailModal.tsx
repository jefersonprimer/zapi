import React, { useState, useEffect } from "react";
import {
  Modal,
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Image,
  SafeAreaView,
} from "react-native";
import { X, Send, MessageSquare } from "lucide-react-native";
import { useAppTheme } from "@/context/ThemeContext";
import { communityApi, CommunityPost, CommunityComment } from "@/services/communityApi";

interface PostDetailModalProps {
  visible: boolean;
  onClose: () => void;
  post: CommunityPost | null;
  token: string;
  communityId: string;
}

export function PostDetailModal({ visible, onClose, post, token, communityId }: PostDetailModalProps) {
  const { colors } = useAppTheme();
  const [comments, setComments] = useState<CommunityComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [commentText, setCommentText] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (visible && post) {
      setLoading(true);
      communityApi
        .listComments(token, communityId, post.id)
        .then((data) => {
          // Sort comments by created_at ascending
          const sorted = data.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
          setComments(sorted);
        })
        .catch(console.warn)
        .finally(() => setLoading(false));
    }
  }, [visible, post, token, communityId]);

  if (!post) return null;

  const handleSendComment = async () => {
    if (!commentText.trim() || sending) return;
    setSending(true);
    const content = commentText;
    setCommentText("");
    try {
      const newComment = await communityApi.createComment(token, communityId, post.id, content);
      setComments((prev) => [...prev, newComment]);
      // Update post comment count locally
      post.comment_count += 1;
    } catch (err) {
      console.warn("Failed to create comment", err);
    } finally {
      setSending(false);
    }
  };

  const formatDate = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString([], { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
    } catch {
      return "";
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: colors.border, backgroundColor: colors.surface }]}>
          <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
            Post de {post.author_username}
          </Text>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <X size={24} color={colors.text} />
          </TouchableOpacity>
        </View>

        {/* Comment/Post List */}
        <FlatList
          data={comments}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: 24 }}
          ListHeaderComponent={
            <View style={[styles.postDetail, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
              <View style={styles.authorRow}>
                <View style={[styles.avatar, { backgroundColor: colors.background }]}>
                  {post.author_avatar_url ? (
                    <Image source={{ uri: post.author_avatar_url }} style={styles.avatarImg} />
                  ) : (
                    <Text style={[styles.avatarText, { color: colors.textSecondary }]}>
                      {(post.author_username || "U").substring(0, 1).toUpperCase()}
                    </Text>
                  )}
                </View>
                <View>
                  <Text style={[styles.authorName, { color: colors.text }]}>{post.author_username || "Membro"}</Text>
                  <Text style={[styles.postDate, { color: colors.textSecondary }]}>{formatDate(post.created_at)}</Text>
                </View>
              </View>
              <Text style={[styles.postTitle, { color: colors.text }]}>{post.title}</Text>
              <Text style={[styles.postContent, { color: colors.text }]}>{post.content}</Text>

              <View style={[styles.divider, { backgroundColor: colors.border }]} />
              <Text style={[styles.commentsHeader, { color: colors.text }]}>
                Respostas ({comments.length})
              </Text>
            </View>
          }
          ListEmptyComponent={
            loading ? (
              <View style={styles.center}>
                <ActivityIndicator size="small" color={colors.brandGreen} />
              </View>
            ) : (
              <View style={styles.center}>
                <MessageSquare size={36} color={colors.textSecondary} style={{ marginBottom: 8 }} />
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Nenhum comentário ainda.</Text>
              </View>
            )
          }
          renderItem={({ item }) => (
            <View style={[styles.commentRow, { borderBottomColor: colors.border }]}>
              <View style={[styles.avatarMini, { backgroundColor: colors.border }]}>
                {item.author_avatar_url ? (
                  <Image source={{ uri: item.author_avatar_url }} style={styles.avatarImgMini} />
                ) : (
                  <Text style={[styles.avatarTextMini, { color: colors.textSecondary }]}>
                    {(item.author_username || "U").substring(0, 1).toUpperCase()}
                  </Text>
                )}
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.commentMeta}>
                  <Text style={[styles.commentAuthor, { color: colors.text }]}>{item.author_username || "Membro"}</Text>
                  <Text style={[styles.commentTime, { color: colors.textSecondary }]}>{formatDate(item.created_at)}</Text>
                </View>
                <Text style={[styles.commentText, { color: colors.text }]}>{item.content}</Text>
              </View>
            </View>
          )}
        />

        {/* Comment Input */}
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <View style={[styles.inputContainer, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
            <TextInput
              value={commentText}
              onChangeText={setCommentText}
              placeholder="Escreva um comentário..."
              placeholderTextColor={colors.textSecondary}
              style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
              multiline
            />
            <TouchableOpacity
              onPress={handleSendComment}
              disabled={!commentText.trim() || sending}
              style={[styles.sendBtn, { backgroundColor: commentText.trim() ? colors.brandGreen : colors.border }]}
            >
              {sending ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Send size={18} color="#fff" />
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: "bold",
    flex: 1,
  },
  closeBtn: {
    padding: 4,
  },
  postDetail: {
    padding: 16,
    borderBottomWidth: 1,
    marginBottom: 8,
  },
  authorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 16,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatarImg: {
    width: 44,
    height: 44,
  },
  avatarText: {
    fontSize: 16,
    fontWeight: "bold",
  },
  authorName: {
    fontSize: 15,
    fontWeight: "bold",
  },
  postDate: {
    fontSize: 12,
    marginTop: 2,
  },
  postTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 12,
    lineHeight: 26,
  },
  postContent: {
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 16,
  },
  divider: {
    height: 1,
    marginVertical: 16,
  },
  commentsHeader: {
    fontSize: 15,
    fontWeight: "bold",
  },
  commentRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    gap: 10,
  },
  avatarMini: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatarImgMini: {
    width: 32,
    height: 32,
  },
  avatarTextMini: {
    fontSize: 12,
    fontWeight: "bold",
  },
  commentMeta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  commentAuthor: {
    fontSize: 13,
    fontWeight: "bold",
  },
  commentTime: {
    fontSize: 11,
  },
  commentText: {
    fontSize: 14,
    lineHeight: 20,
  },
  center: {
    padding: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: {
    fontSize: 14,
  },
  inputContainer: {
    flexDirection: "row",
    padding: 12,
    borderTopWidth: 1,
    alignItems: "center",
    gap: 8,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    fontSize: 16,
    maxHeight: 100,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
});
