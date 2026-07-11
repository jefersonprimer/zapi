import React, { useState } from "react";
import { View, Text, Image, TouchableOpacity, StyleSheet, Linking, Modal, TouchableWithoutFeedback, SafeAreaView, Platform } from "react-native";
import { FileText as FileIcon, X as XIcon, Play as PlayIcon, Clock, CheckCheck, AlertCircle } from "lucide-react-native";
import { type Message, API_URL } from "../services/api";
import { AudioPlayer } from "./AudioPlayer";
import { useAppTheme } from "@/context/ThemeContext";
import { useVideoPlayer, VideoView } from "expo-video";

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

export const MessageBubble: React.FC<MessageBubbleProps> = ({ item, currentUserId }) => {
  const { colors } = useAppTheme();
  const [isFullScreen, setIsFullScreen] = useState(false);
  const isMine = item.sender_id === currentUserId;
  
  // Use local_file_path if available to bypass network entirely
  const mediaUrl = item.local_file_path || item.image_url;
  const fullUrl = mediaUrl
    ? mediaUrl.startsWith("http") || mediaUrl.startsWith("file://")
      ? mediaUrl
      : `${API_URL}${mediaUrl.startsWith("/") ? "" : "/"}${mediaUrl}`
    : null;

  if (item.deleted_for_everyone) {
    return (
      <View
        style={[
          styles.messageBubble,
          isMine ? [styles.myMessage, { backgroundColor: colors.tint }] : [styles.theirMessage, { backgroundColor: colors.surface }],
          styles.deletedBubble,
          { borderColor: colors.border }
        ]}
      >
        <Text style={[styles.deletedText, isMine ? styles.myMessageDeletedText : [styles.messageDeletedText, { color: colors.textSecondary }]]}>
          🚫 Esta mensagem foi apagada
        </Text>
        <Text
          style={[
            styles.messageTime,
            isMine ? styles.myMessageTime : [styles.theirMessageTime, { color: colors.textSecondary }],
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

  return (
    <View
      style={[
        styles.messageBubble,
        isMine ? [styles.myMessage, { backgroundColor: colors.tint }] : [styles.theirMessage, { backgroundColor: colors.surface }],
      ]}
    >
      {fullUrl && (
        <>
          {isImageUrl(mediaUrl!) ? (
            <TouchableOpacity onPress={() => setIsFullScreen(true)} activeOpacity={0.9}>
              <Image
                source={{ uri: fullUrl }}
                style={styles.messageImage}
                resizeMode="cover"
              />
            </TouchableOpacity>
          ) : isAudioUrl(mediaUrl!) ? (
            <AudioPlayer uri={fullUrl} isMine={isMine} />
          ) : isVideoUrl(mediaUrl!) ? (
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
                    isMine ? styles.docNameMine : [styles.docNameTheir, { color: colors.text }],
                  ]}
                >
                  {mediaUrl!.split("/").pop()}
                </Text>
                <Text
                  style={[
                    styles.docSubtitle,
                    isMine ? styles.docSubMine : [styles.docSubTheir, { color: colors.textSecondary }],
                  ]}
                >
                  Tap to open document
                </Text>
              </View>
            </TouchableOpacity>
          )}
        </>
      )}
      {item.content && !(mediaUrl && isAudioUrl(mediaUrl)) ? (
        <Text style={isMine ? styles.myMessageText : [styles.messageText, { color: colors.text }]}>
          {item.content}
        </Text>
      ) : null}
      
      <View style={styles.timeContainer}>
        <Text
          style={[
            styles.messageTime,
            isMine ? styles.myMessageTime : [styles.theirMessageTime, { color: colors.textSecondary }],
          ]}
        >
          {new Date(item.created_at).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </Text>
        {isMine && (
          <View style={styles.statusIconContainer}>
            {item.status === "pending" && <Clock size={11} color="rgba(255,255,255,0.7)" />}
            {item.status === "uploading" && <Clock size={11} color="rgba(255,255,255,0.7)" />}
            {item.status === "failed" && <AlertCircle size={11} color="#FF3B30" />}
            {(item.status === "sent" || !item.status) && <CheckCheck size={11} color="rgba(255,255,255,0.8)" />}
          </View>
        )}
      </View>

      {fullUrl && isImageUrl(item.image_url!) && (
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
                  <XIcon size={24} color="#fff" />
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
      {fullUrl && isVideoUrl(item.image_url!) && isFullScreen && (
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
                  <XIcon size={24} color="#fff" />
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
  messageTime: { fontSize: 11, marginTop: 4 },
  myMessageTime: { color: "rgba(255,255,255,0.7)", textAlign: "right" },
  theirMessageTime: { },
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
  docNameTheir: { },
  docSubtitle: { fontSize: 11, marginTop: 2 },
  docSubMine: { color: "rgba(255, 255, 255, 0.7)" },
  docSubTheir: { },
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
  messageDeletedText: { },
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
    right: 20,
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
  },
});
