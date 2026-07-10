import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Clipboard,
  Modal,
} from "react-native";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { Audio } from "expo-av";
import * as SecureStore from "expo-secure-store";
import {
  Phone as PhoneIcon,
  MoreVertical as MoreVerticalIcon,
  Video,
  ArrowLeft,
  Trash2,
  PhoneIncoming,
  PhoneOutgoing,
  PhoneMissed,
  PhoneOff,
} from "lucide-react-native";
import { ChatEmojiPicker } from "../components/ChatEmojiPicker";
import { ChatInput } from "../components/ChatInput";
import { AttachDocumentButton } from "../components/AttachDocumentButton";
import {
  AttachCameraButton,
  type Attachment,
} from "../components/AttachCameraButton";
import { SendOrMicButton } from "../components/SendOrMicButton";
import { ChatMenuModal } from "../components/ChatMenuModal";
import { MessageBubble } from "../components/MessageBubble";
import { VoiceNoteRecorderBar } from "../components/VoiceNoteRecorderBar";
import { AttachmentPreviewBar } from "../components/AttachmentPreviewBar";
import { useAuth } from "../context/AuthContext";
import {
  getMessages,
  sendMessage,
  uploadFile,
  type Message,
  getContacts,
  addContact,
  removeContact,
  markChatRead,
} from "../services/api";
import { wsClient } from "../services/ws";
import { voiceCallManager } from "../services/voiceCallManager";
import { getCallHistory, type CallHistoryItem } from "../services/callApi";
import { useCallStore } from "../store/useCallStore";

type ChatItem =
  | { type: "message"; data: Message }
  | { type: "call"; data: CallHistoryItem };

function isSameDay(dateStr1: string, dateStr2: string): boolean {
  if (!dateStr1 || !dateStr2) return false;
  const d1 = new Date(dateStr1);
  const d2 = new Date(dateStr2);
  if (isNaN(d1.getTime()) || isNaN(d2.getTime())) return false;
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
}

function getDateLabel(dateStr: string): string {
  const msgDate = new Date(dateStr);
  if (isNaN(msgDate.getTime())) return "";

  const today = new Date();
  
  // Clear times
  const dMsg = new Date(msgDate.getFullYear(), msgDate.getMonth(), msgDate.getDate());
  const dToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  
  const diffTime = dToday.getTime() - dMsg.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) {
    return "Hoje";
  }
  if (diffDays === 1) {
    return "Ontem";
  }
  if (diffDays === 2) {
    return "Anteontem";
  }
  if (diffDays > 2 && diffDays < 7) {
    return "Esta semana";
  }
  if (diffDays >= 7 && diffDays < 14) {
    return "Semana passada";
  }
  
  // Check if it's the same month and year
  if (dMsg.getFullYear() === dToday.getFullYear() && dMsg.getMonth() === dToday.getMonth()) {
    return "Este mês";
  }
  
  // Check if it's last month
  const isLastMonth = 
    (dToday.getFullYear() === dMsg.getFullYear() && dToday.getMonth() - dMsg.getMonth() === 1) ||
    (dToday.getFullYear() - dMsg.getFullYear() === 1 && dToday.getMonth() === 0 && dMsg.getMonth() === 11);
      
  if (isLastMonth) {
    return "Mês passado";
  }
  
  const months = [
    "janeiro", "fevereiro", "março", "abril", "maio", "junho",
    "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"
  ];
  return `${dMsg.getDate()} de ${months[dMsg.getMonth()]} de ${dMsg.getFullYear()}`;
}

type Props = {
  route: any;
  navigation: any;
};

export default function ChatScreen({ route, navigation }: Props) {
  const { chatId, participantId, participantUsername } = route.params;
  const { token, user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [calls, setCalls] = useState<CallHistoryItem[]>([]);
  const [content, setContent] = useState("");
  const [sending, setSending] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  const callState = useCallStore((state) => state.callState);

  const [menuVisible, setMenuVisible] = useState(false);
  const [isContact, setIsContact] = useState(false);

  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [optionsModalVisible, setOptionsModalVisible] = useState(false);
  const [deletedIds, setDeletedIds] = useState<string[]>([]);

  const deletedKey = `deleted_messages_${chatId}`;

  const chatItems = useMemo(() => {
    const items: ChatItem[] = [];

    messages.forEach((msg) => {
      if (!deletedIds.includes(msg.id)) {
        items.push({ type: "message", data: msg });
      }
    });

    calls.forEach((call) => {
      const isOutgoing = call.caller_id === user?.user_id && call.callee_id === participantId;
      const isIncoming = call.caller_id === participantId && call.callee_id === user?.user_id;
      if (isOutgoing || isIncoming) {
        items.push({ type: "call", data: call });
      }
    });

    items.sort((a, b) => {
      const timeA = new Date(a.type === "message" ? a.data.created_at : a.data.created_at).getTime();
      const timeB = new Date(b.type === "message" ? b.data.created_at : b.data.created_at).getTime();
      return timeA - timeB;
    });

    return items;
  }, [messages, calls, deletedIds, user?.user_id, participantId]);

  // Load deleted messages from SecureStore
  useEffect(() => {
    (async () => {
      try {
        const stored = await SecureStore.getItemAsync(deletedKey);
        if (stored) {
          setDeletedIds(JSON.parse(stored));
        } else {
          setDeletedIds([]);
        }
      } catch (err) {
        console.error("Error loading deleted messages:", err);
      }
    })();
  }, [chatId, deletedKey]);

  async function handleDeleteForMe() {
    if (!selectedMessage) return;
    const newDeleted = [...deletedIds, selectedMessage.id];
    setDeletedIds(newDeleted);
    try {
      await SecureStore.setItemAsync(deletedKey, JSON.stringify(newDeleted));
    } catch (err) {
      console.error("Error saving deleted message:", err);
    }
    setSelectedMessage(null);
    setDeleteModalVisible(false);
  }

  const handleCopy = () => {
    if (selectedMessage && selectedMessage.content) {
      try {
        if (Platform.OS === "web") {
          if (navigator.clipboard) {
            navigator.clipboard.writeText(selectedMessage.content);
          } else {
            throw new Error("Web clipboard not available");
          }
        } else {
          Clipboard.setString(selectedMessage.content);
        }
        Alert.alert("Sucesso", "Mensagem copiada para a área de transferência.");
      } catch (err) {
        console.error("Clipboard copy failed:", err);
        Alert.alert("Erro", "Não foi possível copiar a mensagem.");
      }
    } else {
      Alert.alert("Erro", "Apenas mensagens de texto ou emoji podem ser copiadas.");
    }
    setOptionsModalVisible(false);
    setSelectedMessage(null);
  };

  // Check if participant is a contact
  useEffect(() => {
    if (!token || !participantId) return;
    (async () => {
      try {
        const contactsList = await getContacts(token);
        const exists = contactsList.some((c) => c.contact_id === participantId);
        setIsContact(exists);
      } catch (err) {
        console.error("Error checking contact status:", err);
      }
    })();
  }, [token, participantId]);

  async function handleToggleContact() {
    if (!token || !participantId) return;
    setMenuVisible(false);
    try {
      if (isContact) {
        await removeContact(token, participantId);
        setIsContact(false);
        Alert.alert("Sucesso", "Contato removido com sucesso.");
      } else {
        await addContact(token, participantId);
        setIsContact(true);
        Alert.alert("Sucesso", "Contato adicionado com sucesso.");
      }
    } catch (err: any) {
      Alert.alert(
        "Erro",
        err.message || "Não foi possível gerenciar o contato.",
      );
    }
  }

  // Set call and menu buttons in header
  useEffect(() => {
    if (selectedMessage) {
      navigation.setOptions({
        headerLeft: () => (
          <TouchableOpacity
            onPress={() => setSelectedMessage(null)}
            style={{ marginLeft: 10, padding: 8 }}
          >
            <ArrowLeft size={24} color="#272727" />
          </TouchableOpacity>
        ),
        headerTitle: "",
        title: "",
        headerRight: () => (
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <TouchableOpacity
              onPress={() => setDeleteModalVisible(true)}
              style={{ marginRight: 20, padding: 8 }}
            >
              <Trash2 size={22} color="#272727" />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setOptionsModalVisible(true)}
              style={{ marginRight: 10, padding: 8 }}
            >
              <MoreVerticalIcon size={22} color="#272727" />
            </TouchableOpacity>
          </View>
        ),
      });
    } else {
      navigation.setOptions({
        headerLeft: undefined,
        headerTitle: participantUsername,
        title: participantUsername,
        headerRight: () => (
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <TouchableOpacity
              onPress={() => {
                if (participantId) {
                  voiceCallManager.startCall(
                    participantId,
                    participantUsername || "User",
                    true,
                  );
                } else {
                  Alert.alert(
                    "Error",
                    "Cannot initiate call: Participant ID is missing.",
                  );
                }
              }}
            >
              <Video size={22} color="#272727" />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                if (participantId) {
                  voiceCallManager.startCall(
                    participantId,
                    participantUsername || "User",
                  );
                } else {
                  Alert.alert(
                    "Error",
                    "Cannot initiate call: Participant ID is missing.",
                  );
                }
              }}
              style={{ marginHorizontal: 30 }}
            >
              <PhoneIcon size={22} color="#272727" />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setMenuVisible(true)}
              style={{ marginRight: 10 }}
            >
              <MoreVerticalIcon size={22} color="#272727" />
            </TouchableOpacity>
          </View>
        ),
      });
    }
  }, [navigation, participantId, participantUsername, selectedMessage]);

  const [selectedAttachment, setSelectedAttachment] =
    useState<Attachment | null>(null);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const recordingTimerRef = useRef<any>(null);
  const mediaRecorderRef = useRef<any>(null);
  const audioChunksRef = useRef<any[]>([]);
  const [isRecordingPaused, setIsRecordingPaused] = useState(false);

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
      const [msgData, callData] = await Promise.all([
        getMessages(token, chatId),
        getCallHistory(token).catch((err) => {
          console.error("Failed to fetch call history:", err);
          return [];
        })
      ]);
      setMessages(msgData.messages);
      setCalls(callData);
    } catch (err: any) {
      Alert.alert("Error", err.message);
    }
  }, [chatId, token]);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  useEffect(() => {
    if (callState === "idle") {
      loadMessages();
    }
  }, [callState, loadMessages]);

  useEffect(() => {
    if (!token) return;

    wsClient.subscribe(chatId);

    const unsub = wsClient.on("new_message", (data) => {
      setMessages((prev) => [...prev, data.message]);
      if (data.message.sender_id !== user?.user_id) {
        markChatRead(token, chatId).catch((err) =>
          console.error("Error marking chat read:", err)
        );
      }
    });

    return () => {
      unsub();
      wsClient.unsubscribe(chatId);
    };
  }, [chatId, token, user]);

  async function handleSend() {
    const hasContent = content.trim().length > 0;
    const hasAttachment = selectedAttachment !== null;

    if ((!hasContent && !hasAttachment && !sending) || !token || sending)
      return;

    if (selectedAttachment && selectedAttachment.size !== undefined) {
      const size = selectedAttachment.size;
      const type = selectedAttachment.type;
      const mime = selectedAttachment.mimeType || "";
      let maxBytes = 0;
      let label = "";

      if (type === "image") {
        maxBytes = 20 * 1024 * 1024;
        label = "fotos (máx 20MB)";
      } else if (type === "video") {
        maxBytes = 250 * 1024 * 1024;
        label = "vídeos (máx 250MB)";
      } else if (type === "document") {
        maxBytes = 500 * 1024 * 1024;
        label = "documentos (máx 500MB)";
      } else if (type === "audio") {
        const isVoiceMsg = selectedAttachment.name.startsWith("audio_") || mime === "audio/m4a" || mime === "audio/aac" || mime === "audio/3gp";
        if (isVoiceMsg) {
          maxBytes = 25 * 1024 * 1024;
          label = "mensagens de voz (máx 25MB)";
        } else {
          maxBytes = 50 * 1024 * 1024;
          label = "áudios (máx 50MB)";
        }
      }

      if (size > maxBytes) {
        Alert.alert(
          "Arquivo muito grande",
          `O tamanho do arquivo excede o limite permitido para ${label}.`
        );
        return;
      }
    }

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

  async function handlePickFromGallery() {
    try {
      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (permission.status !== "granted") {
        Alert.alert(
          "Permissão Negada",
          "O acesso à galeria de fotos é necessário para selecionar imagens/vídeos.",
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images", "videos"],
        quality: 0.8,
      });

      if (result.canceled || !result.assets || result.assets.length === 0)
        return;
      const asset = result.assets[0];

      const isVideo = asset.type === "video";
      const defaultName = isVideo
        ? `video_${Date.now()}.mp4`
        : `photo_${Date.now()}.jpg`;
      const defaultMime = isVideo ? "video/mp4" : "image/jpeg";

      setSelectedAttachment({
        uri: asset.uri,
        name: asset.fileName || defaultName,
        type: isVideo ? "video" : "image",
        mimeType: asset.mimeType || defaultMime,
        size: asset.fileSize,
      });
    } catch (err: any) {
      Alert.alert("Erro ao selecionar da galeria", err.message);
    }
  }

  async function handlePickFile() {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "*/*",
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets || result.assets.length === 0)
        return;
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
        size: asset.size,
      });
    } catch (err: any) {
      Alert.alert("Erro ao selecionar documento", err.message);
    }
  }

  async function handlePickDocument() {
    if (!token) return;

    if (Platform.OS === "web") {
      // No navegador (web), o seletor de arquivos padrão já dá acesso a tudo (galeria, documentos, etc.)
      handlePickFile();
      return;
    }

    Alert.alert(
      "Anexar Arquivo",
      "Escolha de onde deseja selecionar o arquivo:",
      [
        {
          text: "Galeria (Fotos e Vídeos)",
          onPress: handlePickFromGallery,
        },
        {
          text: "Documentos",
          onPress: handlePickFile,
        },
        {
          text: "Cancelar",
          style: "cancel",
        },
      ],
      { cancelable: true },
    );
  }

  async function startRecording() {
    setIsRecordingPaused(false);
    if (Platform.OS === "web") {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mediaRecorder = new MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;
        audioChunksRef.current = [];

        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            audioChunksRef.current.push(event.data);
          }
        };

        mediaRecorder.start();
        setIsRecording(true);
        setRecordingDuration(0);

        recordingTimerRef.current = setInterval(() => {
          setRecordingDuration((prev) => prev + 1);
        }, 1000);
      } catch (err: any) {
        Alert.alert("Erro ao acessar o microfone", err.message || "Permissão negada ou não suportada no navegador.");
      }
      return;
    }

    try {
      const permission = await Audio.requestPermissionsAsync();
      if (permission.status !== "granted") {
        Alert.alert(
          "Permission Denied",
          "Microphone access is required to record audio.",
        );
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording: newRecording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY,
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

  async function handlePauseResumeRecording() {
    if (Platform.OS === "web") {
      const recorder = mediaRecorderRef.current;
      if (!recorder) return;

      if (isRecordingPaused) {
        try {
          recorder.resume();
          setIsRecordingPaused(false);
          if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
          recordingTimerRef.current = setInterval(() => {
            setRecordingDuration((prev) => prev + 1);
          }, 1000);
        } catch (err: any) {
          console.error("Failed to resume web recording:", err);
        }
      } else {
        try {
          recorder.pause();
          setIsRecordingPaused(true);
          if (recordingTimerRef.current) {
            clearInterval(recordingTimerRef.current);
            recordingTimerRef.current = null;
          }
        } catch (err: any) {
          console.error("Failed to pause web recording:", err);
        }
      }
      return;
    }

    if (!recording) return;

    if (isRecordingPaused) {
      try {
        await recording.startAsync();
        setIsRecordingPaused(false);
        if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = setInterval(() => {
          setRecordingDuration((prev) => prev + 1);
        }, 1000);
      } catch (err: any) {
        console.error("Failed to resume native recording:", err);
      }
    } else {
      try {
        await recording.pauseAsync();
        setIsRecordingPaused(true);
        if (recordingTimerRef.current) {
          clearInterval(recordingTimerRef.current);
          recordingTimerRef.current = null;
        }
      } catch (err: any) {
        console.error("Failed to pause native recording:", err);
      }
    }
  }

  async function stopRecording(shouldKeep: boolean) {
    setIsRecordingPaused(false);
    if (Platform.OS === "web") {
      setIsRecording(false);
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }

      const recorder = mediaRecorderRef.current;
      if (!recorder) return;

      recorder.onstop = () => {
        if (recorder.stream) {
          recorder.stream.getTracks().forEach((track: any) => track.stop());
        }

        if (shouldKeep) {
          const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
          const uri = URL.createObjectURL(audioBlob);
          setSelectedAttachment({
            uri,
            name: `audio_${Date.now()}.opus`,
            type: "audio",
            mimeType: "audio/webm",
            size: audioBlob.size,
          });
        }
        mediaRecorderRef.current = null;
        audioChunksRef.current = [];
      };

      recorder.stop();
      return;
    }

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

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 90}
    >
      <FlatList
        ref={flatListRef}
        data={chatItems}
        keyExtractor={(item) => item.type === "message" ? item.data.id : `call_${item.data.id}`}
        onContentSizeChange={() =>
          flatListRef.current?.scrollToEnd({ animated: true })
        }
        style={styles.messageList}
        contentContainerStyle={{ padding: 16 }}
        renderItem={({ item, index }) => {
          const itemDate = item.type === "message" ? item.data.created_at : item.data.created_at;
          const prevItem = index > 0 ? chatItems[index - 1] : null;
          const prevDate = prevItem
            ? prevItem.type === "message"
              ? prevItem.data.created_at
              : prevItem.data.created_at
            : "";
          const showDateHeader = index === 0 || !isSameDay(prevDate, itemDate);

          if (item.type === "message") {
            const msg = item.data;
            const isSelected = selectedMessage?.id === msg.id;

            return (
              <View>
                {showDateHeader && (
                  <View style={styles.dateHeaderContainer}>
                    <View style={styles.dateHeaderBackground}>
                      <Text style={styles.dateHeaderText}>
                        {getDateLabel(msg.created_at)}
                      </Text>
                    </View>
                  </View>
                )}
                <TouchableOpacity
                  onLongPress={() => setSelectedMessage(msg)}
                  delayLongPress={500}
                  style={[
                    styles.messageRow,
                    isSelected && styles.selectedMessageRow
                  ]}
                  activeOpacity={0.8}
                >
                  <MessageBubble item={msg} currentUserId={user?.user_id} />
                </TouchableOpacity>
              </View>
            );
          } else {
            const call = item.data;
            const isOutgoing = call.caller_id === user?.user_id;

            let StatusIcon = PhoneIncoming;
            let iconColor = "#34C759"; // Green
            let statusText = isOutgoing ? "Ligação efetuada" : "Ligação recebida";
            let bubbleBg = "#f1f0f0";
            let textColor = "#333";
            let timeColor = "#999";

            if (isOutgoing) {
              StatusIcon = PhoneOutgoing;
              bubbleBg = "#e1f5fe"; // light blue
              textColor = "#01579b";
              timeColor = "rgba(1, 87, 155, 0.6)";
            } else {
              if (call.status === "completed") {
                bubbleBg = "#e8f5e9"; // light green
                textColor = "#1b5e20";
                timeColor = "rgba(27, 94, 32, 0.6)";
              } else {
                // missed, rejected, busy, failed
                StatusIcon = PhoneMissed;
                iconColor = "#FF3B30"; // Red
                statusText = "Chamada perdida";
                if (call.status === "failed") {
                  StatusIcon = PhoneOff;
                  iconColor = "#FF9500"; // Orange
                }
                bubbleBg = "#ffebee"; // light red
                textColor = "#b71c1c";
                timeColor = "rgba(183, 28, 28, 0.6)";
              }
            }

            const formattedTime = new Date(call.created_at).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            });

            const formatDuration = (secs: number) => {
              if (secs === 0) return "";
              const mins = Math.floor(secs / 60);
              const remainingSecs = secs % 60;
              if (mins > 0) {
                return `${mins}m ${remainingSecs}s`;
              }
              return `${remainingSecs}s`;
            };

            const durationStr = call.duration > 0 ? ` (${formatDuration(call.duration)})` : "";

            return (
              <View>
                {showDateHeader && (
                  <View style={styles.dateHeaderContainer}>
                    <View style={styles.dateHeaderBackground}>
                      <Text style={styles.dateHeaderText}>
                        {getDateLabel(call.created_at)}
                      </Text>
                    </View>
                  </View>
                )}
                <View style={[
                  styles.messageRow,
                  isOutgoing ? styles.myCallRow : styles.theirCallRow
                ]}>
                  <View style={[
                    styles.callBubble,
                    { backgroundColor: bubbleBg }
                  ]}>
                    <View style={styles.callBubbleContent}>
                      <View style={[styles.callIconContainer, { backgroundColor: iconColor + "20" }]}>
                        <StatusIcon size={20} color={iconColor} />
                      </View>
                      <View style={styles.callTextContainer}>
                        <Text style={[styles.callStatusText, { color: textColor }]}>
                          {statusText}{durationStr}
                        </Text>
                        <TouchableOpacity
                          style={styles.callbackButton}
                          onPress={() => {
                            voiceCallManager.startCall(
                              participantId,
                              participantUsername || "User"
                            );
                          }}
                        >
                          <Text style={styles.callbackButtonText}>Retornar ligação</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                    <Text style={[styles.callTimeText, { color: timeColor }]}>
                      {formattedTime}
                    </Text>
                  </View>
                </View>
              </View>
            );
          }
        }}
        ListEmptyComponent={
          <Text style={styles.emptyText}>No messages yet. Say hello!</Text>
        }
      />

      {selectedAttachment && (
        <AttachmentPreviewBar
          attachment={selectedAttachment}
          onClear={() => setSelectedAttachment(null)}
        />
      )}

      <View style={styles.inputContainer}>
        {isRecording ? (
          <VoiceNoteRecorderBar
            recordingDuration={recordingDuration}
            onStopRecording={stopRecording}
            isPaused={isRecordingPaused}
            onPauseResumeRecording={handlePauseResumeRecording}
          />
        ) : (
          <>
            <View style={styles.inputContainerMessage}>
              <ChatEmojiPicker
                onEmojiSelected={(emoji) => setContent((prev) => prev + emoji)}
              />

              <ChatInput value={content} onChangeText={setContent} />

              <AttachDocumentButton onPress={handlePickDocument} />

              <AttachCameraButton onTakePhoto={setSelectedAttachment} />
            </View>

            <SendOrMicButton
              hasContent={
                content.trim().length > 0 || selectedAttachment !== null
              }
              sending={sending}
              onSend={handleSend}
              onStartRecording={startRecording}
            />
          </>
        )}
      </View>

      <ChatMenuModal
        visible={menuVisible}
        onClose={() => setMenuVisible(false)}
        isContact={isContact}
        onToggleContact={handleToggleContact}
      />

      {/* Delete Confirmation Modal */}
      <Modal
        transparent={true}
        visible={deleteModalVisible}
        animationType="fade"
        onRequestClose={() => setDeleteModalVisible(false)}
      >
        <View style={styles.modalOverlayCentered}>
          <View style={styles.alertContainer}>
            <Text style={styles.alertTitle}>Deseja apagar a mensagem?</Text>
            <View style={styles.alertButtons}>
              <TouchableOpacity
                style={[styles.alertButton, styles.cancelButton]}
                onPress={() => setDeleteModalVisible(false)}
              >
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.alertButton, styles.deleteButton]}
                onPress={handleDeleteForMe}
              >
                <Text style={styles.deleteButtonText}>Apagar para mim</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Options/Ellipsis Dropdown Modal */}
      <Modal
        transparent={true}
        visible={optionsModalVisible}
        animationType="fade"
        onRequestClose={() => setOptionsModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.dropdownOverlay}
          activeOpacity={1}
          onPress={() => setOptionsModalVisible(false)}
        >
          <View style={styles.dropdownContainer}>
            <TouchableOpacity
              style={styles.dropdownOption}
              onPress={handleCopy}
            >
              <Text style={styles.dropdownOptionText}>Copiar</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  messageList: { flex: 1 },

  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 12,
  },
  modalOverlayCentered: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    justifyContent: "center",
    alignItems: "center",
  },
  alertContainer: {
    width: "80%",
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  alertTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#272727",
    marginBottom: 24,
    textAlign: "center",
  },
  alertButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
  },
  alertButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  cancelButton: {
    backgroundColor: "#f5f5f5",
    marginRight: 8,
  },
  deleteButton: {
    backgroundColor: "#ff3b30",
    marginLeft: 8,
  },
  cancelButtonText: {
    color: "#666",
    fontSize: 14,
    fontWeight: "600",
  },
  deleteButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },

  dropdownOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.05)",
  },
  dropdownContainer: {
    position: "absolute",
    top: Platform.OS === "ios" ? 95 : 60,
    right: 16,
    backgroundColor: "#ffffff",
    borderRadius: 12,
    paddingVertical: 6,
    minWidth: 140,
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    borderWidth: 1,
    borderColor: "#f0f0f0",
  },
  dropdownOption: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: "flex-start",
    width: "100%",
  },
  dropdownOptionText: {
    fontSize: 16,
    color: "#272727",
    fontWeight: "500",
  },
  messageRow: {
    width: "100%",
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  selectedMessageRow: {
    backgroundColor: "rgba(76, 175, 80, 0.15)",
    borderRadius: 8,
  },

  inputContainerMessage: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderRadius: 40,
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  emptyText: {
    textAlign: "center",
    color: "#888",
    marginTop: 40,
    fontSize: 16,
  },
  dateHeaderContainer: {
    alignItems: "center",
    marginVertical: 12,
  },
  dateHeaderBackground: {
    backgroundColor: "#eaeaea",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  dateHeaderText: {
    fontSize: 11,
    color: "#666",
    fontWeight: "600",
  },
  myCallRow: {
    alignSelf: "flex-end",
    alignItems: "flex-end",
  },
  theirCallRow: {
    alignSelf: "flex-start",
    alignItems: "flex-start",
  },
  callBubble: {
    maxWidth: "75%",
    padding: 12,
    borderRadius: 16,
    marginBottom: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  callBubbleContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  callIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  callTextContainer: {
    flex: 1,
    minWidth: 120,
  },
  callStatusText: {
    fontSize: 15,
    fontWeight: "600",
  },
  callbackButton: {
    marginTop: 4,
  },
  callbackButtonText: {
    color: "#007AFF",
    fontSize: 13,
    fontWeight: "600",
  },
  callTimeText: {
    fontSize: 10,
    textAlign: "right",
    marginTop: 4,
  },
});
