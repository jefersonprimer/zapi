import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  Image,
} from "react-native";
import { Send, ArrowLeft, Hash } from "lucide-react-native";
import { useAppTheme } from "@/context/ThemeContext";
import { communityApi, CommunityMessage, CommunityChannel } from "@/services/communityApi";

interface CommunityChatViewProps {
  token: string;
  communityId: string;
  channel: CommunityChannel;
  onBack: () => void;
  currentUserId: string;
}

export function CommunityChatView({ token, communityId, channel, onBack, currentUserId }: CommunityChatViewProps) {
  const { colors } = useAppTheme();
  const [messages, setMessages] = useState<CommunityMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [content, setContent] = useState("");
  const [sending, setSending] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  const fetchMessages = useCallback(async () => {
    try {
      const data = await communityApi.listMessages(token, communityId, channel.id);
      // Sort messages by created_at ascending
      const sorted = data.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      setMessages(sorted);
    } catch (err) {
      console.warn(err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token, communityId, channel.id]);

  useEffect(() => {
    setLoading(true);
    fetchMessages();
  }, [channel.id, fetchMessages]);

  const handleSend = async () => {
    if (!content.trim() || sending) return;
    setSending(true);
    const textToSend = content;
    setContent("");
    try {
      const newMsg = await communityApi.sendMessage(token, communityId, channel.id, textToSend);
      setMessages((prev) => [...prev, newMsg]);
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    } catch (err) {
      console.warn("Failed to send message", err);
    } finally {
      setSending(false);
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
          <ArrowLeft size={24} color={colors.text} />
        </TouchableOpacity>
        <Hash size={20} color={colors.brandGreen} style={{ marginRight: 6 }} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.channelName, { color: colors.text }]} numberOfLines={1}>
            {channel.name}
          </Text>
          {channel.description ? (
            <Text style={[styles.channelDesc, { color: colors.textSecondary }]} numberOfLines={1}>
              {channel.description}
            </Text>
          ) : null}
        </View>
      </View>

      {/* Message List */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.brandGreen} />
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchMessages(); }} tintColor={colors.brandGreen} />
          }
          contentContainerStyle={{ padding: 16, gap: 12 }}
          renderItem={({ item }) => {
            const isMe = item.sender_id === currentUserId;
            return (
              <View style={[styles.messageRow, isMe ? styles.myMessageRow : styles.otherMessageRow]}>
                {!isMe && (
                  <View style={[styles.avatar, { backgroundColor: colors.border }]}>
                    {item.sender_avatar_url ? (
                      <Image source={{ uri: item.sender_avatar_url }} style={styles.avatarImg} />
                    ) : (
                      <Text style={[styles.avatarText, { color: colors.textSecondary }]}>
                        {(item.sender_username || "U").substring(0, 1).toUpperCase()}
                      </Text>
                    )}
                  </View>
                )}
                <View style={[
                  styles.bubble,
                  {
                    backgroundColor: isMe ? colors.listBgGreen : colors.surface,
                    borderBottomRightRadius: isMe ? 2 : 12,
                    borderBottomLeftRadius: isMe ? 12 : 2,
                    borderColor: colors.border,
                    borderWidth: isMe ? 0 : 1,
                  }
                ]}>
                  {!isMe && (
                    <Text style={[styles.senderName, { color: colors.brandGreen }]}>
                      {item.sender_username || "Membro"}
                    </Text>
                  )}
                  <Text style={[styles.messageText, { color: colors.text }]}>
                    {item.content}
                  </Text>
                  <Text style={[styles.timeText, { color: colors.textSecondary }]}>
                    {formatTime(item.created_at)}
                  </Text>
                </View>
              </View>
            );
          }}
        />
      )}

      {/* Input bar */}
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={90}>
        <View style={[styles.inputContainer, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
          <TextInput
            value={content}
            onChangeText={setContent}
            placeholder={`Conversar em #${channel.name}`}
            placeholderTextColor={colors.textSecondary}
            style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
            multiline
            maxLength={1000}
          />
          <TouchableOpacity
            onPress={handleSend}
            disabled={!content.trim() || sending}
            style={[styles.sendBtn, { backgroundColor: content.trim() ? colors.brandGreen : colors.border }]}
          >
            {sending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Send size={18} color="#fff" />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
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
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  messageRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    maxWidth: "80%",
    gap: 8,
  },
  myMessageRow: {
    alignSelf: "flex-end",
  },
  otherMessageRow: {
    alignSelf: "flex-start",
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatarImg: {
    width: 32,
    height: 32,
  },
  avatarText: {
    fontSize: 14,
    fontWeight: "bold",
  },
  bubble: {
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 1,
    elevation: 1,
  },
  senderName: {
    fontSize: 12,
    fontWeight: "bold",
    marginBottom: 2,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
  },
  timeText: {
    fontSize: 10,
    alignSelf: "flex-end",
    marginTop: 4,
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
