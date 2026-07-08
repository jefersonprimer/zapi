import { useEffect, useState, useRef, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Image,
  Linking,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import { Audio } from "expo-av";
import EmojiPicker, { type EmojiType } from "rn-emoji-keyboard";
import {
  Smile,
  Paperclip,
  Camera as CameraIcon,
  Mic as MicIcon,
  Send as SendIcon,
  Play as PlayIcon,
  Pause as PauseIcon,
  FileText as FileIcon,
  Video as VideoIcon,
  Music as MusicIcon,
  Trash2 as TrashIcon,
  Square as SquareIcon,
  X as XIcon,
} from "lucide-react-native";
import { useAuth } from "../context/AuthContext";
import {
  getMessages,
  sendMessage,
  uploadFile,
  type Message,
} from "../services/api";
import { WsClient } from "../services/ws";

const isImageUrl = (url: string) => /\.(jpg|jpeg|png|gif|webp)(\?.*)?$/i.test(url);
const isAudioUrl = (url: string) => /\.(m4a|mp3|wav|caf|ogg|3gp)(\?.*)?$/i.test(url);
const isVideoUrl = (url: string) => /\.(mp4|mov|webm|mkv|avi)(\?.*)?$/i.test(url);

function AudioPlayer({ uri, isMine }: { uri: string; isMine: boolean }) {
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);

  const onPlaybackStatusUpdate = (status: any) => {
    if (status.isLoaded) {
      setPosition(status.positionMillis);
      setDuration(status.durationMillis || 0);
      if (status.didJustFinish) {
        setIsPlaying(false);
        setPosition(0);
      }
    }
  };

  async function playSound() {
    try {
      if (sound) {
        await sound.playAsync();
        setIsPlaying(true);
      } else {
        const { sound: newSound } = await Audio.Sound.createAsync(
          { uri },
          { shouldPlay: true },
          onPlaybackStatusUpdate
        );
        setSound(newSound);
        setIsPlaying(true);
      }
    } catch (error) {
      console.log("Error playing sound:", error);
    }
  }

  async function pauseSound() {
    if (sound) {
      await sound.pauseAsync();
      setIsPlaying(false);
    }
  }

  useEffect(() => {
    return () => {
      if (sound) {
        sound.unloadAsync();
      }
    };
  }, [sound]);

  const formatTime = (millis: number) => {
    const totalSeconds = millis / 1000;
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = Math.floor(totalSeconds % 60);
    return `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;
  };

  return (
    <View style={[audioStyles.container, isMine ? audioStyles.containerMine : audioStyles.containerTheir]}>
      <TouchableOpacity
        onPress={isPlaying ? pauseSound : playSound}
        style={[audioStyles.playButton, isMine ? audioStyles.playButtonMine : audioStyles.playButtonTheir]}
      >
        {isPlaying ? (
          <PauseIcon size={14} color={isMine ? "#007AFF" : "#fff"} fill={isMine ? "#007AFF" : "#fff"} />
        ) : (
          <PlayIcon size={14} color={isMine ? "#007AFF" : "#fff"} fill={isMine ? "#007AFF" : "#fff"} style={{ marginLeft: 2 }} />
        )}
      </TouchableOpacity>
      <View style={audioStyles.progressContainer}>
        <Text style={[audioStyles.timeText, isMine ? audioStyles.timeTextMine : audioStyles.timeTextTheir]}>
          {isPlaying ? `${formatTime(position)} / ${formatTime(duration)}` : `Voice Message (${formatTime(duration || 0)})`}
        </Text>
      </View>
    </View>
  );
}

const audioStyles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    padding: 8,
    borderRadius: 12,
    marginVertical: 4,
    minWidth: 180,
  },
  containerMine: {
    backgroundColor: "rgba(255, 255, 255, 0.2)",
  },
  containerTheir: {
    backgroundColor: "rgba(0, 0, 0, 0.05)",
  },
  playButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 8,
  },
  playButtonMine: {
    backgroundColor: "#fff",
  },
  playButtonTheir: {
    backgroundColor: "#007AFF",
  },
  playIcon: {
    fontSize: 14,
  },
  playIconMine: {
    color: "#007AFF",
  },
  playIconTheir: {
    color: "#fff",
  },
  progressContainer: {
    flex: 1,
  },
  timeText: {
    fontSize: 12,
  },
  timeTextMine: {
    color: "#fff",
  },
  timeTextTheir: {
    color: "#333",
  },
});

type Props = {
  route: any;
};

export default function ChatScreen({ route }: Props) {
  const { chatId } = route.params;
  const { token, user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [content, setContent] = useState("");
  const [sending, setSending] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const wsRef = useRef<WsClient | null>(null);

  interface Attachment {
    uri: string;
    name: string;
    type: "image" | "video" | "audio" | "document";
    mimeType?: string;
  }

  const [selectedAttachment, setSelectedAttachment] = useState<Attachment | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const recordingTimerRef = useRef<any>(null);

  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
    };
  }, []);

  const loadMessages = useCallback(async () => {
    if (!token) return;
    try {
      const data = await getMessages(token, chatId);
      setMessages(data.messages);
    } catch (err: any) {
      Alert.alert("Error", err.message);
    }
  }, [chatId, token]);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  useEffect(() => {
    if (!token) return;

    const ws = new WsClient(token);
    wsRef.current = ws;
    ws.connect();
    ws.subscribe(chatId);

    const unsub = ws.on("new_message", (data) => {
      setMessages((prev) => [...prev, data.message]);
    });

    return () => {
      unsub();
      ws.disconnect();
      wsRef.current = null;
    };
  }, [chatId, token]);

  async function handleSend() {
    const hasContent = content.trim().length > 0;
    const hasAttachment = selectedAttachment !== null;

    if ((!hasContent && !hasAttachment && !sending) || !token || sending) return;
    setSending(true);
    try {
      let attachmentUrl = undefined;

      if (selectedAttachment) {
        const { uri, name, type, mimeType } = selectedAttachment;
        let finalMime = mimeType;
        if (!finalMime) {
          if (type === "image") finalMime = "image/jpeg";
          else if (type === "video") finalMime = "video/mp4";
          else if (type === "audio") finalMime = "audio/m4a";
          else finalMime = "application/pdf";
        }

        const uploadRes = await uploadFile(token, uri, name, finalMime);
        attachmentUrl = uploadRes.url;
      }

      await sendMessage(token, chatId, content, attachmentUrl);
      setContent("");
      setSelectedAttachment(null);
    } catch (err: any) {
      Alert.alert("Error sending message", err.message);
    } finally {
      setSending(false);
    }
  }

  async function handlePickDocument() {
    if (!token) return;
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "*/*",
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) return;
      const asset = result.assets[0];

      let type: "image" | "video" | "audio" | "document" = "document";
      const mime = asset.mimeType || "";
      if (mime.startsWith("image/")) {
        type = "image";
      } else if (mime.startsWith("video/")) {
        type = "video";
      } else if (mime.startsWith("audio/")) {
        type = "audio";
      }

      setSelectedAttachment({
        uri: asset.uri,
        name: asset.name,
        type,
        mimeType: asset.mimeType,
      });
    } catch (err: any) {
      Alert.alert("Error picking document", err.message);
    }
  }

  async function handleTakePhoto() {
    if (!token) return;
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (permission.status !== "granted") {
        Alert.alert("Permission Denied", "Camera access is required to take photos.");
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ["images", "videos"],
        quality: 0.8,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) return;
      const asset = result.assets[0];

      const isVideo = asset.type === "video";
      setSelectedAttachment({
        uri: asset.uri,
        name: isVideo ? `video_${Date.now()}.mp4` : `photo_${Date.now()}.jpg`,
        type: isVideo ? "video" : "image",
        mimeType: isVideo ? "video/mp4" : "image/jpeg",
      });
    } catch (err: any) {
      Alert.alert("Error taking photo", err.message);
    }
  }

  async function startRecording() {
    try {
      const permission = await Audio.requestPermissionsAsync();
      if (permission.status !== "granted") {
        Alert.alert("Permission Denied", "Microphone access is required to record audio.");
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording: newRecording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );

      setRecording(newRecording);
      setIsRecording(true);
      setRecordingDuration(0);

      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
    } catch (err: any) {
      Alert.alert("Error starting recording", err.message);
    }
  }

  async function stopRecording(shouldKeep: boolean) {
    if (!recording) return;

    setIsRecording(false);
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }

    try {
      await recording.stopAndUnloadAsync();
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false });

      if (shouldKeep) {
        const uri = recording.getURI();
        if (uri) {
          setSelectedAttachment({
            uri,
            name: `audio_${Date.now()}.m4a`,
            type: "audio",
            mimeType: "audio/m4a",
          });
        }
      }
    } catch (err: any) {
      Alert.alert("Error stopping recording", err.message);
    } finally {
      setRecording(null);
    }
  }

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 90}
    >
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        onContentSizeChange={() =>
          flatListRef.current?.scrollToEnd({ animated: true })
        }
        style={styles.messageList}
        contentContainerStyle={{ padding: 16 }}
        renderItem={({ item }) => {
          const isMine = item.sender_id === user?.user_id;
          const fullUrl = item.image_url
            ? (item.image_url.startsWith("http")
              ? item.image_url
              : `http://192.168.5.22:3000${item.image_url}`)
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
                        <VideoIcon size={24} color={isMine ? "#fff" : "#007AFF"} style={{ marginRight: 6 }} />
                        <Text style={[styles.videoText, isMine ? styles.videoTextMine : styles.videoTextTheir]}>
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
                      <FileIcon size={24} color={isMine ? "#fff" : "#333"} style={{ marginRight: 10 }} />
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
                <Text style={isMine ? styles.myMessageText : styles.messageText}>{item.content}</Text>
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
        }}
        ListEmptyComponent={
          <Text style={styles.emptyText}>
            No messages yet. Say hello!
          </Text>
        }
      />

      {selectedAttachment && (
        <View style={styles.previewAttachmentBar}>
          <View style={styles.previewAttachmentContent}>
            {selectedAttachment.type === "image" ? (
              <Image source={{ uri: selectedAttachment.uri }} style={styles.previewImage} />
            ) : (
              <View style={styles.previewIconContainer}>
                {selectedAttachment.type === "video" ? (
                  <VideoIcon size={20} color="#007AFF" />
                ) : selectedAttachment.type === "audio" ? (
                  <MusicIcon size={20} color="#34C759" />
                ) : (
                  <FileIcon size={20} color="#8e8e93" />
                )}
              </View>
            )}
            <View style={styles.previewTextContainer}>
              <Text style={styles.previewName} numberOfLines={1}>
                {selectedAttachment.name}
              </Text>
              <Text style={styles.previewType}>
                {selectedAttachment.type.toUpperCase()} ready to send
              </Text>
            </View>
          </View>
          <TouchableOpacity style={styles.previewCloseBtn} onPress={() => setSelectedAttachment(null)}>
            <XIcon size={14} color="#666" />
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.inputContainer}>
        {isRecording ? (
          <View style={styles.recordingContainer}>
            <Text style={styles.recordingText}>🔴 Recording: {formatDuration(recordingDuration)}</Text>
            <TouchableOpacity style={styles.cancelRecordBtn} onPress={() => stopRecording(false)}>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <TrashIcon size={16} color="#FF3B30" style={{ marginRight: 4 }} />
                <Text style={styles.cancelRecordText}>Cancel</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity style={styles.stopRecordBtn} onPress={() => stopRecording(true)}>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <SquareIcon size={12} color="#fff" fill="#fff" style={{ marginRight: 6 }} />
                <Text style={styles.stopRecordText}>Stop</Text>
              </View>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <TouchableOpacity style={styles.iconBtn} onPress={() => setShowEmojiPicker(true)}>
              <Smile size={24} color="#007AFF" />
            </TouchableOpacity>

            <TextInput
              style={styles.input}
              placeholder="Message..."
              placeholderTextColor="#999"
              value={content}
              onChangeText={setContent}
              multiline
            />

            <TouchableOpacity style={styles.iconBtn} onPress={handlePickDocument}>
              <Paperclip size={22} color="#007AFF" />
            </TouchableOpacity>

            <TouchableOpacity style={styles.iconBtn} onPress={handleTakePhoto}>
              <CameraIcon size={22} color="#007AFF" />
            </TouchableOpacity>

            {(content.trim().length > 0 || selectedAttachment) ? (
              <TouchableOpacity
                style={[styles.sendButtonCircle, sending && styles.sendButtonCircleDisabled]}
                onPress={handleSend}
                disabled={sending}
              >
                <SendIcon size={18} color="#fff" style={{ marginLeft: 2 }} />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.micButton}
                onPress={startRecording}
              >
                <MicIcon size={20} color="#fff" />
              </TouchableOpacity>
            )}
          </>
        )}
      </View>

      <EmojiPicker
        open={showEmojiPicker}
        onClose={() => setShowEmojiPicker(false)}
        onEmojiSelected={(emojiObject: EmojiType) => {
          setContent((prev) => prev + emojiObject.emoji);
        }}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  messageList: { flex: 1 },
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
    backgroundColor: "#f0f0f0",
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
  inputContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    padding: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#eee",
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 16,
    maxHeight: 100,
    marginRight: 8,
  },
  sendButtonCircle: {
    backgroundColor: "#007AFF",
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 2,
  },
  sendButtonCircleDisabled: { opacity: 0.5 },
  attachBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 4,
  },
  attachBtnText: { fontSize: 22 },
  emptyText: {
    textAlign: "center",
    color: "#999",
    marginTop: 40,
    fontSize: 16,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    marginHorizontal: 2,
    marginBottom: 4,
  },
  iconBtnText: { fontSize: 20 },
  micButton: {
    backgroundColor: "#34C759",
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 2,
  },
  previewAttachmentBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#f9f9f9",
    padding: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#eee",
  },
  previewAttachmentContent: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  previewImage: {
    width: 40,
    height: 40,
    borderRadius: 8,
    marginRight: 10,
  },
  previewIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: "#eee",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },
  previewIcon: { fontSize: 20 },
  previewTextContainer: { flex: 1 },
  previewName: { fontSize: 14, fontWeight: "600", color: "#333" },
  previewType: { fontSize: 11, color: "#888", marginTop: 2 },
  previewCloseBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#e0e0e0",
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 10,
  },
  previewCloseText: { fontSize: 12, fontWeight: "bold", color: "#666" },
  recordingContainer: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  recordingText: {
    fontSize: 16,
    color: "#FF3B30",
    fontWeight: "600",
    flex: 1,
  },
  cancelRecordBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8,
  },
  cancelRecordText: { color: "#FF3B30", fontSize: 15, fontWeight: "500" },
  stopRecordBtn: {
    backgroundColor: "#FF3B30",
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  stopRecordText: { color: "#fff", fontSize: 15, fontWeight: "600" },
  
  videoBubble: {
    width: 200,
    height: 120,
    borderRadius: 12,
    marginBottom: 4,
    overflow: "hidden",
  },
  videoBubbleMine: { backgroundColor: "rgba(255, 255, 255, 0.2)" },
  videoBubbleTheir: { backgroundColor: "rgba(0, 0, 0, 0.05)" },
  videoPreview: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  videoText: { fontSize: 16, fontWeight: "600" },
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
