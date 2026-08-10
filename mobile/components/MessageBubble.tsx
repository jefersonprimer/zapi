import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  Image as RNImage,
  TouchableOpacity,
  StyleSheet,
  Linking,
  Modal,
  TouchableWithoutFeedback,
  Platform,
  ActivityIndicator,
  Alert,
  Clipboard,
} from "react-native";
import { Image } from "expo-image";
import { SafeAreaView } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import { PIX_TYPE_LABELS } from "@/services/pixApi";
import { type Message, API_URL, createChat } from "../services/api";
import { AudioPlayer } from "./AudioPlayer";
import { useAppTheme } from "@/context/ThemeContext";
import { useVideoPlayer, VideoView } from "expo-video";
import { useRouter } from "expo-router";
import { useAuth } from "@/context/AuthContext";
import {
  parseForwardContent,
  extractForwardData,
} from "@/utils/forwardMessage";
import { formatRemainingTime } from "@/utils/date";
import {
  isImageUrl,
  isSvgUrl,
  getYoutubeId,
  isAudioUrl,
  isVideoUrl,
  formatFileSize,
  getFileExtensionLabel,
} from "@/utils/file";
import { UploadProgressLine } from "./UploadProgressLine";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { SvgUri } from "react-native-svg";
import { WebView } from "react-native-webview";

interface MessageBubbleProps {
  item: Message;
  currentUserId?: string;
  isGroup?: boolean;
  onLongPress?: () => void;
  onCreateNote?: () => void;
  onCreateReminder?: () => void;
  onCreateEvent?: () => void;
}

function ScheduledCountdown({ targetTime }: { targetTime: number }) {
  const [timeLeft, setTimeLeft] = useState(
    Math.max(0, Math.round((targetTime - Date.now()) / 1000)),
  );

  useEffect(() => {
    const timer = setInterval(() => {
      const remaining = Math.max(
        0,
        Math.round((targetTime - Date.now()) / 1000),
      );
      setTimeLeft(remaining);
      if (remaining <= 0) {
        clearInterval(timer);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [targetTime]);

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        marginTop: 4,
        opacity: 0.85,
      }}
    >
      <Ionicons
        name="time-outline"
        size={12}
        color="rgba(255,255,255,0.7)"
        style={{ marginRight: 4 }}
      />
      <Text
        style={{
          fontSize: 11,
          color: "rgba(255,255,255,0.9)",
          fontWeight: "600",
        }}
      >
        {formatRemainingTime(timeLeft)}
      </Text>
    </View>
  );
}

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
  onLongPress,
  onCreateNote,
  onCreateReminder,
  onCreateEvent,
}) => {
  const { colors, isDark } = useAppTheme();
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [loadingChat, setLoadingChat] = useState(false);
  const router = useRouter();
  const { token } = useAuth();

  const handleForwardMessage = () => {
    const forwardedData = extractForwardData(item);
    router.push({
      pathname: "/share-contact",
      params: {
        mode: "forward",
        forwardMessages: JSON.stringify([forwardedData]),
      },
    });
  };

  const isMine = item.sender_id === currentUserId;

  let isContactShare = false;
  let contactShareData: {
    contact_id: string;
    username: string;
    avatar_url?: string | null;
  } | null = null;
  let isPixShare = false;
  let pixShareData: {
    pix_type: string;
    pix_value: string;
    full_name: string;
  } | null = null;
  let isNoteShare = false;
  let noteShareData: {
    note_id: string;
    title: string;
    content: string;
  } | null = null;
  let isLocationShare = false;
  let locationShareData: {
    type: "location";
    latitude: number;
    longitude: number;
    name?: string;
    address?: string;
  } | null = null;
  const forwardContent = parseForwardContent(item.content);

  let sharePayload: any = null;
  const shareRaw = forwardContent
    ? forwardContent.forwarded?.content
    : item.content;
  if (shareRaw) {
    try {
      sharePayload = JSON.parse(shareRaw);
    } catch {
      // plain text
    }
  }

  if (sharePayload?.type === "contact_share") {
    isContactShare = true;
    contactShareData = sharePayload;
  } else if (sharePayload?.type === "pix_share") {
    isPixShare = true;
    pixShareData = sharePayload;
  } else if (sharePayload?.type === "note_share") {
    isNoteShare = true;
    noteShareData = sharePayload;
  } else if (sharePayload?.type === "location") {
    isLocationShare = true;
    locationShareData = sharePayload;
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

  const getFileName = (url: string | null | undefined): string => {
    if (!url) return "";
    const rawFileName = url.split("/").pop() || "";
    const match = rawFileName.match(/^[^_]+_[0-9a-fA-F\-]{36}_(.+)$/);
    if (match) return match[1];
    const oldMatch = rawFileName.match(/^[^_]+_([0-9a-fA-F\-]{36}\..+)$/);
    return oldMatch ? oldMatch[1] : rawFileName;
  };

  const isForwarded = !!forwardContent;
  const forwarded = forwardContent?.forwarded;

  const contentIsLink =
    item.content &&
    (item.content.startsWith("http://") || item.content.startsWith("https://"));

  const forwardedContentIsLink = !!(
    forwarded?.content &&
    (forwarded.content.startsWith("http://") ||
      forwarded.content.startsWith("https://"))
  );

  const isUrlMediaOrYoutube = (url: string | null | undefined): boolean => {
    if (!url) return false;
    return (
      isImageUrl(url) ||
      isVideoUrl(url) ||
      isAudioUrl(url) ||
      !!getYoutubeId(url)
    );
  };

  const mediaUrl = isForwarded
    ? forwarded?.local_file_path ||
      forwarded?.image_url ||
      (forwardedContentIsLink && isUrlMediaOrYoutube(forwarded.content)
        ? forwarded.content
        : null)
    : item.local_file_path ||
      item.image_url ||
      (contentIsLink && isUrlMediaOrYoutube(item.content)
        ? item.content
        : null);

  const fullUrl = mediaUrl
    ? mediaUrl.startsWith("http") || mediaUrl.startsWith("file://")
      ? mediaUrl
      : `${API_URL}${mediaUrl.startsWith("/") ? "" : "/"}${mediaUrl}`
    : null;

  const isVideo = isForwarded
    ? forwarded?.attachment_type === "video" ||
      (mediaUrl
        ? isVideoUrl(mediaUrl) && !mediaUrl.toLowerCase().includes("audio")
        : false)
    : attachment
      ? attachment.type === "video" || (mediaUrl ? isVideoUrl(mediaUrl) : false)
      : mediaUrl
        ? isVideoUrl(mediaUrl) && !mediaUrl.toLowerCase().includes("audio")
        : false;

  const isAudio = isForwarded
    ? forwarded?.attachment_type === "audio" ||
      (mediaUrl
        ? isAudioUrl(mediaUrl) || mediaUrl.toLowerCase().includes("audio")
        : false)
    : attachment
      ? attachment.type === "audio"
      : mediaUrl
        ? isAudioUrl(mediaUrl) || mediaUrl.toLowerCase().includes("audio")
        : false;

  const isSvgMedia =
    (mediaUrl ? isSvgUrl(mediaUrl) : false) ||
    attachment?.mime_type === "image/svg+xml";

  const isImage = isForwarded
    ? forwarded?.attachment_type === "image" ||
      (mediaUrl
        ? isImageUrl(mediaUrl) && !mediaUrl.toLowerCase().includes("audio")
        : false)
    : attachment
      ? (attachment.type === "image" ||
          isSvgMedia ||
          (mediaUrl ? isImageUrl(mediaUrl) : false)) &&
        !isVideo
      : mediaUrl
        ? isImageUrl(mediaUrl) && !mediaUrl.toLowerCase().includes("audio")
        : false;

  const isSticker =
    !!mediaUrl &&
    (mediaUrl.toLowerCase().endsWith(".webp") ||
      mediaUrl.toLowerCase().endsWith(".gif") ||
      mediaUrl.toLowerCase().includes("sticker") ||
      mediaUrl.toLowerCase().includes("giphy") ||
      mediaUrl.toLowerCase().includes("tenor") ||
      attachment?.mime_type === "image/webp" ||
      attachment?.mime_type === "image/gif");

  console.log("[MessageBubble] Debug:", {
    msgId: item.id,
    mediaUrl,
    fullUrl,
    isImage,
    isVideo,
    attachmentType: attachment ? attachment.type : null,
    isForwarded,
  });

  const fileSize = isForwarded
    ? (forwarded?.file_size ?? null)
    : attachment
      ? attachment.size
      : null;
  const fileSizeStr = formatFileSize(fileSize);

  const fileName =
    isForwarded && forwarded?.file_name
      ? forwarded.file_name
      : getFileName(mediaUrl);

  const rawContent = isForwarded ? forwarded?.content : item.content;
  const youtubeId = rawContent ? getYoutubeId(rawContent) : null;

  // Structured shares render their own cards — never dump JSON into the bubble text
  const messageContent =
    isNoteShare ||
    isContactShare ||
    isPixShare ||
    isLocationShare ||
    ((contentIsLink || forwardedContentIsLink) &&
      (isImage || isVideo || youtubeId))
      ? null
      : isForwarded
        ? forwarded?.content
        : item.content;
  const commentText = isForwarded ? forwardContent?.text : null;

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
          <Ionicons
            name="ban-outline"
            size={14}
            color={deletedColor}
            style={{ marginRight: 4 }}
          />
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
        item.status === "sending" ||
        item.status === "scheduled") && (
        <Ionicons name="time-outline" size={13} color="rgba(255,255,255,0.7)" />
      )}
      {(item.status === "failed" ||
        item.status === "privacy_messages_nobody" ||
        item.status === "privacy_messages_contacts" ||
        item.status === "chat_blocked") && (
        <Ionicons name="alert-circle-outline" size={13} color="#FF3B30" />
      )}
      {item.status === "sent" && (
        <Ionicons name="checkmark" size={14} color="rgba(255,255,255,0.8)" />
      )}
      {item.status === "delivered" && (
        <Ionicons
          name="checkmark-done"
          size={14}
          color="rgba(255,255,255,0.8)"
        />
      )}
      {item.status === "read" && (
        <Ionicons name="checkmark-done" size={14} color="#34B7F1" />
      )}
      {!item.status && (
        <Ionicons
          name="checkmark-done"
          size={14}
          color="rgba(255,255,255,0.8)"
        />
      )}
    </View>
  );

  // Forward early-return removed to unify layout rendering

  if (isLocationShare && locationShareData) {
    const handleOpenMap = () => {
      const url = `https://www.google.com/maps?q=${locationShareData.latitude},${locationShareData.longitude}`;
      Linking.openURL(url).catch((err) => {
        Alert.alert("Erro", "Não foi possível abrir o mapa.");
      });
    };

    return (
      <View
        style={{
          alignSelf: isMine ? "flex-end" : "flex-start",
          maxWidth: "75%",
          marginBottom: 8,
        }}
      >
        <TouchableOpacity
          style={[
            styles.messageBubble,
            isMine
              ? [styles.myMessage, { backgroundColor: colors.tint }]
              : [styles.theirMessage, { backgroundColor: colors.surface }],
            styles.locationShareCard,
            {
              borderColor: colors.border,
              marginBottom: 0,
              padding: 0,
              overflow: "hidden",
            },
          ]}
          onPress={handleOpenMap}
          onLongPress={onLongPress}
          activeOpacity={0.9}
        >
          {isGroup && !isMine && item.sender_username ? (
            <Text
              style={[
                styles.senderUsername,
                {
                  color: colors.tint,
                  marginTop: 8,
                  marginLeft: 12,
                  marginBottom: 4,
                },
              ]}
            >
              {item.sender_username}
            </Text>
          ) : null}

          <View
            style={{
              width: "100%",
              height: 120,
              backgroundColor: colors.border,
            }}
            pointerEvents="none"
          >
            <WebView
              originWhitelist={["*"]}
              source={{
                html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <style>
    body, html, #map { margin: 0; padding: 0; height: 100%; width: 100%; background: ${isMine ? "#0f4c81" : "#f0f0f0"}; }
    .leaflet-control-attribution { display: none !important; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    var map = L.map('map', {
      zoomControl: false,
      dragging: false,
      touchZoom: false,
      doubleClickZoom: false,
      scrollWheelZoom: false,
      boxZoom: false,
      keyboard: false
    }).setView([${locationShareData.latitude}, ${locationShareData.longitude}], 15);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
    L.marker([${locationShareData.latitude}, ${locationShareData.longitude}]).addTo(map);
  </script>
</body>
</html>
                `,
              }}
              style={{ width: "100%", height: 120 }}
              scrollEnabled={false}
            />
          </View>

          <View style={{ padding: 10 }}>
            <Text
              style={{
                fontWeight: "bold",
                color: isMine ? "#fff" : colors.text,
                fontSize: 14,
              }}
              numberOfLines={1}
            >
              {locationShareData.name || "Localização"}
            </Text>
            {locationShareData.address ? (
              <Text
                style={{
                  color: isMine
                    ? "rgba(255, 255, 255, 0.85)"
                    : colors.textSecondary,
                  fontSize: 12,
                  marginTop: 2,
                }}
                numberOfLines={2}
              >
                {locationShareData.address}
              </Text>
            ) : null}

            <View
              style={{
                flexDirection: "row",
                justifyContent: "flex-end",
                alignItems: "center",
                marginTop: 6,
              }}
            >
              <Text
                style={[
                  styles.messageTime,
                  {
                    color: isMine
                      ? "rgba(255, 255, 255, 0.7)"
                      : colors.textSecondary,
                    fontSize: 10,
                    marginRight: 4,
                  },
                ]}
              >
                {new Date(item.created_at).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </Text>
              {isMine && renderStatusIcons()}
            </View>
          </View>
        </TouchableOpacity>
        {item.reaction && (
          <View
            style={[
              styles.reactionPill,
              {
                backgroundColor: isDark ? "#2C2C2E" : "#FFFFFF",
                borderColor: colors.border,
                alignSelf: "flex-start",
                marginTop: 4,
                marginBottom: 2,
              },
            ]}
          >
            <Text style={styles.reactionPillText}>{item.reaction}</Text>
            <View
              style={[
                styles.reactionTail,
                {
                  borderRightColor: isDark ? "#2C2C2E" : "#FFFFFF",
                },
              ]}
            />
            <View
              style={[
                styles.reactionCircle,
                {
                  backgroundColor: isDark ? "#2C2C2E" : "#FFFFFF",
                  borderColor: colors.border,
                },
              ]}
            />
          </View>
        )}
      </View>
    );
  }

  if (isContactShare && contactShareData) {
    const currentAvatarUrl = contactShareData.avatar_url;
    const avatarUri = currentAvatarUrl
      ? currentAvatarUrl.startsWith("http")
        ? currentAvatarUrl
        : `${API_URL}${currentAvatarUrl.startsWith("/") ? "" : "/"}${currentAvatarUrl}`
      : null;

    const nameInitial = contactShareData.username[0]?.toUpperCase() || "?";

    return (
      <View
        style={{
          alignSelf: isMine ? "flex-end" : "flex-start",
          maxWidth: "75%",
          marginBottom: 8,
        }}
      >
        <TouchableOpacity
          style={[
            styles.messageBubble,
            isMine
              ? [styles.myMessage, { backgroundColor: colors.tint }]
              : [styles.theirMessage, { backgroundColor: colors.surface }],
            styles.contactShareCard,
            { borderColor: colors.border, marginBottom: 0 },
          ]}
          onLongPress={onLongPress}
          activeOpacity={0.95}
        >
          {isGroup && !isMine && item.sender_username ? (
            <Text
              style={[
                styles.senderUsername,
                { color: colors.tint, marginBottom: 8 },
              ]}
            >
              {item.sender_username}
            </Text>
          ) : null}
          <View style={styles.contactShareHeader}>
            <View
              style={[
                styles.contactShareAvatar,
                {
                  backgroundColor: isMine
                    ? "rgba(255, 255, 255, 0.2)"
                    : isDark
                      ? "#2C2C2E"
                      : "#E5E5EA",
                },
              ]}
            >
              {avatarUri ? (
                <RNImage
                  source={{ uri: avatarUri }}
                  style={styles.contactShareAvatarImage}
                />
              ) : (
                <Text
                  style={[
                    styles.contactShareAvatarText,
                    { color: isMine ? "#fff" : colors.text },
                  ]}
                >
                  {nameInitial}
                </Text>
              )}
            </View>
            <View style={styles.contactShareInfo}>
              <Text
                style={[
                  styles.contactShareName,
                  { color: isMine ? "#fff" : colors.text },
                ]}
                numberOfLines={1}
              >
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
              },
            ]}
            onPress={handleStartChat}
            onLongPress={onLongPress}
            disabled={loadingChat}
            activeOpacity={0.8}
          >
            {loadingChat ? (
              <ActivityIndicator
                size="small"
                color={isMine ? colors.tint : "#fff"}
              />
            ) : (
              <Text
                style={[
                  styles.contactShareButtonText,
                  { color: isMine ? colors.tint : "#fff" },
                ]}
              >
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
            {isMine && renderStatusIcons()}
          </View>
        </TouchableOpacity>
        {item.reaction && (
          <View
            style={[
              styles.reactionPill,
              {
                backgroundColor: isDark ? "#2C2C2E" : "#FFFFFF",
                borderColor: colors.border,
                alignSelf: "flex-start",
                marginTop: 4,
                marginBottom: 2,
              },
            ]}
          >
            <Text style={styles.reactionPillText}>{item.reaction}</Text>
            <View
              style={[
                styles.reactionTail,
                {
                  borderRightColor: isDark ? "#2C2C2E" : "#FFFFFF",
                },
              ]}
            />
            <View
              style={[
                styles.reactionCircle,
                {
                  backgroundColor: isDark ? "#2C2C2E" : "#FFFFFF",
                  borderColor: colors.border,
                },
              ]}
            />
          </View>
        )}
      </View>
    );
  }

  if (isPixShare && pixShareData) {
    return (
      <View
        style={{
          alignSelf: isMine ? "flex-end" : "flex-start",
          maxWidth: "75%",
          marginBottom: 8,
        }}
      >
        <TouchableOpacity
          style={[
            styles.messageBubble,
            isMine
              ? [styles.myMessage, { backgroundColor: colors.tint }]
              : [styles.theirMessage, { backgroundColor: colors.surface }],
            styles.pixShareCard,
            { borderColor: colors.border, marginBottom: 0 },
          ]}
          onPress={() => {
            Clipboard.setString(pixShareData.pix_value);
            Alert.alert("Copiado", "Chave Pix copiada com sucesso!");
          }}
          onLongPress={onLongPress}
          activeOpacity={0.8}
        >
          {isGroup && !isMine && item.sender_username ? (
            <Text
              style={[
                styles.senderUsername,
                { color: colors.tint, marginBottom: 8 },
              ]}
            >
              {item.sender_username}
            </Text>
          ) : null}
          <View style={styles.pixShareHeader}>
            <View
              style={[
                styles.pixShareIconCircle,
                { backgroundColor: "#ffffff" },
              ]}
            >
              <MaterialIcons name="pix" size={24} color="#32BCAD" />
            </View>
            <View style={styles.pixShareInfo}>
              <Text
                style={[
                  styles.pixShareName,
                  { color: isMine ? "#fff" : colors.text },
                ]}
                numberOfLines={1}
              >
                {pixShareData.full_name}
              </Text>
              <View style={styles.pixShareKeyRow}>
                <Text
                  style={[
                    styles.pixShareType,
                    {
                      color: isMine
                        ? "rgba(255,255,255,0.7)"
                        : colors.textSecondary,
                    },
                  ]}
                >
                  {PIX_TYPE_LABELS[pixShareData.pix_type] || "Chave Pix"}
                </Text>
                <Text
                  style={[
                    styles.pixShareValue,
                    { color: isMine ? "#fff" : colors.text },
                  ]}
                  numberOfLines={1}
                >
                  {pixShareData.pix_value}
                </Text>
              </View>
            </View>
          </View>

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
            {isMine && renderStatusIcons()}
          </View>
        </TouchableOpacity>
        {item.reaction && (
          <View
            style={[
              styles.reactionPill,
              {
                backgroundColor: isDark ? "#2C2C2E" : "#FFFFFF",
                borderColor: colors.border,
                alignSelf: "flex-start",
                marginTop: 4,
                marginBottom: 2,
              },
            ]}
          >
            <Text style={styles.reactionPillText}>{item.reaction}</Text>
            <View
              style={[
                styles.reactionTail,
                {
                  borderRightColor: isDark ? "#2C2C2E" : "#FFFFFF",
                },
              ]}
            />
            <View
              style={[
                styles.reactionCircle,
                {
                  backgroundColor: isDark ? "#2C2C2E" : "#FFFFFF",
                  borderColor: colors.border,
                },
              ]}
            />
          </View>
        )}
      </View>
    );
  }

  if (item.order_id) {
    return (
      <View
        style={{
          alignSelf: isMine ? "flex-end" : "flex-start",
          maxWidth: "85%",
          marginBottom: 8,
        }}
      >
        <View
          style={[
            styles.messageBubble,
            isMine
              ? [styles.myMessage, { backgroundColor: colors.tint }]
              : [styles.theirMessage, { backgroundColor: colors.surface }],
            styles.orderShareCard,
            { borderColor: colors.border, marginBottom: 0, padding: 12 },
          ]}
        >
          {isGroup && !isMine && item.sender_username ? (
            <Text
              style={[
                styles.senderUsername,
                { color: colors.tint, marginBottom: 8 },
              ]}
            >
              {item.sender_username}
            </Text>
          ) : null}

          <View style={styles.orderShareHeader}>
            <View
              style={[
                styles.orderShareIconCircle,
                {
                  backgroundColor: isMine
                    ? "rgba(255, 255, 255, 0.2)"
                    : "rgba(10, 132, 255, 0.15)",
                },
              ]}
            >
              <MaterialIcons
                name="shopping-bag"
                size={20}
                color={isMine ? "#fff" : colors.tint}
              />
            </View>
            <Text
              style={[
                styles.orderShareLabel,
                {
                  color: isMine ? "#fff" : colors.text,
                  fontWeight: "bold",
                  fontSize: 16,
                },
              ]}
            >
              Pedido
            </Text>
          </View>

          {item.content ? (
            <Text
              style={[
                styles.orderShareContent,
                {
                  color: isMine ? "#fff" : colors.text,
                  marginTop: 10,
                  fontSize: 14,
                  lineHeight: 20,
                },
              ]}
            >
              {item.content}
            </Text>
          ) : null}

          <TouchableOpacity
            style={[
              styles.orderShareButton,
              {
                backgroundColor: isMine ? "#fff" : colors.tint,
                marginTop: 12,
                borderRadius: 8,
                paddingVertical: 10,
                alignItems: "center",
              },
            ]}
            onPress={() => {
              router.push({
                pathname: "/delivery/orders/[id]",
                params: { id: item.order_id! },
              });
            }}
            onLongPress={onLongPress}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.orderShareButtonText,
                {
                  color: isMine ? colors.tint : "#fff",
                  fontWeight: "600",
                  fontSize: 14,
                },
              ]}
            >
              Ver Detalhes do Pedido
            </Text>
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
            {isMine && renderStatusIcons()}
          </View>
        </View>
        {item.reaction && (
          <View
            style={[
              styles.reactionPill,
              {
                backgroundColor: isDark ? "#2C2C2E" : "#FFFFFF",
                borderColor: colors.border,
                alignSelf: "flex-start",
                marginTop: 4,
                marginBottom: 2,
              },
            ]}
          >
            <Text style={styles.reactionPillText}>{item.reaction}</Text>
            <View
              style={[
                styles.reactionTail,
                {
                  borderRightColor: isDark ? "#2C2C2E" : "#FFFFFF",
                },
              ]}
            />
            <View
              style={[
                styles.reactionCircle,
                {
                  backgroundColor: isDark ? "#2C2C2E" : "#FFFFFF",
                  borderColor: colors.border,
                },
              ]}
            />
          </View>
        )}
      </View>
    );
  }

  if (isNoteShare && noteShareData) {
    return (
      <View
        style={{
          alignSelf: isMine ? "flex-end" : "flex-start",
          maxWidth: "75%",
          marginBottom: 8,
        }}
      >
        <TouchableOpacity
          style={[
            styles.messageBubble,
            isMine
              ? [styles.myMessage, { backgroundColor: colors.tint }]
              : [styles.theirMessage, { backgroundColor: colors.surface }],
            styles.noteShareCard,
            { borderColor: colors.border, marginBottom: 0 },
          ]}
          onLongPress={onLongPress}
          activeOpacity={0.95}
        >
          {isGroup && !isMine && item.sender_username ? (
            <Text
              style={[
                styles.senderUsername,
                { color: colors.tint, marginBottom: 8 },
              ]}
            >
              {item.sender_username}
            </Text>
          ) : null}
          {isForwarded && forwarded && (
            <View style={styles.forwardHeaderRow}>
              <MaterialCommunityIcons
                name="share"
                size={14}
                color={isMine ? "rgba(255,255,255,0.7)" : colors.textSecondary}
                style={{ marginRight: 4 }}
              />
              <Text
                style={[
                  styles.forwardHeaderText,
                  {
                    color: isMine
                      ? "rgba(255,255,255,0.85)"
                      : colors.textSecondary,
                  },
                ]}
                numberOfLines={1}
              >
                Encaminhada de {forwarded.sender_username}
              </Text>
            </View>
          )}
          <View style={styles.noteShareHeader}>
            <View
              style={[
                styles.noteShareIconCircle,
                {
                  backgroundColor: isMine ? "rgba(255,255,255,0.2)" : "#FFF3B0",
                },
              ]}
            >
              <Ionicons
                name="document-text-outline"
                size={18}
                color={isMine ? "#fff" : "#F5A623"}
              />
            </View>
            <Text
              style={[
                styles.noteShareLabel,
                {
                  color: isMine
                    ? "rgba(255,255,255,0.8)"
                    : colors.textSecondary,
                },
              ]}
            >
              Nota
            </Text>
          </View>
          <Text
            style={[
              styles.noteShareTitle,
              { color: isMine ? "#fff" : colors.text },
            ]}
            numberOfLines={1}
          >
            {noteShareData.title}
          </Text>
          {noteShareData.content ? (
            <Text
              style={[
                styles.noteShareContent,
                {
                  color: isMine
                    ? "rgba(255,255,255,0.8)"
                    : colors.textSecondary,
                },
              ]}
              numberOfLines={3}
            >
              {noteShareData.content}
            </Text>
          ) : null}
          {commentText ? (
            <Text
              style={[
                isMine
                  ? styles.myMessageText
                  : [styles.messageText, { color: colors.text }],
                { marginTop: 8 },
              ]}
            >
              {commentText}
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
            {isMine && renderStatusIcons()}
          </View>
        </TouchableOpacity>
        {item.reaction && (
          <View
            style={[
              styles.reactionPill,
              {
                backgroundColor: isDark ? "#2C2C2E" : "#FFFFFF",
                borderColor: colors.border,
                alignSelf: "flex-start",
                marginTop: 4,
                marginBottom: 2,
              },
            ]}
          >
            <Text style={styles.reactionPillText}>{item.reaction}</Text>
            <View
              style={[
                styles.reactionTail,
                {
                  borderRightColor: isDark ? "#2C2C2E" : "#FFFFFF",
                },
              ]}
            />
            <View
              style={[
                styles.reactionCircle,
                {
                  backgroundColor: isDark ? "#2C2C2E" : "#FFFFFF",
                  borderColor: colors.border,
                },
              ]}
            />
          </View>
        )}
      </View>
    );
  }

  const isFileMessage = (!!fullUrl && !isAudio) || !!youtubeId;
  const isUploadingAttachment =
    isMine &&
    !!attachment &&
    ["pending", "uploading", "sending"].includes(item.status || "");
  const uploadStatusLabel =
    item.status === "sending"
      ? "Enviando arquivo"
      : item.status === "uploading"
        ? "Carregando arquivo"
        : "Preparando envio";

  return (
    <View
      style={{
        alignSelf: isMine ? "flex-end" : "flex-start",
        flexDirection: "row",
        alignItems: "center",
        maxWidth: isFileMessage ? "85%" : "75%",
        marginBottom: 8,
      }}
    >
      {isFileMessage && !isSticker && (
        <TouchableOpacity
          onPress={handleForwardMessage}
          onLongPress={onLongPress}
          style={{
            marginRight: 8,
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: isDark
              ? "rgba(255, 255, 255, 0.08)"
              : "rgba(0, 0, 0, 0.05)",
            justifyContent: "center",
            alignItems: "center",
          }}
          activeOpacity={0.7}
        >
          <MaterialCommunityIcons
            name="share-all-outline"
            size={24}
            color={colors.textSecondary}
          />
        </TouchableOpacity>
      )}
      <View style={{ flexDirection: "column", flexShrink: 1 }}>
        {item.reaction && (
          <View
            style={[
              styles.reactionPill,
              {
                backgroundColor: isDark ? "#2C2C2E" : "#FFFFFF",
                borderColor: colors.border,
                alignSelf: "flex-start",
                marginBottom: -6,
                marginTop: 2,
                marginLeft: 10,
                zIndex: 10,
              },
            ]}
          >
            <Text style={styles.reactionPillText}>{item.reaction}</Text>
            <View
              style={[
                styles.reactionTail,
                {
                  borderRightColor: isDark ? "#2C2C2E" : "#FFFFFF",
                },
              ]}
            />
            <View
              style={[
                styles.reactionCircle,
                {
                  backgroundColor: isDark ? "#2C2C2E" : "#FFFFFF",
                  borderColor: colors.border,
                },
              ]}
            />
          </View>
        )}
        <View
          style={[
            styles.messageBubble,
            isMine
              ? [styles.myMessage, { backgroundColor: colors.tint }]
              : [styles.theirMessage, { backgroundColor: colors.surface }],
            { marginBottom: 0, flexShrink: 1 },
            isAudio && { padding: 4 },
            (isImage || isVideo || youtubeId || (!!fullUrl && !isAudio)) && {
              padding: 4,
            },
            isSticker && {
              backgroundColor: "transparent",
              borderWidth: 0,
              padding: 0,
              shadowOpacity: 0,
              elevation: 0,
            },
            item.status === "scheduled" && {
              opacity: 0.7,
              borderStyle: "dashed",
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.6)",
            },
          ]}
        >
          {isGroup && !isMine && item.sender_username ? (
            <Text
              style={[
                styles.senderUsername,
                { color: colors.tint },
                (isImage ||
                  isVideo ||
                  youtubeId ||
                  (!!fullUrl && !isAudio)) && {
                  marginHorizontal: 8,
                  marginTop: 6,
                  marginBottom: 4,
                },
              ]}
            >
              {item.sender_username}
            </Text>
          ) : null}

          {isForwarded && forwarded && (
            <View
              style={[
                styles.forwardHeaderRow,
                (isImage ||
                  isVideo ||
                  youtubeId ||
                  (!!fullUrl && !isAudio)) && {
                  marginHorizontal: 8,
                  marginTop: 4,
                },
              ]}
            >
              <MaterialCommunityIcons
                name="share"
                size={14}
                color={isMine ? "rgba(255,255,255,0.7)" : colors.textSecondary}
                style={{ marginRight: 4 }}
              />
              <Text
                style={[
                  styles.forwardHeaderText,
                  {
                    color: isMine
                      ? "rgba(255,255,255,0.85)"
                      : colors.textSecondary,
                  },
                ]}
                numberOfLines={1}
              >
                Encaminhada de {forwarded.sender_username}
              </Text>
            </View>
          )}

          {fullUrl && (
            <>
              {isImage ? (
                <TouchableOpacity
                  style={
                    isSticker ? styles.stickerTouchable : styles.mediaTouchable
                  }
                  onPress={() => setIsFullScreen(true)}
                  onLongPress={onLongPress}
                  activeOpacity={0.9}
                >
                  <View
                    style={isSticker ? styles.stickerFrame : styles.mediaFrame}
                  >
                    {isSvgMedia ? (
                      <SvgUri
                        style={[StyleSheet.absoluteFillObject, styles.mediaSvg]}
                        uri={fullUrl}
                        width="100%"
                        height="100%"
                        preserveAspectRatio="xMidYMid slice"
                      />
                    ) : (
                      <Image
                        source={{ uri: fullUrl }}
                        style={StyleSheet.absoluteFillObject}
                        contentFit="contain"
                        cachePolicy="disk"
                      />
                    )}
                  </View>
                </TouchableOpacity>
              ) : isAudio ? (
                <AudioPlayer
                  uri={fullUrl}
                  isMine={isMine}
                  onLongPress={onLongPress}
                />
              ) : isVideo ? (
                <TouchableOpacity
                  style={styles.videoContainer}
                  onPress={() => setIsFullScreen(true)}
                  onLongPress={onLongPress}
                  activeOpacity={0.9}
                >
                  <MessageVideo uri={fullUrl} isFullScreen={false} />
                  <View style={styles.videoPlayOverlay}>
                    <Ionicons name="play" size={32} color="#fff" />
                  </View>
                </TouchableOpacity>
              ) : youtubeId ? null : (
                (() => {
                  const ext = getFileExtensionLabel(
                    fileName || (mediaUrl ? mediaUrl.split("/").pop() : null),
                  ).toUpperCase();

                  return (
                    <TouchableOpacity
                      style={[
                        styles.docBubble,
                        isMine ? styles.docBubbleMine : styles.docBubbleTheir,
                      ]}
                      onPress={() => {
                        if (
                          fullUrl.startsWith("http://") ||
                          fullUrl.startsWith("https://")
                        ) {
                          router.push({
                            pathname: "/browser",
                            params: { url: fullUrl },
                          });
                        } else {
                          Linking.openURL(fullUrl);
                        }
                      }}
                      onLongPress={onLongPress}
                    >
                      {ext === "PDF" ? (
                        <View
                          style={{
                            marginRight: 10,
                            position: "relative",
                            width: 30,
                            height: 32,
                            justifyContent: "center",
                            alignItems: "center",
                          }}
                        >
                          <MaterialCommunityIcons
                            name="file"
                            size={32}
                            color="#FF3B30"
                          />
                          <View
                            style={{
                              position: "absolute",
                              top: 9,
                              left: 0,
                              right: 0,
                              bottom: 0,
                              justifyContent: "center",
                              alignItems: "center",
                            }}
                          >
                            <Text
                              style={{
                                fontSize: 8,
                                fontWeight: "500",
                                color: "#FFF",
                              }}
                            >
                              PDF
                            </Text>
                          </View>
                        </View>
                      ) : ext === "APK" ? (
                        <View
                          style={{
                            marginRight: 10,
                            position: "relative",
                            width: 30,
                            height: 32,
                            justifyContent: "center",
                            alignItems: "center",
                          }}
                        >
                          <MaterialCommunityIcons
                            name="file"
                            size={32}
                            color="#8E8E93"
                          />
                          <View
                            style={{
                              position: "absolute",
                              top: 9,
                              left: 0,
                              right: 0,
                              bottom: 0,
                              justifyContent: "center",
                              alignItems: "center",
                            }}
                          >
                            <Text
                              style={{
                                fontSize: 8,
                                fontWeight: "500",
                                color: "#FFF",
                              }}
                            >
                              APK
                            </Text>
                          </View>
                        </View>
                      ) : (
                        <Ionicons
                          name="document-text-outline"
                          size={18}
                          color={isMine ? "#fff" : colors.text}
                          style={{ marginRight: 10 }}
                        />
                      )}
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
                          {fileName}
                        </Text>
                        <Text
                          style={[
                            styles.docSubtitle,
                            isMine
                              ? styles.docSubMine
                              : [
                                  styles.docSubTheir,
                                  { color: colors.textSecondary },
                                ],
                          ]}
                        >
                          {(() => {
                            const parts: string[] = [];
                            if (fileSizeStr) parts.push(fileSizeStr);
                            if (ext) parts.push(ext);
                            return parts.length > 0
                              ? parts.join(" · ")
                              : "Tap to open";
                          })()}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })()
              )}
            </>
          )}
          {youtubeId ? (
            <TouchableOpacity
              style={styles.youtubeThumbnailContainer}
              onPress={() => {
                const youtubeUrl = `https://www.youtube.com/watch?v=${youtubeId}`;
                router.push({
                  pathname: "/browser",
                  params: { url: youtubeUrl },
                });
              }}
              onLongPress={onLongPress}
              activeOpacity={0.9}
            >
              <RNImage
                source={{
                  uri: `https://i.ytimg.com/vi/${youtubeId}/hqdefault.jpg`,
                }}
                style={styles.youtubeThumbnail}
                resizeMode="cover"
              />
              <View style={styles.videoPlayOverlay}>
                <Ionicons name="play" size={40} color="#fff" />
              </View>
            </TouchableOpacity>
          ) : null}
          {messageContent && !(mediaUrl && isAudioUrl(mediaUrl)) ? (
            <Text
              style={[
                isMine
                  ? styles.myMessageText
                  : [styles.messageText, { color: colors.text }],
                (isImage ||
                  isVideo ||
                  youtubeId ||
                  (!!fullUrl && !isAudio)) && {
                  marginHorizontal: 8,
                  marginTop: 6,
                  marginBottom: 2,
                },
              ]}
            >
              {messageContent}
            </Text>
          ) : null}
          {commentText ? (
            <Text
              style={[
                isMine
                  ? styles.myMessageText
                  : [styles.messageText, { color: colors.text }],
                { marginTop: messageContent ? 4 : 0 },
                (isImage ||
                  isVideo ||
                  youtubeId ||
                  (!!fullUrl && !isAudio)) && {
                  marginHorizontal: 8,
                  marginBottom: 2,
                },
              ]}
            >
              {commentText}
            </Text>
          ) : null}

          {item.status === "scheduled" && item.scheduled_for && (
            <ScheduledCountdown targetTime={item.scheduled_for} />
          )}

          <View
            style={[
              styles.timeContainer,
              (isImage || isVideo || youtubeId || (!!fullUrl && !isAudio)) && {
                marginHorizontal: 6,
                marginBottom: 2,
              },
              isSticker && {
                position: "absolute",
                bottom: 4,
                right: 4,
                backgroundColor: "rgba(0, 0, 0, 0.45)",
                paddingHorizontal: 6,
                paddingVertical: 2,
                borderRadius: 10,
                zIndex: 10,
              },
            ]}
          >
            <Text
              style={[
                styles.messageTime,
                isMine
                  ? styles.myMessageTime
                  : [styles.theirMessageTime, { color: colors.textSecondary }],
                isSticker && {
                  color: "#FFFFFF",
                  fontSize: 10,
                },
              ]}
            >
              {new Date(item.created_at).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </Text>
            {isMine ? renderStatusIcons() : null}
          </View>

          {isUploadingAttachment && (
            <UploadProgressLine
              label={uploadStatusLabel}
              isMine={isMine}
              trackColor={
                isMine ? "rgba(255,255,255,0.18)" : "rgba(15,23,42,0.08)"
              }
              accentColor={isMine ? "#FFFFFF" : colors.tint}
            />
          )}

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
                      <Ionicons name="arrow-back" size={24} color="#fff" />
                    </TouchableOpacity>
                    <TouchableWithoutFeedback>
                      <View style={styles.imageContainer}>
                        {isSvgMedia ? (
                          <SvgUri uri={fullUrl} width="100%" height="100%" />
                        ) : (
                          <RNImage
                            source={{ uri: fullUrl }}
                            style={styles.fullImage}
                            resizeMode="contain"
                          />
                        )}
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
                      <Ionicons name="arrow-back" size={24} color="#fff" />
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

        {/* Botões de Ação Minimalistas abaixo da mensagem */}
        {(onCreateNote || onCreateReminder || onCreateEvent) && (
          <View style={styles.minimalActionRow}>
            {onCreateNote && (
              <TouchableOpacity
                style={styles.minimalChip}
                onPress={onCreateNote}
              >
                <Ionicons
                  name="document-text-outline"
                  size={12}
                  color="#6366F1"
                />
                <Text
                  style={[
                    styles.minimalChipText,
                    { color: colors.textSecondary },
                  ]}
                >
                  Nota
                </Text>
              </TouchableOpacity>
            )}

            {onCreateReminder && (
              <TouchableOpacity
                style={styles.minimalChip}
                onPress={onCreateReminder}
              >
                <Ionicons name="alarm-outline" size={12} color="#F59E0B" />
                <Text
                  style={[
                    styles.minimalChipText,
                    { color: colors.textSecondary },
                  ]}
                >
                  Lembrete
                </Text>
              </TouchableOpacity>
            )}

            {onCreateEvent && (
              <TouchableOpacity
                style={styles.minimalChip}
                onPress={onCreateEvent}
              >
                <Ionicons name="calendar-outline" size={12} color="#10B981" />
                <Text
                  style={[
                    styles.minimalChipText,
                    { color: colors.textSecondary },
                  ]}
                >
                  Evento
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  youtubeThumbnailContainer: {
    width: 260,
    height: 180,
    borderRadius: 16,
    overflow: "hidden",
    marginBottom: 4,
    position: "relative",
    backgroundColor: "#000",
  },
  youtubeThumbnail: {
    width: "100%",
    height: "100%",
  },
  youtubeModalContainer: {
    width: "95%",
    aspectRatio: 16 / 9,
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: "#000",
  },
  youtubeEmbedFull: {
    flex: 1,
  },
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
    width: 240,
    height: 300,
    marginBottom: 4,
  },
  mediaTouchable: {
    width: 240,
    alignSelf: "flex-start",
  },
  mediaFrame: {
    width: 240,
    height: 300,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#FFFFFF",
  },
  stickerTouchable: {
    width: 150,
    alignSelf: "flex-start",
  },
  stickerFrame: {
    width: 150,
    height: 150,
    borderRadius: 0,
    overflow: "hidden",
    backgroundColor: "transparent",
  },
  mediaSvg: {
    borderRadius: 12,
  },
  messageText: { fontSize: 16 },
  myMessageText: { fontSize: 16, color: "#fff" },
  messageTime: { fontSize: 11, lineHeight: 14, includeFontPadding: false },
  myMessageTime: { color: "rgba(255,255,255,0.7)", textAlign: "right" },
  theirMessageTime: {},
  videoContainer: {
    width: 260,
    height: 180,
    borderRadius: 16,
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
    borderRadius: 16,
    marginBottom: 4,
    width: 220,
  },
  docBubbleMine: { backgroundColor: "rgba(255, 255, 255, 0.12)" },
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
  uploadStatusContainer: {
    alignSelf: "flex-end",
    width: 124,
    marginTop: 6,
    marginRight: 2,
  },
  uploadStatusMine: {},
  uploadStatusTheirs: {},
  uploadStatusText: {
    fontSize: 10,
    fontWeight: "600",
    marginBottom: 4,
    letterSpacing: 0.2,
  },
  uploadTrack: {
    height: 3,
    borderRadius: 999,
    overflow: "hidden",
    position: "relative",
  },
  uploadShimmer: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 52,
    borderRadius: 999,
    opacity: 0.9,
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
    fontWeight: "400",
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
  pixShareCard: {
    borderWidth: 1,
    padding: 12,
    borderRadius: 16,
    width: 240,
  },
  pixShareHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  pixShareIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  pixShareInfo: {
    flex: 1,
  },
  pixShareName: {
    fontSize: 15,
    fontWeight: "600",
    marginBottom: 4,
  },
  pixShareKeyRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  pixShareType: {
    fontSize: 12,
    marginRight: 6,
  },
  pixShareValue: {
    fontSize: 13,
    flex: 1,
  },
  noteShareCard: {
    borderWidth: 1,
    padding: 12,
    borderRadius: 16,
    width: 220,
  },
  noteShareHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  noteShareIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 8,
  },
  noteShareLabel: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
  },
  noteShareTitle: {
    fontSize: 15,
    fontWeight: "600",
    marginBottom: 4,
  },
  noteShareContent: {
    fontSize: 13,
    lineHeight: 18,
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
  forwardHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  forwardHeaderText: {
    fontSize: 11.5,
    fontWeight: "500",
  },
  orderShareCard: {
    borderWidth: 1,
    borderRadius: 16,
    width: 250,
  },
  orderShareHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  orderShareIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 8,
  },
  orderShareLabel: {
    fontSize: 14,
    fontWeight: "bold",
  },
  orderShareContent: {
    fontSize: 13,
    lineHeight: 18,
  },
  orderShareButton: {
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
  },
  orderShareButtonText: {
    fontSize: 13,
    fontWeight: "bold",
  },
  reactionPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
    elevation: 2,
  },
  reactionPillText: {
    fontSize: 14,
  },
  reactionTail: {
    position: "absolute",
    left: -3,
    bottom: -2,
    width: 0,
    height: 0,
    backgroundColor: "transparent",
    borderStyle: "solid",
    borderTopWidth: 6,
    borderBottomWidth: 4,
    borderRightWidth: 8,
    borderTopColor: "transparent",
    borderBottomColor: "transparent",
    transform: [{ rotate: "-40deg" }],
  },
  reactionCircle: {
    position: "absolute",
    left: -9,
    bottom: -8,
    width: 5,
    height: 5,
    borderRadius: 2.5,
    borderWidth: StyleSheet.hairlineWidth,
  },
  locationShareCard: {
    borderWidth: 1,
    padding: 12,
    borderRadius: 16,
    width: 220,
  },
  locationShareHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  locationShareIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },
  locationShareInfo: {
    flex: 1,
  },
  locationShareTitle: {
    fontSize: 16,
    fontWeight: "bold",
  },
  locationShareAddress: {
    fontSize: 13,
    marginTop: 2,
  },
  locationShareSubAddress: {
    fontSize: 12,
    marginTop: 4,
  },
  locationShareButton: {
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  locationShareButtonText: {
    fontSize: 14,
    fontWeight: "bold",
  },
  minimalActionRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignSelf: "center",
    gap: 6,
    marginTop: 4,
    marginBottom: 4,
  },
  minimalChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    backgroundColor: "rgba(100, 116, 139, 0.08)",
  },
  minimalChipText: {
    fontSize: 11,
    fontWeight: "500",
  },
});
