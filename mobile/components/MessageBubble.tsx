import React, { useState } from "react";
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Linking,
  Modal,
  TouchableWithoutFeedback,
  Platform,
  ActivityIndicator,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  FileText as FileIcon,
  Play as PlayIcon,
  Clock,
  Check,
  CheckCheck,
  AlertCircle,
  Ban,
  ArrowLeft,
} from "lucide-react-native";
import { type Message, API_URL, createChat } from "../services/api";
import { AudioPlayer } from "./AudioPlayer";
import { useAppTheme } from "@/context/ThemeContext";
import { useVideoPlayer, VideoView } from "expo-video";
import { useRouter } from "expo-router";
import { useAuth } from "@/context/AuthContext";
import {
  parseForwardContent,
  getForwardPreviewText,
} from "@/utils/forwardMessage";

interface MessageBubbleProps {
  item: Message;
  currentUserId?: string;
  isGroup?: boolean;
}

const isImageUrl = (url: string) =>
  /\.(jpg|jpeg|png|gif|webp)(\?.*)?$/i.test(url);
const isAudioUrl = (url: string) =>
  /\.(m4a|mp3|wav|caf|ogg|3gp|opus)(\?.*)?$/i.test(url);
const isVideoUrl = (url: string) =>
  /\.(mp4|mov|webm|mkv|avi)(\?.*)?$/i.test(url);

const formatFileSize = (bytes: number | null | undefined): string => {
  if (bytes === null || bytes === undefined || bytes === 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(1)} MB`;
};

interface MessageVideoProps {
  uri: string;
  isFullScreen: boolean;
}

const MessageVideo: React.FC<MessageVideoProps> = ({ uri, isFullScreen }) => {
  const player = useVideoPlayer(uri, (playerInstance) => {
    playerInstance.loop = false;
    if (isFullScreen) {
      playerInstance.play();
    } else {
      playerInstance.pause();
    }
  });

  return (
    <VideoView
      player={player}
      style={isFullScreen ? styles.fullVideo : styles.messageVideo}
      contentFit={isFullScreen ? "contain" : "cover"}
      nativeControls={isFullScreen}
    />
  );
};

export const MessageBubble: React.FC<MessageBubbleProps> = ({
  item,
  currentUserId,
  isGroup,
}) => {
  const { colors, isDark } = useAppTheme();
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [loadingChat, setLoadingChat] = useState(false);
  const router = useRouter();
  const { token } = useAuth();
  
  const isMine = item.sender_id === currentUserId;

  let isContactShare = false;
  let contactShareData: { contact_id: string; username: string; avatar_url?: string | null } | null = null;
  const forwardContent = parseForwardContent(item.content);

  if (item.content && !forwardContent) {
    try {
      const parsed = JSON.parse(item.content);
      if (parsed && parsed.type === "contact_share") {
        isContactShare = true;
        contactShareData = parsed;
      }
    } catch {
      // not JSON or not contact share
    }
  }

  const handleStartChat = async () => {
    if (!token || !contactShareData) return;
    setLoadingChat(true);
    try {
      const data = await createChat(token, contactShareData.contact_id);
      router.push({
        pathname: "/chat",
        params: {
          chatId: data.id,
          participantId: contactShareData.contact_id,
          participantUsername: contactShareData.username,
          participantAvatarUrl: contactShareData.avatar_url || "",
        },
      });
    } catch (err: any) {
      Alert.alert("Erro", err.message || "Não foi possível abrir o chat.");
    } finally {
      setLoadingChat(false);
    }
  };

  const attachment =
    item.attachments && item.attachments.length > 0
      ? item.attachments[0]
      : null;
  const fileSize = attachment ? attachment.size : null;
  const fileSizeStr = formatFileSize(fileSize);

  // Use local_file_path if available to bypass network entirely
  const mediaUrl = item.local_file_path || item.image_url;
  const fullUrl = mediaUrl
    ? mediaUrl.startsWith("http") || mediaUrl.startsWith("file://")
      ? mediaUrl
      : `${API_URL}${mediaUrl.startsWith("/") ? "" : "/"}${mediaUrl}`
    : null;

  const isImage = attachment ? attachment.type === "image" : (mediaUrl ? (isImageUrl(mediaUrl) && !mediaUrl.toLowerCase().includes("audio")) : false);
  const isAudio = attachment ? attachment.type === "audio" : (mediaUrl ? (isAudioUrl(mediaUrl) || mediaUrl.toLowerCase().includes("audio")) : false);
  const isVideo = attachment ? attachment.type === "video" : (mediaUrl ? (isVideoUrl(mediaUrl) && !mediaUrl.toLowerCase().includes("audio")) : false);

  if (item.deleted_for_everyone) {
    const deletedColor = isMine
      ? "rgba(255, 255, 255, 0.8)"
      : colors.textSecondary;

    return (
      <View
        style={[
          styles.messageBubble,
          isMine
            ? [styles.myMessage, { backgroundColor: colors.tint }]
            : [styles.theirMessage, { backgroundColor: colors.surface }],
          styles.deletedBubble,
          { borderColor: colors.border },
        ]}
      >
        <View style={styles.deletedTextContainer}>
          <Ban size={14} color={deletedColor} style={{ marginRight: 4 }} />
          <Text
            style={[
              styles.deletedText,
              isMine
                ? styles.myMessageDeletedText
                : [styles.messageDeletedText, { color: colors.textSecondary }],
            ]}
          >
            Esta mensagem foi apagada
          </Text>
        </View>
        <Text
          style={[
            styles.messageTime,
            { marginTop: 4 },
            isMine
              ? styles.myMessageTime
              : [styles.theirMessageTime, { color: colors.textSecondary }],
          ]}
        >
          {new Date(item.created_at).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </Text>
      </View>
    );
  }

  const renderStatusIcons = () => (
    <View style={styles.statusIconContainer}>
      {(item.status === "pending" ||
        item.status === "uploading" ||
        item.status === "sending") && (
        <Clock size={13} color="rgba(255,255,255,0.7)" />
      )}
      {(item.status === "failed" ||
        item.status === "privacy_messages_nobody" ||
        item.status === "privacy_messages_contacts" ||
        item.status === "chat_blocked") && (
        <AlertCircle size={13} color="#FF3B30" />
      )}
      {item.status === "sent" && (
        <Check size={14} color="rgba(255,255,255,0.8)" />
      )}
      {item.status === "delivered" && (
        <CheckCheck size={14} color="rgba(255,255,255,0.8)" />
      )}
      {item.status === "read" && <CheckCheck size={14} color="#34B7F1" />}
      {!item.status && (
        <CheckCheck size={14} color="rgba(255,255,255,0.8)" />
      )}
    </View>
  );

  if (forwardContent) {
    const forwarded = forwardContent.forwarded;
    const forwardMediaUrl =
      forwarded.local_file_path || forwarded.image_url;
    const forwardFullUrl = forwardMediaUrl
      ? forwardMediaUrl.startsWith("http") || forwardMediaUrl.startsWith("file://")
        ? forwardMediaUrl
        : `${API_URL}${forwardMediaUrl.startsWith("/") ? "" : "/"}${forwardMediaUrl}`
      : null;
    const showForwardImage =
      forwardFullUrl &&
      (forwarded.attachment_type === "image" ||
        isImageUrl(forwardMediaUrl || ""));

    return (
      <View style={{ alignSelf: isMine ? "flex-end" : "flex-start", maxWidth: "75%", marginBottom: 8 }}>
        <View
          style={[
            styles.messageBubble,
            isMine
              ? [styles.myMessage, { backgroundColor: colors.tint }]
              : [styles.theirMessage, { backgroundColor: colors.surface }],
            { marginBottom: 0 }
          ]}
        >
        {isGroup && !isMine && item.sender_username ? (
          <Text style={[styles.senderUsername, { color: colors.tint }]}>
            {item.sender_username}
          </Text>
        ) : null}

        <View
          style={[
            styles.forwardBox,
            {
              borderLeftColor: isMine ? "#fff" : colors.tint,
              backgroundColor: isMine
                ? "rgba(255, 255, 255, 0.15)"
                : isDark
                  ? "rgba(0, 0, 0, 0.2)"
                  : "rgba(0, 0, 0, 0.05)",
            },
          ]}
        >
          <Text
            style={[
              styles.forwardLabel,
              { color: isMine ? "rgba(255,255,255,0.85)" : colors.tint },
            ]}
          >
            Encaminhada
          </Text>
          <Text
            style={[
              styles.forwardSender,
              { color: isMine ? "#fff" : colors.text },
            ]}
            numberOfLines={1}
          >
            {forwarded.sender_username}
          </Text>
          {showForwardImage ? (
            <Image
              source={{ uri: forwardFullUrl }}
              style={styles.forwardImage}
              resizeMode="cover"
            />
          ) : null}
          <Text
            style={[
              styles.forwardText,
              {
                color: isMine
                  ? "rgba(255,255,255,0.9)"
                  : colors.textSecondary,
              },
            ]}
            numberOfLines={3}
          >
            {getForwardPreviewText(forwarded)}
          </Text>
        </View>

        {forwardContent.text ? (
          <Text
            style={
              isMine
                ? [styles.myMessageText, styles.forwardNewText]
                : [styles.messageText, styles.forwardNewText, { color: colors.text }]
            }
          >
            {forwardContent.text}
          </Text>
        ) : null}

        <View style={styles.timeContainer}>
          <Text
            style={[
              styles.messageTime,
              isMine
                ? styles.myMessageTime
                : [styles.theirMessageTime, { color: colors.textSecondary }],
            ]}
          >
            {new Date(item.created_at).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </Text>
          {isMine ? renderStatusIcons() : null}
        </View>
      </View>
    </View>
    );
  }

  if (isContactShare && contactShareData) {
    const currentAvatarUrl = contactShareData.avatar_url;
    const avatarUri = currentAvatarUrl
      ? (currentAvatarUrl.startsWith("http")
        ? currentAvatarUrl
        : `${API_URL}${currentAvatarUrl.startsWith("/") ? "" : "/"}${currentAvatarUrl}`)
      : null;

    const nameInitial = contactShareData.username[0]?.toUpperCase() || "?";
    
    return (
      <View style={{ alignSelf: isMine ? "flex-end" : "flex-start", maxWidth: "75%", marginBottom: 8 }}>
        <View
          style={[
            styles.messageBubble,
            isMine
              ? [styles.myMessage, { backgroundColor: colors.tint }]
              : [styles.theirMessage, { backgroundColor: colors.surface }],
            styles.contactShareCard,
            { borderColor: colors.border, marginBottom: 0 }
          ]}
        >
        {isGroup && !isMine && item.sender_username ? (
          <Text style={[styles.senderUsername, { color: colors.tint, marginBottom: 8 }]}>
            {item.sender_username}
          </Text>
        ) : null}
        <View style={styles.contactShareHeader}>
          <View style={[styles.contactShareAvatar, { backgroundColor: isMine ? "rgba(255, 255, 255, 0.2)" : (isDark ? "#2C2C2E" : "#E5E5EA") }]}>
            {avatarUri ? (
              <Image source={{ uri: avatarUri }} style={styles.contactShareAvatarImage} />
            ) : (
              <Text style={[styles.contactShareAvatarText, { color: isMine ? "#fff" : colors.text }]}>
                {nameInitial}
              </Text>
            )}
          </View>
          <View style={styles.contactShareInfo}>
            <Text style={[styles.contactShareName, { color: isMine ? "#fff" : colors.text }]} numberOfLines={1}>
              {contactShareData.username}
            </Text>
          </View>
        </View>
        
        <TouchableOpacity
          style={[
            styles.contactShareButton,
            {
              backgroundColor: isMine ? "#fff" : colors.tint,
              marginTop: 12,
            }
          ]}
          onPress={handleStartChat}
          disabled={loadingChat}
          activeOpacity={0.8}
        >
          {loadingChat ? (
            <ActivityIndicator size="small" color={isMine ? colors.tint : "#fff"} />
          ) : (
            <Text style={[styles.contactShareButtonText, { color: isMine ? colors.tint : "#fff" }]}>
              Conversar
            </Text>
          )}
        </TouchableOpacity>

        <View style={styles.timeContainer}>
          <Text
            style={[
              styles.messageTime,
              isMine
                ? styles.myMessageTime
                : [styles.theirMessageTime, { color: colors.textSecondary }],
            ]}
          >
            {new Date(item.created_at).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </Text>
          {isMine && (
            <View style={styles.statusIconContainer}>
              {(item.status === "pending" ||
                item.status === "uploading" ||
                item.status === "sending") && (
                <Clock size={13} color="rgba(255,255,255,0.7)" />
              )}
              {(item.status === "failed" ||
                item.status === "privacy_messages_nobody" ||
                item.status === "privacy_messages_contacts" ||
                item.status === "chat_blocked") && (
                <AlertCircle size={13} color="#FF3B30" />
              )}
              {item.status === "sent" && (
                <Check size={14} color="rgba(255,255,255,0.8)" />
              )}
              {item.status === "delivered" && (
                <CheckCheck size={14} color="rgba(255,255,255,0.8)" />
              )}
              {item.status === "read" && <CheckCheck size={14} color="#34B7F1" />}
              {!item.status && (
                <CheckCheck size={14} color="rgba(255,255,255,0.8)" />
              )}
            </View>
          )}
        </View>
      </View>
    </View>
    );
  }

  return (
    <View style={{ alignSelf: isMine ? "flex-end" : "flex-start", maxWidth: "75%", marginBottom: 8 }}>
      <View
        style={[
          styles.messageBubble,
          isMine
            ? [styles.myMessage, { backgroundColor: colors.tint }]
            : [styles.theirMessage, { backgroundColor: colors.surface }],
          { marginBottom: 0 }
        ]}
      >
      {isGroup && !isMine && item.sender_username ? (
        <Text style={[styles.senderUsername, { color: colors.tint }]}>
          {item.sender_username}
        </Text>
      ) : null}
      {fullUrl && (
        <>
          {isImage ? (
            <TouchableOpacity
              onPress={() => setIsFullScreen(true)}
              activeOpacity={0.9}
            >
              <Image
                source={{ uri: fullUrl }}
                style={styles.messageImage}
                resizeMode="cover"
              />
            </TouchableOpacity>
          ) : isAudio ? (
            <AudioPlayer uri={fullUrl} isMine={isMine} />
          ) : isVideo ? (
            <TouchableOpacity
              style={styles.videoContainer}
              onPress={() => setIsFullScreen(true)}
              activeOpacity={0.9}
            >
              <MessageVideo uri={fullUrl} isFullScreen={false} />
              <View style={styles.videoPlayOverlay}>
                <PlayIcon size={32} color="#fff" fill="#fff" />
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
                color={isMine ? "#fff" : colors.text}
                style={{ marginRight: 10 }}
              />
              <View style={styles.docInfo}>
                <Text
                  numberOfLines={1}
                  style={[
                    styles.docName,
                    isMine
                      ? styles.docNameMine
                      : [styles.docNameTheir, { color: colors.text }],
                  ]}
                >
                  {(() => {
                    const rawFileName = mediaUrl!.split("/").pop() || "";
                    const match = rawFileName.match(
                      /^[^_]+_[0-9a-fA-F\-]{36}_(.+)$/,
                    );
                    if (match) return match[1];
                    const oldMatch = rawFileName.match(
                      /^[^_]+_([0-9a-fA-F\-]{36}\..+)$/,
                    );
                    return oldMatch ? oldMatch[1] : rawFileName;
                  })()}
                </Text>
                <Text
                  style={[
                    styles.docSubtitle,
                    isMine
                      ? styles.docSubMine
                      : [styles.docSubTheir, { color: colors.textSecondary }],
                  ]}
                >
                  {fileSizeStr
                    ? `${fileSizeStr} • Tap to open`
                    : "Tap to open document"}
                </Text>
              </View>
            </TouchableOpacity>
          )}
        </>
      )}
      {item.content && !(mediaUrl && isAudioUrl(mediaUrl)) ? (
        <Text
          style={
            isMine
              ? styles.myMessageText
              : [styles.messageText, { color: colors.text }]
          }
        >
          {item.content}
        </Text>
      ) : null}

      <View style={styles.timeContainer}>
        <Text
          style={[
            styles.messageTime,
            isMine
              ? styles.myMessageTime
              : [styles.theirMessageTime, { color: colors.textSecondary }],
          ]}
        >
          {new Date(item.created_at).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </Text>
        {isMine && (
          <View style={styles.statusIconContainer}>
            {(item.status === "pending" ||
              item.status === "uploading" ||
              item.status === "sending") && (
              <Clock size={13} color="rgba(255,255,255,0.7)" />
            )}
            {(item.status === "failed" ||
              item.status === "privacy_messages_nobody" ||
              item.status === "privacy_messages_contacts" ||
              item.status === "chat_blocked") && (
              <AlertCircle size={13} color="#FF3B30" />
            )}
            {item.status === "sent" && (
              <Check size={14} color="rgba(255,255,255,0.8)" />
            )}
            {item.status === "delivered" && (
              <CheckCheck size={14} color="rgba(255,255,255,0.8)" />
            )}
            {item.status === "read" && <CheckCheck size={14} color="#34B7F1" />}
            {!item.status && (
              <CheckCheck size={14} color="rgba(255,255,255,0.8)" />
            )}
          </View>
        )}
      </View>

      {fullUrl && isImage && (
        <Modal
          visible={isFullScreen}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setIsFullScreen(false)}
        >
          <TouchableWithoutFeedback onPress={() => setIsFullScreen(false)}>
            <View style={styles.modalBackground}>
              <SafeAreaView style={styles.modalSafeArea}>
                <TouchableOpacity
                  style={styles.closeButton}
                  onPress={() => setIsFullScreen(false)}
                  activeOpacity={0.7}
                >
                  <ArrowLeft size={24} color="#fff" />
                </TouchableOpacity>
                <TouchableWithoutFeedback>
                  <View style={styles.imageContainer}>
                    <Image
                      source={{ uri: fullUrl }}
                      style={styles.fullImage}
                      resizeMode="contain"
                    />
                  </View>
                </TouchableWithoutFeedback>
              </SafeAreaView>
            </View>
          </TouchableWithoutFeedback>
        </Modal>
      )}
      {fullUrl && isVideo && isFullScreen && (
        <Modal
          visible={isFullScreen}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setIsFullScreen(false)}
        >
          <TouchableWithoutFeedback onPress={() => setIsFullScreen(false)}>
            <View style={styles.modalBackground}>
              <SafeAreaView style={styles.modalSafeArea}>
                <TouchableOpacity
                  style={styles.closeButton}
                  onPress={() => setIsFullScreen(false)}
                  activeOpacity={0.7}
                >
                  <ArrowLeft size={24} color="#fff" />
                </TouchableOpacity>
                <TouchableWithoutFeedback>
                  <View style={styles.videoContainerFull}>
                    <MessageVideo uri={fullUrl} isFullScreen={true} />
                  </View>
                </TouchableWithoutFeedback>
              </SafeAreaView>
            </View>
          </TouchableWithoutFeedback>
        </Modal>
      )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  senderUsername: {
    fontSize: 12,
    fontWeight: "bold",
    marginBottom: 4,
  },
  messageBubble: {
    maxWidth: "100%",
    padding: 12,
    borderRadius: 16,
  },
  myMessage: {
    alignSelf: "flex-end",
    borderBottomRightRadius: 4,
  },
  theirMessage: {
    alignSelf: "flex-start",
    borderBottomLeftRadius: 4,
  },
  messageImage: {
    width: 200,
    height: 200,
    borderRadius: 12,
    marginBottom: 4,
  },
  messageText: { fontSize: 16 },
  myMessageText: { fontSize: 16, color: "#fff" },
  messageTime: { fontSize: 11, lineHeight: 14, includeFontPadding: false },
  myMessageTime: { color: "rgba(255,255,255,0.7)", textAlign: "right" },
  theirMessageTime: {},
  videoContainer: {
    width: 200,
    height: 200,
    borderRadius: 12,
    overflow: "hidden",
    marginBottom: 4,
    position: "relative",
    backgroundColor: "#000",
  },
  messageVideo: {
    width: "100%",
    height: "100%",
  },
  videoPlayOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.3)",
    justifyContent: "center",
    alignItems: "center",
  },
  videoContainerFull: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  fullVideo: {
    width: "100%",
    height: "100%",
  },
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
  docNameTheir: {},
  docSubtitle: { fontSize: 11, marginTop: 2 },
  docSubMine: { color: "rgba(255, 255, 255, 0.7)" },
  docSubTheir: {},
  deletedTextContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  deletedBubble: {
    borderStyle: "dashed",
    borderWidth: 1,
    opacity: 0.8,
  },
  deletedText: {
    fontStyle: "italic",
    fontSize: 14,
  },
  myMessageDeletedText: {
    color: "rgba(255, 255, 255, 0.8)",
  },
  messageDeletedText: {},
  modalBackground: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.95)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalSafeArea: {
    flex: 1,
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  closeButton: {
    position: "absolute",
    top: Platform.OS === "ios" ? 20 : 40,
    left: 20,
    zIndex: 10,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    padding: 10,
    borderRadius: 25,
  },
  imageContainer: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  fullImage: {
    width: "100%",
    height: "100%",
  },
  timeContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    alignSelf: "flex-end",
    marginTop: 4,
  },
  statusIconContainer: {
    marginLeft: 4,
    justifyContent: "center",
    alignItems: "center",
  },
  contactShareCard: {
    borderWidth: 1,
    padding: 12,
    borderRadius: 16,
    width: 220,
  },
  contactShareHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  contactShareAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
    overflow: "hidden",
  },
  contactShareAvatarImage: {
    width: "100%",
    height: "100%",
  },
  contactShareAvatarText: {
    fontSize: 18,
    fontWeight: "bold",
  },
  contactShareInfo: {
    flex: 1,
  },
  contactShareLabel: {
    fontSize: 10,
    fontWeight: "600",
    textTransform: "uppercase",
  },
  contactShareName: {
    fontSize: 16,
    fontWeight: "bold",
    marginTop: 2,
  },
  contactShareButton: {
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  contactShareButtonText: {
    fontSize: 14,
    fontWeight: "bold",
  },
  forwardBox: {
    borderLeftWidth: 3,
    borderRadius: 8,
    padding: 8,
    marginBottom: 6,
  },
  forwardLabel: {
    fontSize: 11,
    fontWeight: "600",
    marginBottom: 2,
  },
  forwardSender: {
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 4,
  },
  forwardText: {
    fontSize: 13,
  },
  forwardImage: {
    width: "100%",
    height: 80,
    borderRadius: 6,
    marginBottom: 4,
  },
  forwardNewText: {
    marginTop: 2,
  },
});
