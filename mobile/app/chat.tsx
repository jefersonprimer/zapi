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
  Keyboard,
  Image,
  ActivityIndicator,
} from "react-native";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { useAudioRecorder, RecordingPresets, setAudioModeAsync, requestRecordingPermissionsAsync } from "expo-audio";
import {
  Phone as PhoneIcon,
  MoreVertical as MoreVerticalIcon,
  Video,
  ArrowLeft,
  Trash2,
} from "lucide-react-native";
import {
  useLocalSearchParams,
  useRouter,
  useNavigation,
  useFocusEffect,
} from "expo-router";
import { ChatEmojiPicker } from "@/components/ChatEmojiPicker";
import { ChatInput } from "@/components/ChatInput";
import { AttachDocumentButton } from "@/components/AttachDocumentButton";
import {
  AttachCameraButton,
  type Attachment,
} from "@/components/AttachCameraButton";
import { SendOrMicButton } from "@/components/SendOrMicButton";
import { ChatMenuModal } from "@/components/ChatMenuModal";
import MuteModal from "@/components/MuteModal";
import { MessageBubble } from "@/components/MessageBubble";
import { CallBubble } from "@/components/CallBubble";
import { VoiceNoteRecorderBar } from "@/components/VoiceNoteRecorderBar";
import { AttachmentPreviewBar } from "@/components/AttachmentPreviewBar";
import { GroupDetailsModal } from "@/components/GroupDetailsModal";
import { useAuth } from "@/context/AuthContext";
import { useAppTheme } from "@/context/ThemeContext";
import {
  type Message,
  getContacts,
  addContact,
  removeContact,
  markChatRead,
  deleteMessageForEveryone,
  getChats,
  unblockContact,
  blockContact,
  clearChatMessages,
  muteChat,
  API_URL,
} from "@/services/api";
import {
  getDatabase,
  getMessagesFromLocal,
  saveMessages,
  insertMessageLocal,
  markChatReadLocal,
  markSentMessagesReadLocal,
  markSentMessagesDeliveredLocal,
  clearChatMessagesLocal,
  deleteMessageLocal,
  deleteMessageForMeLocal,
  setChatMuteLocal,
  setChatBlockedLocal,
} from "@/services/database";
import { syncWorker } from "@/services/syncWorker";
import { cacheMediaFile } from "@/services/mediaCache";
import { wsClient } from "@/services/ws";
import { voiceCallManager } from "@/services/voiceCallManager";
import { generateUUIDv7 } from "@/services/uuidv7";
import { getCallHistory, type CallHistoryItem } from "@/services/callApi";
import { useCallStore } from "@/store/useCallStore";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { isSameDay, getDateLabel } from "@/utils/date";
import { validateAttachmentSize } from "@/utils/file";

type ChatItem =
  | { type: "message"; data: Message }
  | { type: "call"; data: CallHistoryItem };

export default function ChatScreen() {
  const insets = useSafeAreaInsets();
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const params = useLocalSearchParams<{
    chatId: string;
    participantId?: string;
    participantUsername?: string;
    participantAvatarUrl?: string;
  }>();
  const router = useRouter();
  const navigation = useNavigation();

  const chatId = params.chatId;
  const participantId = params.participantId || "";
  const participantUsername = params.participantUsername || "Unknown";
  const [participantAvatarUrl, setParticipantAvatarUrl] = useState(params.participantAvatarUrl || "");

  useEffect(() => {
    if (params.participantAvatarUrl) {
      setParticipantAvatarUrl(params.participantAvatarUrl);
    }
  }, [params.participantAvatarUrl]);

  useEffect(() => {
    if (Platform.OS === "web") return;

    const showEvent =
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent =
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const showSubscription = Keyboard.addListener(showEvent, () => {
      setIsKeyboardVisible(true);
    });
    const hideSubscription = Keyboard.addListener(hideEvent, () => {
      setIsKeyboardVisible(false);
    });

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  const { token, user } = useAuth();
  const { colors, isDark } = useAppTheme();
  const [messages, setMessages] = useState<Message[]>([]);
  const [calls, setCalls] = useState<CallHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [content, setContent] = useState("");
  const sending = false;
  const flatListRef = useRef<FlatList>(null);

  const callState = useCallStore((state) => state.callState);

  const [menuVisible, setMenuVisible] = useState(false);
  const [muteModalVisible, setMuteModalVisible] = useState(false);
  const [isContact, setIsContact] = useState(false);

  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [optionsModalVisible, setOptionsModalVisible] = useState(false);

  const [isBlockedByMe, setIsBlockedByMe] = useState(false);
  const [isBlockedByThem, setIsBlockedByThem] = useState(false);
  const [clearedAt, setClearedAt] = useState<string | null>(null);
  const [isGroup, setIsGroup] = useState(false);
  const [groupModalVisible, setGroupModalVisible] = useState(false);

  const loadChatDetails = useCallback(async () => {
    if (!token) return;
    try {
      const db = await getDatabase();
      const chatRow = await db.getFirstAsync<{ is_group: number }>(
        "SELECT is_group FROM chats WHERE id = ?",
        [chatId]
      );
      if (chatRow) {
        setIsGroup(chatRow.is_group === 1);
      }

      const chatListData = await getChats(token, chatId);
      const currentChat = chatListData.chats.find((c) => c.id === chatId);
      if (currentChat) {
        setIsGroup(!!currentChat.is_group);
        setIsBlockedByMe(!!currentChat.is_blocked_by_me);
        setIsBlockedByThem(!!currentChat.is_blocked_by_them);
        setClearedAt(currentChat.cleared_at || null);
        if (currentChat.participant_avatar_url) {
          setParticipantAvatarUrl(currentChat.participant_avatar_url);
        }
      }
    } catch (err) {
      console.error("Failed to load chat details for blocking status:", err);
    }
  }, [token, chatId]);

  useFocusEffect(
    useCallback(() => {
      loadChatDetails();
    }, [loadChatDetails]),
  );


  const chatItems = useMemo(() => {
    const items: ChatItem[] = [];

    messages.forEach((msg) => {
      if (!msg.deleted_at) {
        items.push({ type: "message", data: msg });
      }
    });

    calls.forEach((call) => {
      const isOutgoing =
        call.caller_id === user?.user_id && call.callee_id === participantId;
      const isIncoming =
        call.caller_id === participantId && call.callee_id === user?.user_id;
      if (isOutgoing || isIncoming) {
        const callTime = new Date(call.created_at).getTime();
        const clearTime = clearedAt ? new Date(clearedAt).getTime() : 0;
        if (callTime > clearTime) {
          items.push({ type: "call", data: call });
        }
      }
    });

    items.sort((a, b) => {
      const timeA = new Date(
        a.type === "message" ? a.data.created_at : a.data.created_at,
      ).getTime();
      const timeB = new Date(
        b.type === "message" ? b.data.created_at : b.data.created_at,
      ).getTime();
      return timeA - timeB;
    });

    return items;
  }, [messages, calls, user?.user_id, participantId, clearedAt]);

  async function handleDeleteForMe() {
    if (!selectedMessage) return;
    try {
      await deleteMessageForMeLocal(selectedMessage.id);
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === selectedMessage.id
            ? { ...msg, deleted_at: new Date().toISOString() }
            : msg
        )
      );
    } catch (err) {
      console.error("Error saving deleted message:", err);
    }
    setSelectedMessage(null);
    setDeleteModalVisible(false);
  }

  async function handleDeleteForEveryone() {
    if (!selectedMessage || !token) return;
    try {
      await deleteMessageForEveryone(token, chatId, selectedMessage.id);
      // Update local messages state immediately
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === selectedMessage.id
            ? {
                ...msg,
                deleted_for_everyone: true,
                content: null,
                image_url: null,
              }
            : msg,
        ),
      );
    } catch (err: any) {
      Alert.alert(
        "Erro",
        err.message || "Não foi possível apagar a mensagem para todos.",
      );
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
        Alert.alert(
          "Sucesso",
          "Mensagem copiada para a área de transferência.",
        );
      } catch (err) {
        console.error("Clipboard copy failed:", err);
        Alert.alert("Erro", "Não foi possível copiar a mensagem.");
      }
    } else {
      Alert.alert(
        "Erro",
        "Apenas mensagens de texto ou emoji podem ser copiadas.",
      );
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
        const contact = contactsList.find((c) => c.contact_id === participantId);
        if (contact) {
          setIsContact(true);
          if (contact.avatar_url) {
            setParticipantAvatarUrl(contact.avatar_url);
          }
        }
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

  const handleMutePress = () => {
    setMuteModalVisible(true);
  };

  const handleMuteChats = async (durationHours: number | "always") => {
    if (!token) return;

    let mutedUntil: string | null = null;
    let mutedForever = false;

    if (durationHours === "always") {
      mutedForever = true;
    } else {
      mutedUntil = new Date(
        Date.now() + durationHours * 60 * 60 * 1000,
      ).toISOString();
    }

    try {
      await muteChat(token, chatId, mutedUntil, mutedForever);
      await setChatMuteLocal(chatId, mutedUntil, mutedForever);
      setMuteModalVisible(false);
    } catch (err) {
      console.error("Error muting chat:", err);
      Alert.alert("Erro", "Não foi possível silenciar as notificações.");
    }
  };

  const handleBlockPress = () => {
    if (!token || !participantId || isGroup) {
      Alert.alert("Erro", "Não é possível bloquear um grupo.");
      return;
    }

    const title = isBlockedByMe ? "Desbloquear contato" : "Bloquear contato";
    const message = isBlockedByMe
      ? "Deseja realmente desbloquear este contato?"
      : "Deseja realmente bloquear este contato?";

    Alert.alert(title, message, [
      { text: "Cancelar", style: "cancel" },
      {
        text: isBlockedByMe ? "Desbloquear" : "Bloquear",
        style: "destructive",
        onPress: async () => {
          try {
            if (isBlockedByMe) {
              await unblockContact(token, participantId);
              setIsBlockedByMe(false);
            } else {
              await blockContact(token, participantId);
              setIsBlockedByMe(true);
            }
            await setChatBlockedLocal(chatId, !isBlockedByMe);
          } catch (err: any) {
            Alert.alert(
              "Erro",
              err.message || "Não foi possível alterar o status de bloqueio.",
            );
          }
        },
      },
    ]);
  };

  const handleClearChatPress = () => {
    if (!token) return;

    Alert.alert(
      "Limpar conversa",
      "Deseja realmente apagar todo o histórico de mensagens desta conversa? Esta ação não pode ser desfeita.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Limpar",
          style: "destructive",
          onPress: async () => {
            try {
              await clearChatMessages(token, chatId);
              await clearChatMessagesLocal(chatId);
              setMessages([]);
              setClearedAt(new Date().toISOString());
            } catch (err: any) {
              Alert.alert(
                "Erro",
                err.message || "Não foi possível limpar a conversa.",
              );
            }
          },
        },
      ],
    );
  };

  // Disable native header to render custom styled header bar
  useEffect(() => {
    navigation.setOptions({
      headerShown: false,
    });
  }, [navigation]);

  const [selectedAttachment, setSelectedAttachment] =
    useState<Attachment | null>(null);
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [hasRecordingSession, setHasRecordingSession] = useState(false);
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

  // Helper to trigger media downloads for all media messages
  const cacheMediaForMessages = useCallback(async (msgs: Message[]) => {
    for (const msg of msgs) {
      if (msg.image_url && !msg.local_file_path && !msg.deleted_for_everyone) {
        // Cache in background
        cacheMediaFile(msg.image_url, msg.id).then((localPath) => {
          if (localPath.startsWith("file://")) {
            // Update local state when caching completes
            setMessages((prev) =>
              prev.map((m) =>
                m.id === msg.id ? { ...m, local_file_path: localPath } : m
              )
            );
          }
        }).catch((err) => {
          console.warn("Background media caching failed:", err);
        });
      }
    }
  }, []);

  const loadMessages = useCallback(async () => {
    if (!token) return;
    try {
      // 1. Carrega dados do SQLite local imediatamente
      const localMsgs = await getMessagesFromLocal(chatId);
      setMessages(localMsgs);
      
      // Inicia cache das mídias locais em background
      cacheMediaForMessages(localMsgs);

      // Carrega histórico de ligações paralelamente
      getCallHistory(token).then((callData) => {
        setCalls(callData);
      }).catch((err) => {
        console.error("Failed to fetch call history:", err);
      });

      // Marca o chat como lido na API e localmente
      markChatRead(token, chatId).catch(() => {});
      await markChatReadLocal(chatId);

      // 2. Dispara a sincronização incremental (delta) em background no SyncWorker
      syncWorker.triggerSync(chatId);
    } catch (err: any) {
      console.warn("Error loading local messages:", err);
    } finally {
      setIsLoading(false);
    }
  }, [chatId, token, cacheMediaForMessages]);

  useEffect(() => {
    setIsLoading(true);
  }, [chatId]);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  useEffect(() => {
    if (callState === "idle") {
      loadMessages();
    }
  }, [callState, loadMessages]);

  useEffect(() => {
    if (!chatId) return;
    // Subscreve às mudanças do SQLite disparadas pelo SyncWorker
    const unsubscribeSync = syncWorker.onMessagesChanged(chatId, async () => {
      try {
        const localMsgs = await getMessagesFromLocal(chatId);
        setMessages(localMsgs);
        cacheMediaForMessages(localMsgs);
      } catch (err) {
        console.error("Failed to reload messages from SQLite on sync update:", err);
      }
    });

    return unsubscribeSync;
  }, [chatId, cacheMediaForMessages]);

  useEffect(() => {
    if (!token) return;

    wsClient.subscribe(chatId);

    const unsub = wsClient.on("new_message", (data) => {
      if (data.message.chat_id === chatId) {
        if (data.message.sender_id !== user?.user_id) {
          wsClient.send({ type: "delivered_ack", chat_id: chatId });
        }

        // Save new message locally
        if (data.message.sender_id === user?.user_id) {
          // If it's our own message coming back, remove the temporary pending message
          getDatabase().then(async (db) => {
            let attachmentType: "image" | "video" | "audio" | "document" | null = null;
            if (data.message.attachments && data.message.attachments.length > 0) {
              attachmentType = data.message.attachments[0].type;
            } else if (data.message.image_url) {
              const urlLower = data.message.image_url.toLowerCase();
              if (urlLower.endsWith(".jpg") || urlLower.endsWith(".jpeg") || urlLower.endsWith(".png") || urlLower.endsWith(".gif") || urlLower.endsWith(".webp")) {
                attachmentType = "image";
              } else if (urlLower.endsWith(".mp4") || urlLower.endsWith(".mov") || urlLower.endsWith(".webm") || urlLower.endsWith(".mkv") || urlLower.endsWith(".avi")) {
                attachmentType = "video";
              } else if (urlLower.endsWith(".mp3") || urlLower.endsWith(".wav") || urlLower.endsWith(".m4a") || urlLower.endsWith(".caf") || urlLower.endsWith(".ogg") || urlLower.endsWith(".opus")) {
                attachmentType = "audio";
              } else {
                attachmentType = "document";
              }
            }

            let pending: { id: string } | null = null;
            if (attachmentType) {
              pending = await db.getFirstAsync<{ id: string }>(
                `SELECT m.id FROM messages m 
                 JOIN attachments a ON m.id = a.message_id 
                 WHERE m.chat_id = ? AND m.sender_id = ? AND a.type = ? AND (m.status = 'pending' OR m.status = 'uploading' OR m.status = 'sending')`,
                [chatId, user?.user_id || "", attachmentType]
              );
            } else {
              pending = await db.getFirstAsync<{ id: string }>(
                "SELECT id FROM messages WHERE chat_id = ? AND sender_id = ? AND content = ? AND (status = 'pending' OR status = 'uploading' OR status = 'sending')",
                [chatId, user?.user_id || "", data.message.content || ""]
              );
            }

            if (pending) {
              await db.runAsync("DELETE FROM messages WHERE id = ?", [pending.id]);
            }
            await saveMessages([data.message]);
            syncWorker.notifyMessagesChanged(chatId);
          }).catch(console.error);
        } else {
          saveMessages([data.message]).then(() => {
            syncWorker.notifyMessagesChanged(chatId);
          }).catch(console.error);
        }

        if (data.message.sender_id !== user?.user_id) {
          markChatRead(token, chatId).catch((err) =>
            console.error("Error marking chat read:", err),
          );
          markChatReadLocal(chatId).catch(console.error);
        }
      }
    });

    const unsubDelete = wsClient.on("message_deleted", (data) => {
      if (data.chat_id === chatId) {
        deleteMessageLocal(data.message_id).then(() => {
          syncWorker.notifyMessagesChanged(chatId);
        }).catch(console.error);
      }
    });

    const unsubClear = wsClient.on("messages_cleared", (data) => {
      if (data.chat_id === chatId) {
        clearChatMessagesLocal(chatId).then(() => {
          setCalls([]);
          setClearedAt(new Date().toISOString());
          syncWorker.notifyMessagesChanged(chatId);
        }).catch(console.error);
      }
    });

    const unsubRead = wsClient.on("messages_read", (data) => {
      if (data.chat_id === chatId && data.reader_id !== user?.user_id) {
        markSentMessagesReadLocal(chatId, user?.user_id || "", data.read_at).then(() => {
          syncWorker.notifyMessagesChanged(chatId);
        }).catch(console.error);
      }
    });

    const unsubDelivered = wsClient.on("messages_delivered", (data) => {
      if (data.chat_id === chatId && data.receiver_id !== user?.user_id) {
        markSentMessagesDeliveredLocal(chatId, user?.user_id || "").then(() => {
          syncWorker.notifyMessagesChanged(chatId);
        }).catch(console.error);
      }
    });

    return () => {
      unsub();
      unsubDelete();
      unsubClear();
      unsubRead();
      unsubDelivered();
      wsClient.unsubscribe(chatId);
    };
  }, [chatId, token, user]);

  async function handleSend() {
    const hasContent = content.trim().length > 0;
    const hasAttachment = selectedAttachment !== null;

    if ((!hasContent && !hasAttachment && !sending) || !token || sending)
      return;

    if (selectedAttachment && selectedAttachment.size !== undefined) {
      const validation = validateAttachmentSize(
        selectedAttachment.size,
        selectedAttachment.type,
        selectedAttachment.name,
        selectedAttachment.mimeType || ""
      );

      if (!validation.valid) {
        Alert.alert(
          "Arquivo muito grande",
          `O tamanho do arquivo excede o limite permitido para ${validation.label}.`,
        );
        return;
      }
    }

    // Save attachment and content info, then clear UI inputs immediately
    const attachmentInfo = selectedAttachment;
    const messageContentText = content;
    setContent("");
    setSelectedAttachment(null);

    // 1. Generate time-ordered UUIDv7 ID and create local message representation
    const localId = generateUUIDv7();
    const newLocalMsg: Message = {
      id: localId,
      chat_id: chatId,
      sender_id: user?.user_id || "",
      sender_username: user?.username || "",
      content: messageContentText || null,
      image_url: null,
      local_file_path: attachmentInfo?.uri || null,
      created_at: new Date().toISOString(),
      status: attachmentInfo ? "uploading" : "pending",
      deleted_for_everyone: false,
      attachments: attachmentInfo ? [{
        id: localId + "_att",
        message_id: localId,
        type: attachmentInfo.type,
        remote_url: "",
        local_path: attachmentInfo.uri,
        mime_type: attachmentInfo.mimeType || null,
        width: null,
        height: null,
        duration: attachmentInfo.duration || null,
        size: attachmentInfo.size || null,
        sha256: null,
        thumbnail_path: null,
        download_status: "downloaded"
      } as any] : undefined
    };

    try {
      // 2. Insert into SQLite local database
      await insertMessageLocal(newLocalMsg);
      
      // Notify SQLite changes to UI listeners to render the new message immediately
      syncWorker.notifyMessagesChanged(chatId);
      
      // Trigger background upload and send in SyncWorker
      syncWorker.triggerSync(chatId);
    } catch (dbErr) {
      console.error("Failed to save message to local SQLite:", dbErr);
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
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
        });
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
        Alert.alert(
          "Erro ao acessar o microfone",
          err.message || "Permissão negada ou não suportada no navegador.",
        );
      }
      return;
    }

    try {
      const permission = await requestRecordingPermissionsAsync();
      if (permission.status !== "granted") {
        Alert.alert(
          "Permissão Negada",
          "O acesso ao microfone é necessário para gravar áudios.",
        );
        return;
      }

      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });

      await recorder.prepareToRecordAsync();
      recorder.record();

      setHasRecordingSession(true);
      setIsRecording(true);
      setRecordingDuration(0);

      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
    } catch (err: any) {
      Alert.alert("Erro ao iniciar gravação", err.message);
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
          if (recordingTimerRef.current)
            clearInterval(recordingTimerRef.current);
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

    if (!hasRecordingSession) return;

    if (isRecordingPaused) {
      try {
        recorder.record();
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
        recorder.pause();
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
          const audioBlob = new Blob(audioChunksRef.current, {
            type: "audio/webm",
          });
          const uri = URL.createObjectURL(audioBlob);
          setSelectedAttachment({
            uri,
            name: `audio_${Date.now()}.opus`,
            type: "audio",
            mimeType: "audio/webm",
            size: audioBlob.size,
            duration: recordingDuration,
          });
        }
        mediaRecorderRef.current = null;
        audioChunksRef.current = [];
      };

      recorder.stop();
      return;
    }

    if (!hasRecordingSession) return;

    setIsRecording(false);
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }

    try {
      await recorder.stop();
      await setAudioModeAsync({ allowsRecording: false });

      if (shouldKeep) {
        const uri = recorder.uri;
        if (uri) {
          setSelectedAttachment({
            uri,
            name: `audio_${Date.now()}.m4a`,
            type: "audio",
            mimeType: "audio/m4a",
            duration: recordingDuration,
          });
        }
      }
    } catch (err: any) {
      Alert.alert("Erro ao parar gravação", err.message);
    } finally {
      setHasRecordingSession(false);
    }
  }

  const isDeleteForEveryoneAvailable = (() => {
    if (!selectedMessage || selectedMessage.sender_id !== user?.user_id)
      return false;
    const sentTime = new Date(selectedMessage.created_at).getTime();
    const now = Date.now();
    const ageInHours = (now - sentTime) / (1000 * 60 * 60);
    return ageInHours < 24;
  })();

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={
        Platform.OS === "ios"
          ? "padding"
          : isKeyboardVisible
          ? "height"
          : undefined
      }
      keyboardVerticalOffset={Platform.OS === "ios" ? insets.top + 60 : 0}
    >
      {/* Custom Header */}
      <View
        style={[
          styles.customHeader,
          {
            paddingTop: insets.top,
            height: insets.top + 60,
            backgroundColor: colors.surface,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <View style={styles.headerLeftContainer}>
          <TouchableOpacity
            onPress={() =>
              selectedMessage ? setSelectedMessage(null) : router.back()
            }
            style={styles.headerBackBtn}
          >
            <ArrowLeft size={24} color={colors.text} />
          </TouchableOpacity>
          {!selectedMessage && (
            <TouchableOpacity
              onPress={() => {
                if (isGroup) {
                  setGroupModalVisible(true);
                } else if (participantId) {
                  router.push({
                    pathname: "/contact-detail",
                    params: {
                      participantId,
                      participantUsername,
                      chatId,
                      avatarUrl: participantAvatarUrl || undefined,
                    },
                  });
                }
              }}
              style={{ flex: 1, flexDirection: "row", alignItems: "center", paddingVertical: 8 }}
            >
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  backgroundColor: isGroup ? "#34C759" : colors.tint,
                  justifyContent: "center",
                  alignItems: "center",
                  marginRight: 10,
                  overflow: "hidden",
                }}
              >
                {participantAvatarUrl ? (
                  <Image
                    source={{
                      uri: participantAvatarUrl.startsWith("http")
                        ? participantAvatarUrl
                        : `${API_URL}${participantAvatarUrl}`,
                    }}
                    style={{ width: "100%", height: "100%" }}
                  />
                ) : (
                  <Text style={{ color: "#FFF", fontSize: 14, fontWeight: "bold" }}>
                    {participantUsername[0]?.toUpperCase()}
                  </Text>
                )}
              </View>
              <Text
                style={[styles.headerTitleText, { color: colors.text }]}
                numberOfLines={1}
              >
                {participantUsername}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.headerRightContainer}>
          {selectedMessage ? (
            <>
              <TouchableOpacity
                onPress={() => setDeleteModalVisible(true)}
                style={styles.headerActionBtn}
              >
                <Trash2 size={22} color={colors.text} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setOptionsModalVisible(true)}
                style={styles.headerActionBtn}
              >
                <MoreVerticalIcon size={22} color={colors.text} />
              </TouchableOpacity>
            </>
          ) : (
            <>
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
                      "Erro",
                      "Não foi possível iniciar a chamada: ID do participante ausente.",
                    );
                  }
                }}
                style={styles.headerActionBtn}
              >
                <Video size={22} color={colors.text} />
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
                      "Erro",
                      "Não foi possível iniciar a chamada: ID do participante ausente.",
                    );
                  }
                }}
                style={styles.headerActionBtn}
              >
                <PhoneIcon size={22} color={colors.text} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setMenuVisible(true)}
                style={styles.headerActionBtn}
              >
                <MoreVerticalIcon size={22} color={colors.text} />
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>

      <FlatList
        ref={flatListRef}
        data={chatItems}
        keyExtractor={(item) =>
          item.type === "message" ? item.data.id : `call_${item.data.id}`
        }
        onContentSizeChange={() =>
          flatListRef.current?.scrollToEnd({ animated: true })
        }
        style={styles.messageList}
        contentContainerStyle={{ padding: 16 }}
        renderItem={({ item, index }) => {
          const itemDate =
            item.type === "message"
              ? item.data.created_at
              : item.data.created_at;
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
                    <View
                      style={[
                        styles.dateHeaderBackground,
                        { backgroundColor: isDark ? "#1E293B" : "#eaeaea" },
                      ]}
                    >
                      <Text
                        style={[
                          styles.dateHeaderText,
                          { color: colors.textSecondary },
                        ]}
                      >
                        {getDateLabel(msg.created_at)}
                      </Text>
                    </View>
                  </View>
                )}
                <TouchableOpacity
                  onLongPress={() =>
                    !msg.deleted_for_everyone && setSelectedMessage(msg)
                  }
                  delayLongPress={500}
                  style={[
                    styles.messageRow,
                    isSelected && [
                      styles.selectedMessageRow,
                      {
                        backgroundColor: isDark
                          ? "rgba(10, 132, 255, 0.25)"
                          : "rgba(0, 122, 255, 0.15)",
                      },
                    ],
                  ]}
                  activeOpacity={0.8}
                >
                  <MessageBubble item={msg} currentUserId={user?.user_id} isGroup={isGroup} />
                </TouchableOpacity>
              </View>
            );
          } else {
            return (
              <CallBubble
                call={item.data}
                currentUserId={user?.user_id}
                participantId={participantId}
                participantUsername={participantUsername}
                showDateHeader={showDateHeader}
              />
            );
          }
        }}
        ListEmptyComponent={
          isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.tint} />
            </View>
          ) : (
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              Nenhuma mensagem ainda. Envie um oi!
            </Text>
          )
        }
      />

      {selectedAttachment && (
        <AttachmentPreviewBar
          attachment={selectedAttachment}
          onClear={() => setSelectedAttachment(null)}
        />
      )}

      <View
        style={[
          styles.inputContainer,
          {
            paddingBottom: isKeyboardVisible ? 6 : insets.bottom,
            backgroundColor: colors.background,
          },
        ]}
      >
        {isBlockedByMe || isBlockedByThem ? (
          <View
            style={[
              styles.blockedContainer,
              { backgroundColor: isDark ? "#1E293B" : "#F1F5F9" },
            ]}
          >
            <Text style={[styles.blockedText, { color: colors.textSecondary }]}>
              {isBlockedByMe
                ? "Você bloqueou este contato. Desbloqueie para enviar mensagens."
                : "Você está bloqueado. Não é possível enviar mensagens."}
            </Text>
            {isBlockedByMe && (
              <TouchableOpacity
                onPress={async () => {
                  if (!token || !participantId) return;
                  try {
                    await unblockContact(token, participantId);
                    setIsBlockedByMe(false);
                    Alert.alert("Sucesso", "Contato desbloqueado.");
                  } catch (err: any) {
                    Alert.alert(
                      "Erro",
                      err.message || "Não foi possível desbloquear o contato.",
                    );
                  }
                }}
                style={[styles.unblockButton, { backgroundColor: colors.tint }]}
              >
                <Text style={styles.unblockButtonText}>Desbloquear</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : isRecording ? (
          <VoiceNoteRecorderBar
            recordingDuration={recordingDuration}
            onStopRecording={stopRecording}
            isPaused={isRecordingPaused}
            onPauseResumeRecording={handlePauseResumeRecording}
          />
        ) : (
          <>
            <View
              style={[
                styles.inputContainerMessage,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
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
        isGroup={isGroup}
        isBlocked={isBlockedByMe}
        onToggleContact={handleToggleContact}
        onMutePress={handleMutePress}
        onBlockPress={handleBlockPress}
        onClearChatPress={handleClearChatPress}
        onViewContact={
          !isGroup && participantId
            ? () => {
                router.push({
                  pathname: "/contact-detail",
                  params: {
                    participantId,
                    participantUsername,
                    chatId,
                    avatarUrl: participantAvatarUrl || undefined,
                  },
                });
              }
            : undefined
        }
      />

      <MuteModal
        visible={muteModalVisible}
        onClose={() => setMuteModalVisible(false)}
        onMute={handleMuteChats}
      />

      {/* Group Details Modal */}
      <GroupDetailsModal
        visible={groupModalVisible}
        onClose={() => setGroupModalVisible(false)}
        chatId={chatId}
        participantUsername={participantUsername}
      />

      {/* Delete Confirmation Modal */}
      <Modal
        transparent={true}
        visible={deleteModalVisible}
        animationType="fade"
        onRequestClose={() => setDeleteModalVisible(false)}
      >
        <View
          style={[
            styles.modalOverlayCentered,
            { backgroundColor: colors.modalOverlay },
          ]}
        >
          <View
            style={[
              styles.alertContainer,
              { backgroundColor: colors.menuBackground },
            ]}
          >
            <Text style={[styles.alertTitle, { color: colors.text }]}>
              Deseja apagar a mensagem?
            </Text>
            <View
              style={
                isDeleteForEveryoneAvailable
                  ? styles.alertButtonsVertical
                  : styles.alertButtons
              }
            >
              {isDeleteForEveryoneAvailable ? (
                <>
                  <TouchableOpacity
                    style={[
                      styles.alertButtonVertical,
                      styles.deleteEveryoneButton,
                      { backgroundColor: colors.danger },
                    ]}
                    onPress={handleDeleteForEveryone}
                  >
                    <Text style={styles.deleteButtonText}>
                      Apagar para todos
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.alertButtonVertical,
                      styles.deleteMeButton,
                      { backgroundColor: isDark ? "#2C2C2E" : "#f5f5f5" },
                    ]}
                    onPress={handleDeleteForMe}
                  >
                    <Text
                      style={[
                        styles.deleteMeButtonText,
                        { color: colors.tint },
                      ]}
                    >
                      Apagar para mim
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.alertButtonVertical,
                      styles.cancelButtonVertical,
                      { backgroundColor: isDark ? "#2C2C2E" : "#e0e0e0" },
                    ]}
                    onPress={() => setDeleteModalVisible(false)}
                  >
                    <Text
                      style={[
                        styles.cancelButtonText,
                        { color: colors.textSecondary },
                      ]}
                    >
                      Cancelar
                    </Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <TouchableOpacity
                    style={[
                      styles.alertButton,
                      styles.cancelButton,
                      { backgroundColor: isDark ? "#2C2C2E" : "#f5f5f5" },
                    ]}
                    onPress={() => setDeleteModalVisible(false)}
                  >
                    <Text
                      style={[
                        styles.cancelButtonText,
                        { color: colors.textSecondary },
                      ]}
                    >
                      Cancelar
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.alertButton,
                      styles.deleteButton,
                      { backgroundColor: colors.danger },
                    ]}
                    onPress={handleDeleteForMe}
                  >
                    <Text style={styles.deleteButtonText}>Apagar para mim</Text>
                  </TouchableOpacity>
                </>
              )}
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
          style={[
            styles.dropdownOverlay,
            { backgroundColor: colors.modalOverlay },
          ]}
          activeOpacity={1}
          onPress={() => setOptionsModalVisible(false)}
        >
          <View
            style={[
              styles.dropdownContainer,
              {
                backgroundColor: colors.menuBackground,
                borderColor: colors.border,
              },
            ]}
          >
            <TouchableOpacity
              style={styles.dropdownOption}
              onPress={handleCopy}
            >
              <Text style={[styles.dropdownOptionText, { color: colors.text }]}>
                Copiar
              </Text>
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
  blockedContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 12,
    borderRadius: 12,
    marginHorizontal: 12,
    marginVertical: 4,
  },
  blockedText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 18,
    marginRight: 10,
  },
  unblockButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  unblockButtonText: {
    color: "#ffffff",
    fontWeight: "bold",
    fontSize: 13,
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
  alertButtonsVertical: {
    flexDirection: "column",
    width: "100%",
    gap: 10,
  },
  alertButtonVertical: {
    width: "100%",
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  deleteEveryoneButton: {
    backgroundColor: "#ff3b30",
  },
  deleteMeButton: {
    backgroundColor: "#f5f5f5",
  },
  deleteMeButtonText: {
    color: "#ff9500",
    fontSize: 14,
    fontWeight: "600",
  },
  cancelButtonVertical: {
    backgroundColor: "#e0e0e0",
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
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderRadius: 40,
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 4,
    marginRight: 8,
  },
  emptyText: {
    textAlign: "center",
    color: "#888",
    marginTop: 40,
    fontSize: 16,
  },
  loadingContainer: {
    paddingVertical: 40,
    alignItems: "center",
    justifyContent: "center",
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

  customHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#ffffff",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#eee",
    paddingHorizontal: 16,
  },
  headerLeftContainer: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  headerBackBtn: {
    padding: 8,
    marginRight: 4,
  },
  headerTitleText: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#272727",
    flex: 1,
  },
  headerRightContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  headerActionBtn: {
    padding: 8,
    marginLeft: 12,
  },
});
