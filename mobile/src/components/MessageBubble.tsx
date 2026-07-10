import React from "react";
import { View, Text, Image, TouchableOpacity, StyleSheet, Linking } from "react-native";
import { FileText as FileIcon, Video as VideoIcon } from "lucide-react-native";
import { type Message, API_URL } from "../services/api";
import { AudioPlayer } from "./AudioPlayer";

interface MessageBubbleProps {
  item: Message;
  currentUserId?: string;
}

const isImageUrl = (url: string) =>
  /\.(jpg|jpeg|png|gif|webp)(\?.*)?$/i.test(url);
const isAudioUrl = (url: string) =>
  /\.(m4a|mp3|wav|caf|ogg|3gp|opus)(\?.*)?$/i.test(url);
const isVideoUrl = (url: string) =>
  /\.(mp4|mov|webm|mkv|avi)(\?.*)?$/i.test(url);

export const MessageBubble: React.FC<MessageBubbleProps> = ({ item, currentUserId }) => {
  const isMine = item.sender_id === currentUserId;
  const fullUrl = item.image_url
    ? item.image_url.startsWith("http")
      ? item.image_url
      : `${API_URL}${item.image_url}`
    : null;

  return (
    <View
      style={[
        styles.messageBubble,
        isMine ? styles.myMessage : styles.theirMessage,
      ]}
    >
      {fullUrl && (
        <>
          {isImageUrl(item.image_url!) ? (
            <Image
              source={{ uri: fullUrl }}
              style={styles.messageImage}
              resizeMode="cover"
            />
          ) : isAudioUrl(item.image_url!) ? (
            <AudioPlayer uri={fullUrl} isMine={isMine} />
          ) : isVideoUrl(item.image_url!) ? (
            <TouchableOpacity
              style={[
                styles.videoBubble,
                isMine ? styles.videoBubbleMine : styles.videoBubbleTheir,
              ]}
              onPress={() => Linking.openURL(fullUrl)}
            >
              <View style={styles.videoPreview}>
                <VideoIcon
                  size={24}
                  color={isMine ? "#fff" : "#007AFF"}
                  style={{ marginRight: 6 }}
                />
                <Text
                  style={[
                    styles.videoText,
                    isMine ? styles.videoTextMine : styles.videoTextTheir,
                  ]}
                >
                  Play Video
                </Text>
              </View>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[
                styles.docBubble,
                isMine ? styles.docBubbleMine : styles.docBubbleTheir,
              ]}
              onPress={() => Linking.openURL(fullUrl)}
            >
              <FileIcon
                size={24}
                color={isMine ? "#fff" : "#333"}
                style={{ marginRight: 10 }}
              />
              <View style={styles.docInfo}>
                <Text
                  numberOfLines={1}
                  style={[
                    styles.docName,
                    isMine ? styles.docNameMine : styles.docNameTheir,
                  ]}
                >
                  {item.image_url!.split("/").pop()}
                </Text>
                <Text
                  style={[
                    styles.docSubtitle,
                    isMine ? styles.docSubMine : styles.docSubTheir,
                  ]}
                >
                  Tap to open document
                </Text>
              </View>
            </TouchableOpacity>
          )}
        </>
      )}
      {item.content ? (
        <Text style={isMine ? styles.myMessageText : styles.messageText}>
          {item.content}
        </Text>
      ) : null}
      <Text
        style={[
          styles.messageTime,
          isMine ? styles.myMessageTime : styles.theirMessageTime,
        ]}
      >
        {new Date(item.created_at).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        })}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  messageBubble: {
    maxWidth: "75%",
    padding: 12,
    borderRadius: 16,
    marginBottom: 8,
  },
  myMessage: {
    backgroundColor: "#007AFF",
    alignSelf: "flex-end",
    borderBottomRightRadius: 4,
  },
  theirMessage: {
    backgroundColor: "#f1f0f0",
    alignSelf: "flex-start",
    borderBottomLeftRadius: 4,
  },
  messageImage: {
    width: 200,
    height: 200,
    borderRadius: 12,
    marginBottom: 4,
  },
  messageText: { fontSize: 16, color: "#333" },
  myMessageText: { fontSize: 16, color: "#fff" },
  messageTime: { fontSize: 11, marginTop: 4 },
  myMessageTime: { color: "rgba(255,255,255,0.7)", textAlign: "right" },
  theirMessageTime: { color: "#999" },
  videoBubble: {
    padding: 10,
    borderRadius: 12,
    marginBottom: 4,
    maxWidth: 200,
  },
  videoBubbleMine: { backgroundColor: "rgba(255, 255, 255, 0.2)" },
  videoBubbleTheir: { backgroundColor: "rgba(0, 0, 0, 0.05)" },
  videoPreview: { flexDirection: "row", alignItems: "center" },
  videoText: { fontSize: 14, fontWeight: "600" },
  videoTextMine: { color: "#fff" },
  videoTextTheir: { color: "#007AFF" },
  docBubble: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    borderRadius: 12,
    marginBottom: 4,
    maxWidth: 220,
  },
  docBubbleMine: { backgroundColor: "rgba(255, 255, 255, 0.2)" },
  docBubbleTheir: { backgroundColor: "rgba(0, 0, 0, 0.05)" },
  docIcon: { fontSize: 28, marginRight: 10 },
  docInfo: { flex: 1 },
  docName: { fontSize: 14, fontWeight: "600" },
  docNameMine: { color: "#fff" },
  docNameTheir: { color: "#333" },
  docSubtitle: { fontSize: 11, marginTop: 2 },
  docSubMine: { color: "rgba(255, 255, 255, 0.7)" },
  docSubTheir: { color: "#666" },
});
