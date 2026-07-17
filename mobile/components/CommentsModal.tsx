import { useState, useEffect, useCallback } from "react";
import {
  View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from "react-native";
import { X, Heart, Send } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppTheme } from "@/context/ThemeContext";
import { useAuth } from "@/context/AuthContext";
import * as updatesApi from "@/services/updatesApi";
import type { Comment } from "@/services/updatesApi";

interface CommentsModalProps {
  postId: string;
  visible: boolean;
  onClose: () => void;
}

export default function CommentsModal({ postId, visible, onClose }: CommentsModalProps) {
  const { colors } = useAppTheme();
  const { token } = useAuth();
  const insets = useSafeAreaInsets();
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState<{ id: string; name: string } | null>(null);

  const fetchComments = useCallback(async () => {
    if (!token) return;
    try {
      const data = await updatesApi.getComments(token, postId);
      setComments(data);
    } catch (err) {
      console.error("Failed to load comments:", err);
    } finally {
      setLoading(false);
    }
  }, [token, postId]);

  useEffect(() => {
    if (visible && token) {
      setLoading(true);
      fetchComments();
      setReplyTo(null);
    }
  }, [visible, token, fetchComments]);

  const handleSend = async () => {
    if (!token || !text.trim()) return;
    const content = text.trim();
    setText("");
    try {
      const data: any = { content };
      if (replyTo) data.parent_id = replyTo.id;
      await updatesApi.addComment(token, postId, data);
      setReplyTo(null);
      await fetchComments();
    } catch (err) {
      console.error("Failed to add comment:", err);
    }
  };

  const handleLike = async (commentId: string) => {
    if (!token) return;
    try {
      await updatesApi.toggleCommentLike(token, postId, commentId);
      setComments((prev) =>
        prev.map((c) => {
          if (c.id === commentId) {
            return { ...c, liked_by_me: !c.liked_by_me, likes_count: c.liked_by_me ? c.likes_count - 1 : c.likes_count + 1 };
          }
          return {
            ...c,
            replies: c.replies.map((r) =>
              r.id === commentId
                ? { ...r, liked_by_me: !r.liked_by_me, likes_count: r.liked_by_me ? r.likes_count - 1 : r.likes_count + 1 }
                : r
            ),
          };
        })
      );
    } catch {}
  };

  if (!visible) return null;

  const renderComment = ({ item }: { item: Comment }) => (
    <View style={styles.commentContainer}>
      <View style={styles.commentMain}>
        <View style={styles.commentContent}>
          <Text style={[styles.commentUser, { color: colors.text }]}>{item.user_name}</Text>
          <Text style={[styles.commentText, { color: colors.text }]}>{item.content}</Text>
        </View>
        <View style={styles.commentActions}>
          <TouchableOpacity
            onPress={() => setReplyTo({ id: item.id, name: item.user_name })}
          >
            <Text style={[styles.replyBtn, { color: colors.textSecondary }]}>Responder</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => handleLike(item.id)} style={styles.likeBtn}>
            <Heart
              size={14}
              color={item.liked_by_me ? (colors.danger) : colors.icon}
              fill={item.liked_by_me ? colors.danger : "transparent"}
            />
            {item.likes_count > 0 && (
              <Text style={[styles.likeCount, { color: colors.textSecondary }]}>{item.likes_count}</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Replies */}
      {item.replies.map((reply) => (
        <View key={reply.id} style={styles.replyContainer}>
          <View style={styles.replyLine} />
          <View style={styles.replyContent}>
            <Text style={[styles.commentUser, { color: colors.text }]}>{reply.user_name}</Text>
            <Text style={[styles.commentText, { color: colors.text }]}>{reply.content}</Text>
            <View style={styles.commentActions}>
              <TouchableOpacity
                onPress={() => setReplyTo({ id: reply.id, name: reply.user_name })}
              >
                <Text style={[styles.replyBtn, { color: colors.textSecondary }]}>Responder</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleLike(reply.id)} style={styles.likeBtn}>
                <Heart
                  size={14}
                  color={reply.liked_by_me ? colors.danger : colors.icon}
                  fill={reply.liked_by_me ? colors.danger : "transparent"}
                />
                {reply.likes_count > 0 && (
                  <Text style={[styles.likeCount, { color: colors.textSecondary }]}>{reply.likes_count}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      ))}
    </View>
  );

  return (
    <View style={[styles.overlay, { backgroundColor: colors.modalOverlay }]}>
      <TouchableOpacity style={styles.overlayClose} onPress={onClose} />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={[styles.modal, { backgroundColor: colors.surface, paddingBottom: insets.bottom }]}
      >
        <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
          <Text style={[styles.modalTitle, { color: colors.text }]}>Comentários</Text>
          <TouchableOpacity onPress={onClose}>
            <X size={22} color={colors.text} />
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="small" color={colors.tint} />
          </View>
        ) : (
          <FlatList
            data={comments}
            keyExtractor={(item) => item.id}
            renderItem={renderComment}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              <View style={styles.center}>
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                  Nenhum comentário ainda
                </Text>
              </View>
            }
          />
        )}

        {replyTo && (
          <View style={[styles.replyBar, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
            <Text style={[styles.replyBarText, { color: colors.textSecondary }]}>
              Respondendo para {replyTo.name}
            </Text>
            <TouchableOpacity onPress={() => setReplyTo(null)}>
              <X size={16} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
        )}

        <View style={[styles.inputBar, { borderTopColor: colors.border }]}>
          <TextInput
            style={[styles.input, { color: colors.text, backgroundColor: colors.background }]}
            placeholder="Escreva um comentário..."
            placeholderTextColor={colors.textSecondary}
            value={text}
            onChangeText={setText}
            multiline
          />
          <TouchableOpacity onPress={handleSend} disabled={!text.trim()}>
            <Send size={20} color={text.trim() ? colors.tint : colors.icon} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: "flex-end" },
  overlayClose: { flex: 1 },
  modal: { maxHeight: "80%", borderTopLeftRadius: 16, borderTopRightRadius: 16 },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  modalTitle: { fontSize: 17, fontWeight: "600" },
  center: { padding: 32, alignItems: "center" },
  emptyText: { fontSize: 14 },
  listContent: { padding: 16 },
  commentContainer: { marginBottom: 16 },
  commentMain: {},
  commentContent: { marginBottom: 4 },
  commentUser: { fontSize: 13, fontWeight: "600", marginBottom: 2 },
  commentText: { fontSize: 14, lineHeight: 20 },
  commentActions: { flexDirection: "row", alignItems: "center", gap: 16, marginTop: 4 },
  replyBtn: { fontSize: 13 },
  likeBtn: { flexDirection: "row", alignItems: "center", gap: 2 },
  likeCount: { fontSize: 12 },
  replyContainer: { flexDirection: "row", marginTop: 8, marginLeft: 16 },
  replyLine: { width: 2, backgroundColor: "#D1D5DB", marginRight: 12 },
  replyContent: { flex: 1 },
  replyBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  replyBarText: { fontSize: 13 },
  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    padding: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  input: {
    flex: 1,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    fontSize: 14,
    maxHeight: 80,
  },
});
