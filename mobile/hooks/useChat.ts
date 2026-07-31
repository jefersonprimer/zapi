import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { Platform, Alert, Keyboard, Clipboard } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import {
  useAudioRecorder,
  RecordingPresets,
  setAudioModeAsync,
  requestRecordingPermissionsAsync,
} from "expo-audio";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import { useAuth } from "@/context/AuthContext";
import {
  type Message,
  getContacts,
  addContact,
  removeContact,
  markChatRead,
  deleteMessageForEveryone,
  getChats,
} from "@/services/api";
import { toggleBlockContact, toggleMuteChat, clearChatHistory } from "@/services/chatActions";
import {
  getDatabase,
  getMessagesFromLocal,
  saveMessages,
  saveChats,
  insertMessageLocal,
  markChatReadLocal,
  markSentMessagesReadLocal,
  markSentMessagesDeliveredLocal,
  deleteMessageLocal,
  deleteMessageForMeLocal,
  clearChatMessagesLocal,
} from "@/services/database";
import { syncWorker } from "@/services/syncWorker";
import { cacheMediaFile } from "@/services/mediaCache";
import { wsClient } from "@/services/ws";
import { generateUUIDv7 } from "@/services/uuidv7";
import {
  getCallHistory,
  deleteCallHistoryItem,
  type CallHistoryItem,
} from "@/services/callApi";
import { useCallStore } from "@/store/useCallStore";
import { validateAttachmentSize } from "@/utils/file";
import {
  extractForwardData,
  buildForwardContent,
  type ForwardedMessageData,
} from "@/utils/forwardMessage";
import { type Attachment } from "@/components/AttachCameraButton";
import { type ChatItem } from "@/components/ChatItemRow";

export function useChat() {
  const params = useLocalSearchParams<{
    chatId: string;
    participantId?: string;
    participantUsername?: string;
    participantAvatarUrl?: string;
  }>();
  const router = useRouter();

  const chatId = params.chatId;
  const participantId = params.participantId || "";
  const participantUsername = params.participantUsername || "Unknown";
  const [displayTitle, setDisplayTitle] = useState(participantUsername);
  const [participantAvatarUrl, setParticipantAvatarUrl] = useState(
    params.participantAvatarUrl || "",
  );

  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

  useEffect(() => {
    if (params.participantAvatarUrl) {
      setParticipantAvatarUrl(params.participantAvatarUrl);
    }
  }, [params.participantAvatarUrl]);

  useEffect(() => {
    if (params.participantUsername) {
      setDisplayTitle(params.participantUsername);
    }
  }, [params.participantUsername]);

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
  const [messages, setMessages] = useState<Message[]>([]);
  const [calls, setCalls] = useState<CallHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [content, setContent] = useState("");
  const [participantStoreId, setParticipantStoreId] = useState<string | null>(null);
  const sending = false;

  const callState = useCallStore((state) => state.callState);

  const [menuVisible, setMenuVisible] = useState(false);
  const [muteModalVisible, setMuteModalVisible] = useState(false);
  const [isContact, setIsContact] = useState(false);

  const [selectedMessageIds, setSelectedMessageIds] = useState<string[]>([]);
  const [selectedCallIds, setSelectedCallIds] = useState<string[]>([]);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [optionsModalVisible, setOptionsModalVisible] = useState(false);
  const [forwardingMessage, setForwardingMessage] =
    useState<ForwardedMessageData | null>(null);

  const selectedCount = selectedMessageIds.length + selectedCallIds.length;
  const isSelectionMode = selectedCount > 0;
  const hasOnlyMessagesSelected =
    selectedMessageIds.length > 0 && selectedCallIds.length === 0;
  const hasOnlyCallsSelected =
    selectedCallIds.length > 0 && selectedMessageIds.length === 0;

  const selectedMessages = useMemo(
    () => messages.filter((msg) => selectedMessageIds.includes(msg.id)),
    [messages, selectedMessageIds],
  );

  const clearSelection = useCallback(() => {
    setSelectedMessageIds([]);
    setSelectedCallIds([]);
  }, []);

  const toggleMessageSelection = useCallback((msg: Message) => {
    if (msg.deleted_for_everyone) return;
    setSelectedMessageIds((prev) =>
      prev.includes(msg.id)
        ? prev.filter((id) => id !== msg.id)
        : [...prev, msg.id],
    );
  }, []);

  const toggleCallSelection = useCallback((callId: string) => {
    setSelectedCallIds((prev) =>
      prev.includes(callId)
        ? prev.filter((id) => id !== callId)
        : [...prev, callId],
    );
  }, []);

  const [isBlockedByMe, setIsBlockedByMe] = useState(false);
  const [isBlockedByThem, setIsBlockedByThem] = useState(false);
  const [messagesRestrictedReason, setMessagesRestrictedReason] = useState<
    "contacts" | "nobody" | null
  >(null);
  const [clearedAt, setClearedAt] = useState<string | null>(null);
  const [isGroup, setIsGroup] = useState(false);

  const loadChatDetails = useCallback(async () => {
    if (!token) return;
    try {
      const db = await getDatabase();
      const chatRow = await db.getFirstAsync<{
        is_group: number;
        is_blocked_by_me: number;
        is_blocked_by_them: number;
        messages_restricted_reason: string | null;
        name: string | null;
        avatar_url: string | null;
        participant_avatar_url: string | null;
        participant_name: string | null;
        participant_username: string | null;
      }>(
        `SELECT is_group, is_blocked_by_me, is_blocked_by_them, messages_restricted_reason, 
                name, avatar_url, participant_avatar_url, participant_name, participant_username 
         FROM chats WHERE id = ?`,
        [chatId],
      );

      if (chatRow) {
        setIsGroup(chatRow.is_group === 1);
        setIsBlockedByMe(chatRow.is_blocked_by_me === 1);
        setIsBlockedByThem(chatRow.is_blocked_by_them === 1);
        setMessagesRestrictedReason(
          chatRow.messages_restricted_reason === "contacts" ||
            chatRow.messages_restricted_reason === "nobody"
            ? chatRow.messages_restricted_reason
            : null,
        );
        if (chatRow.is_group === 1) {
          if (chatRow.name) {
            setDisplayTitle(chatRow.name);
          }
          if (chatRow.avatar_url) {
            setParticipantAvatarUrl(chatRow.avatar_url);
          } else {
            setParticipantAvatarUrl("");
          }
        } else {
          const pName = chatRow.participant_name || chatRow.participant_username || "Unknown";
          setDisplayTitle(pName);
          if (chatRow.participant_avatar_url) {
            setParticipantAvatarUrl(chatRow.participant_avatar_url);
          }
        }
      }

      const chatListData = await getChats(token, chatId);
      const currentChat = chatListData.chats.find((c) => c.id === chatId);
      if (currentChat) {
        setIsGroup(!!currentChat.is_group);
        setIsBlockedByMe(!!currentChat.is_blocked_by_me);
        setIsBlockedByThem(!!currentChat.is_blocked_by_them);
        setMessagesRestrictedReason(
          currentChat.messages_restricted_reason === "contacts" ||
            currentChat.messages_restricted_reason === "nobody"
            ? currentChat.messages_restricted_reason
            : null,
        );
        setClearedAt(currentChat.cleared_at || null);
        if (currentChat.participant_store_id) {
          setParticipantStoreId(currentChat.participant_store_id);
        } else {
          setParticipantStoreId(null);
        }
        if (currentChat.is_group) {
          if (currentChat.name) {
            setDisplayTitle(currentChat.name);
          }
          if (currentChat.avatar_url) {
            setParticipantAvatarUrl(currentChat.avatar_url);
          } else {
            setParticipantAvatarUrl("");
          }
        } else {
          if (currentChat.participant_avatar_url) {
            setParticipantAvatarUrl(currentChat.participant_avatar_url);
          }
        }

        // Keep local SQLite database in sync
        await saveChats(chatListData.chats);
      }
    } catch (err) {
      console.error("Failed to load chat details for blocking status:", err);
    }
  }, [token, chatId]);

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

  const handleDeleteForMe = useCallback(async () => {
    if (selectedCount === 0) return;
    try {
      if (selectedMessageIds.length > 0) {
        for (const id of selectedMessageIds) {
          await deleteMessageForMeLocal(id);
        }
        setMessages((prev) =>
          prev.map((msg) =>
            selectedMessageIds.includes(msg.id)
              ? { ...msg, deleted_at: new Date().toISOString() }
              : msg,
          ),
        );
      }
      if (selectedCallIds.length > 0 && token) {
        await Promise.all(
          selectedCallIds.map((id) => deleteCallHistoryItem(token, id)),
        );
        setCalls((prev) =>
          prev.filter((call) => !selectedCallIds.includes(call.id)),
        );
      }
    } catch (err) {
      console.error("Error deleting selected items:", err);
      Alert.alert("Erro", "Não foi possível apagar os itens selecionados.");
    }
    clearSelection();
    setDeleteModalVisible(false);
  }, [selectedCount, selectedMessageIds, selectedCallIds, token, clearSelection]);

  const handleDeleteForEveryone = useCallback(async () => {
    if (selectedMessageIds.length === 0 || selectedCallIds.length > 0 || !token)
      return;
    try {
      for (const id of selectedMessageIds) {
        await deleteMessageForEveryone(token, chatId, id);
      }
      setMessages((prev) =>
        prev.map((msg) =>
          selectedMessageIds.includes(msg.id)
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
        err.message || "Não foi possível apagar as mensagens para todos.",
      );
    }
    clearSelection();
    setDeleteModalVisible(false);
  }, [selectedMessageIds, selectedCallIds.length, token, chatId, clearSelection]);

  const handleCopy = useCallback(() => {
    const messageToCopy =
      selectedMessages.length === 1 ? selectedMessages[0] : null;
    if (messageToCopy?.content) {
      try {
        if (Platform.OS === "web") {
          if (navigator.clipboard) {
            navigator.clipboard.writeText(messageToCopy.content);
          } else {
            throw new Error("Web clipboard not available");
          }
        } else {
          Clipboard.setString(messageToCopy.content);
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
    clearSelection();
  }, [selectedMessages, clearSelection]);

  const handleReencaminhar = useCallback(
    (msg?: Message) => {
      const target =
        msg ?? (selectedMessages.length === 1 ? selectedMessages[0] : null);
      if (!target) {
        Alert.alert("Erro", "Selecione apenas uma mensagem para reencaminhar.");
        return;
      }
      if (target.deleted_for_everyone) return;
      setForwardingMessage(extractForwardData(target));
      clearSelection();
    },
    [selectedMessages, clearSelection],
  );

  const handleEncaminhar = useCallback(() => {
    if (selectedMessages.length === 0) return;

    const messagesToForward = selectedMessages.map((msg) =>
      extractForwardData(msg),
    );

    clearSelection();
    router.push({
      pathname: "/share-contact",
      params: {
        mode: "forward",
        forwardMessages: JSON.stringify(messagesToForward),
      },
    });
  }, [selectedMessages, clearSelection, router]);

  // Check if participant is a contact
  useEffect(() => {
    if (!token || !participantId) return;
    (async () => {
      try {
        const contactsList = await getContacts(token);
        const contact = contactsList.find(
          (c) => c.contact_id === participantId,
        );
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

  const handleToggleContact = useCallback(async () => {
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
  }, [token, participantId, isContact]);

  const handleMuteChats = useCallback(async (durationHours: number | "always") => {
    if (!token) return;

    try {
      await toggleMuteChat(token, chatId, durationHours);
      setMuteModalVisible(false);
    } catch (err) {
      console.error("Error muting chat:", err);
      Alert.alert("Erro", "Não foi possível silenciar as notificações.");
    }
  }, [token, chatId]);

  const handleBlockPress = useCallback(() => {
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
            const nextBlockState = !isBlockedByMe;
            await toggleBlockContact(token, participantId, chatId, nextBlockState);
            setIsBlockedByMe(nextBlockState);
          } catch (err: any) {
            Alert.alert(
              "Erro",
              err.message || "Não foi possível alterar o status de bloqueio.",
            );
          }
        },
      },
    ]);
  }, [token, participantId, isGroup, isBlockedByMe, chatId]);

  const handleClearChatPress = useCallback(() => {
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
              await clearChatHistory(token, chatId);
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
  }, [token, chatId]);

  const [selectedAttachment, setSelectedAttachment] =
    useState<Attachment | null>(null);
  const [attachSheetVisible, setAttachSheetVisible] = useState(false);
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [hasRecordingSession, setHasRecordingSession] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const recordingTimerRef = useRef<any>(null);
  const mediaRecorderRef = useRef<any>(null);
  const audioChunksRef = useRef<any[]>([]);
  const [isRecordingPaused, setIsRecordingPaused] = useState(false);
  const [recordedUri, setRecordedUri] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
    };
  }, []);

  const cacheMediaForMessages = useCallback(async (msgs: Message[]) => {
    for (const msg of msgs) {
      if (msg.image_url && !msg.local_file_path && !msg.deleted_for_everyone) {
        cacheMediaFile(msg.image_url, msg.id)
          .then((localPath) => {
            if (localPath.startsWith("file://")) {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === msg.id ? { ...m, local_file_path: localPath } : m,
                ),
              );
            }
          })
          .catch((err) => {
            console.warn("Background media caching failed:", err);
          });
      }
    }
  }, []);

  const loadMessages = useCallback(async () => {
    if (!token) return;
    try {
      const localMsgs = await getMessagesFromLocal(chatId);
      setMessages(localMsgs);

      cacheMediaForMessages(localMsgs);

      getCallHistory(token)
        .then((callData) => {
          setCalls(callData);
        })
        .catch((err) => {
          console.error("Failed to fetch call history:", err);
        });

      markChatRead(token, chatId).catch(() => {});
      await markChatReadLocal(chatId);

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

  useFocusEffect(
    useCallback(() => {
      loadMessages();
      loadChatDetails();
    }, [loadMessages, loadChatDetails])
  );

  useEffect(() => {
    if (callState === "idle") {
      loadMessages();
    }
  }, [callState, loadMessages]);

  useEffect(() => {
    if (!chatId) return;
    const unsubscribeSync = syncWorker.onMessagesChanged(chatId, async () => {
      try {
        const localMsgs = await getMessagesFromLocal(chatId);
        setMessages(localMsgs);
        cacheMediaForMessages(localMsgs);
      } catch (err) {
        console.error(
          "Failed to reload messages from SQLite on sync update:",
          err,
        );
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

        if (data.message.sender_id === user?.user_id) {
          getDatabase()
            .then(async (db) => {
              let attachmentType:
                | "image"
                | "video"
                | "audio"
                | "document"
                | null = null;
              if (
                data.message.attachments &&
                data.message.attachments.length > 0
              ) {
                attachmentType = data.message.attachments[0].type;
              } else if (data.message.image_url) {
                const urlLower = data.message.image_url.toLowerCase();
                if (
                  urlLower.endsWith(".jpg") ||
                  urlLower.endsWith(".jpeg") ||
                  urlLower.endsWith(".png") ||
                  urlLower.endsWith(".gif") ||
                  urlLower.endsWith(".webp")
                ) {
                  attachmentType = "image";
                } else if (
                  urlLower.endsWith(".mp4") ||
                  urlLower.endsWith(".mov") ||
                  urlLower.endsWith(".webm") ||
                  urlLower.endsWith(".mkv") ||
                  urlLower.endsWith(".avi")
                ) {
                  attachmentType = "video";
                } else if (
                  urlLower.endsWith(".mp3") ||
                  urlLower.endsWith(".wav") ||
                  urlLower.endsWith(".m4a") ||
                  urlLower.endsWith(".caf") ||
                  urlLower.endsWith(".ogg") ||
                  urlLower.endsWith(".opus")
                ) {
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
                  [chatId, user?.user_id || "", attachmentType],
                );
              } else {
                pending = await db.getFirstAsync<{ id: string }>(
                  "SELECT id FROM messages WHERE chat_id = ? AND sender_id = ? AND content = ? AND (status = 'pending' OR status = 'uploading' OR status = 'sending')",
                  [chatId, user?.user_id || "", data.message.content || ""],
                );
              }

              if (pending) {
                await db.runAsync("DELETE FROM messages WHERE id = ?", [
                  pending.id,
                ]);
              }
              await saveMessages([data.message]);
              syncWorker.notifyMessagesChanged(chatId);
            })
            .catch(console.error);
        } else {
          saveMessages([data.message])
            .then(() => {
              syncWorker.notifyMessagesChanged(chatId);
            })
            .catch(console.error);
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
        deleteMessageLocal(data.message_id)
          .then(() => {
            syncWorker.notifyMessagesChanged(chatId);
          })
          .catch(console.error);
      }
    });

    const unsubClear = wsClient.on("messages_cleared", (data) => {
      if (data.chat_id === chatId) {
        clearChatMessagesLocal(chatId)
          .then(() => {
            setCalls([]);
            setClearedAt(new Date().toISOString());
            syncWorker.notifyMessagesChanged(chatId);
          })
          .catch(console.error);
      }
    });

    const unsubRead = wsClient.on("messages_read", (data) => {
      if (data.chat_id === chatId && data.reader_id !== user?.user_id) {
        markSentMessagesReadLocal(chatId, user?.user_id || "", data.read_at)
          .then(() => {
            syncWorker.notifyMessagesChanged(chatId);
          })
          .catch(console.error);
      }
    });

    const unsubDelivered = wsClient.on("messages_delivered", (data) => {
      if (data.chat_id === chatId && data.receiver_id !== user?.user_id) {
        markSentMessagesDeliveredLocal(chatId, user?.user_id || "")
          .then(() => {
            syncWorker.notifyMessagesChanged(chatId);
          })
          .catch(console.error);
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

  const handleSend = useCallback(async (customAttachment?: any, customText?: string) => {
    const validAttachment =
      customAttachment &&
      typeof customAttachment === "object" &&
      typeof customAttachment.uri === "string"
        ? (customAttachment as Attachment)
        : null;

    const attachmentInfo = validAttachment || selectedAttachment;
    const hasContent = (customText || content).trim().length > 0;
    const hasAttachment = attachmentInfo !== null;
    const hasForward = forwardingMessage !== null;

    if (
      (!hasContent && !hasAttachment && !hasForward && !sending) ||
      !token ||
      sending
    )
      return;

    if (attachmentInfo && attachmentInfo.size !== undefined) {
      const validation = validateAttachmentSize(
        attachmentInfo.size,
        attachmentInfo.type,
        attachmentInfo.name,
        attachmentInfo.mimeType || "",
      );

      if (!validation.valid) {
        Alert.alert(
          "Arquivo muito grande",
          `O tamanho do arquivo excede o limite permitido para ${validation.label}.`,
        );
        return;
      }
    }

    const messageContentText = customText || content;
    const forwardData = forwardingMessage;
    if (!customText) {
      setContent("");
    }
    setSelectedAttachment(null);
    setForwardingMessage(null);

    let finalContent = messageContentText || null;
    if (forwardData) {
      finalContent = buildForwardContent(forwardData, messageContentText);
    }

    const localId = generateUUIDv7();
    
    let attType = attachmentInfo?.type;
    if (attachmentInfo && !attType) {
      const mime = attachmentInfo.mimeType || "";
      if (mime.startsWith("image/")) attType = "image";
      else if (mime.startsWith("video/")) attType = "video";
      else if (mime.startsWith("audio/")) attType = "audio";
      else attType = "document";
    }

    const newLocalMsg: Message = {
      id: localId,
      chat_id: chatId,
      sender_id: user?.user_id || "",
      sender_username: user?.username || "",
      content: finalContent,
      image_url: null,
      local_file_path: attachmentInfo?.uri || null,
      created_at: new Date().toISOString(),
      status: attachmentInfo ? "uploading" : "pending",
      deleted_for_everyone: false,
      attachments: attachmentInfo
        ? [
            {
              id: localId + "_att",
              message_id: localId,
              type: attType || "document",
              remote_url: "",
              local_path: attachmentInfo.uri,
              mime_type: attachmentInfo.mimeType || null,
              width: null,
              height: null,
              duration: attachmentInfo.duration || null,
              size: attachmentInfo.size || null,
              sha256: null,
              thumbnail_path: null,
              download_status: "downloaded",
            } as any,
          ]
        : undefined,
    };

    try {
      await insertMessageLocal(newLocalMsg);
      syncWorker.notifyMessagesChanged(chatId);
      syncWorker.triggerSync(chatId);
    } catch (dbErr) {
      console.error("Failed to save message to local SQLite:", dbErr);
    }
  }, [content, selectedAttachment, forwardingMessage, token, chatId, user, sending]);

  const handlePickFromGallery = useCallback(async () => {
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

      const isVideo = asset.type === "video" || (asset as any).mediaType === "video" || asset.mimeType?.startsWith("video/");
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
  }, []);

  const handlePickFile = useCallback(async () => {
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
  }, []);

  const handlePickDocument = useCallback(async () => {
    if (!token) return;

    if (Platform.OS === "web") {
      handlePickFile();
      return;
    }

    setAttachSheetVisible(true);
  }, [token, handlePickFile]);

  const startRecording = useCallback(async () => {
    setIsRecordingPaused(false);
    setRecordedUri(null);
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
  }, [recorder]);

  const handlePauseResumeRecording = useCallback(async () => {
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
  }, [recorder, hasRecordingSession, isRecordingPaused]);

  const stopRecording = useCallback(async (shouldKeep: boolean) => {
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
  }, [recorder, hasRecordingSession, recordingDuration]);

  const stopRecordingAndPreview = useCallback(async () => {
    setIsRecordingPaused(false);
    if (Platform.OS === "web") {
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

        const audioBlob = new Blob(audioChunksRef.current, {
          type: "audio/webm",
        });
        const uri = URL.createObjectURL(audioBlob);
        setRecordedUri(uri);
        
        mediaRecorderRef.current = null;
        audioChunksRef.current = [];
      };

      recorder.stop();
      return;
    }

    if (!hasRecordingSession) return;

    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }

    try {
      await recorder.stop();
      await setAudioModeAsync({ allowsRecording: false });

      const uri = recorder.uri;
      if (uri) {
        setRecordedUri(uri);
      }
    } catch (err: any) {
      Alert.alert("Erro ao parar gravação", err.message);
    } finally {
      setHasRecordingSession(false);
    }
  }, [recorder, hasRecordingSession]);

  const sendRecordingImmediately = useCallback(async () => {
    setIsRecordingPaused(false);
    if (Platform.OS === "web") {
      setIsRecording(false);
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }

      const recorder = mediaRecorderRef.current;
      if (!recorder) return;

      recorder.onstop = async () => {
        if (recorder.stream) {
          recorder.stream.getTracks().forEach((track: any) => track.stop());
        }

        const audioBlob = new Blob(audioChunksRef.current, {
          type: "audio/webm",
        });
        const uri = URL.createObjectURL(audioBlob);
        
        const fileExtension = "opus";
        const mimeType = "audio/webm";
        const att: Attachment = {
          uri,
          name: `audio_${Date.now()}.${fileExtension}`,
          type: "audio",
          mimeType,
          duration: recordingDuration,
          size: audioBlob.size,
        };
        await handleSend(att);

        mediaRecorderRef.current = null;
        audioChunksRef.current = [];
        setRecordedUri(null);
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

      const uri = recorder.uri;
      if (uri) {
        const att: Attachment = {
          uri,
          name: `audio_${Date.now()}.m4a`,
          type: "audio",
          mimeType: "audio/m4a",
          duration: recordingDuration,
        };
        await handleSend(att);
      }
    } catch (err: any) {
      Alert.alert("Erro ao parar gravação", err.message);
    } finally {
      setHasRecordingSession(false);
      setRecordedUri(null);
    }
  }, [recorder, hasRecordingSession, recordingDuration, handleSend]);

  const sendPreviewedAudio = useCallback(async () => {
    if (!recordedUri) return;
    const fileExtension = Platform.OS === "web" ? "opus" : "m4a";
    const mimeType = Platform.OS === "web" ? "audio/webm" : "audio/m4a";
    const att: Attachment = {
      uri: recordedUri,
      name: `audio_${Date.now()}.${fileExtension}`,
      type: "audio",
      mimeType,
      duration: recordingDuration,
    };
    await handleSend(att);
    setIsRecording(false);
    setRecordedUri(null);
  }, [recordedUri, recordingDuration, handleSend]);

  const discardRecording = useCallback(() => {
    if (recordedUri) {
      setRecordedUri(null);
      setIsRecording(false);
      setRecordingDuration(0);
    } else {
      stopRecording(false);
    }
  }, [recordedUri, stopRecording]);

  const isDeleteForEveryoneAvailable = useMemo(() => {
    if (selectedMessages.length === 0 || selectedCallIds.length > 0)
      return false;
    const now = Date.now();
    return selectedMessages.every((msg) => {
      if (msg.sender_id !== user?.user_id) return false;
      const sentTime = new Date(msg.created_at).getTime();
      const ageInHours = (now - sentTime) / (1000 * 60 * 60);
      return ageInHours < 24;
    });
  }, [selectedMessages, selectedCallIds.length, user?.user_id]);

  const deleteModalTitle = useMemo(() => {
    if (hasOnlyCallsSelected) {
      return selectedCallIds.length === 1
        ? "Deseja apagar a ligação?"
        : `Deseja apagar ${selectedCallIds.length} ligações?`;
    }
    if (hasOnlyMessagesSelected) {
      return selectedMessageIds.length === 1
        ? "Deseja apagar a mensagem?"
        : `Deseja apagar ${selectedMessageIds.length} mensagens?`;
    }
    return `Deseja apagar ${selectedCount} itens?`;
  }, [
    hasOnlyCallsSelected,
    hasOnlyMessagesSelected,
    selectedCallIds.length,
    selectedMessageIds.length,
    selectedCount,
  ]);

  const handleUnblock = useCallback(async () => {
    if (!token || !participantId) return;
    try {
      await toggleBlockContact(token, participantId, chatId, false);
      setIsBlockedByMe(false);
      Alert.alert("Sucesso", "Contato desbloqueado.");
    } catch (err: any) {
      Alert.alert(
        "Erro",
        err.message || "Não foi possível desbloquear o contato.",
      );
    }
  }, [token, participantId, chatId]);

  return {
    chatId,
    participantId,
    participantUsername,
    participantAvatarUrl,
    displayTitle,
    isKeyboardVisible,
    messages,
    calls,
    isLoading,
    content,
    setContent,
    sending,
    menuVisible,
    setMenuVisible,
    muteModalVisible,
    setMuteModalVisible,
    isContact,
    selectedMessageIds,
    selectedCallIds,
    deleteModalVisible,
    setDeleteModalVisible,
    optionsModalVisible,
    setOptionsModalVisible,
    forwardingMessage,
    setForwardingMessage,
    selectedCount,
    isSelectionMode,
    hasOnlyMessagesSelected,
    hasOnlyCallsSelected,
    clearSelection,
    toggleMessageSelection,
    toggleCallSelection,
    isBlockedByMe,
    setIsBlockedByMe,
    isBlockedByThem,
    messagesRestrictedReason,
    clearedAt,
    isGroup,
    chatItems,
    selectedAttachment,
    setSelectedAttachment,
    attachSheetVisible,
    setAttachSheetVisible,
    isRecording,
    recordingDuration,
    isRecordingPaused,
    recordedUri,
    handleDeleteForMe,
    handleDeleteForEveryone,
    handleCopy,
    handleReencaminhar,
    handleEncaminhar,
    handleToggleContact,
    handleMuteChats,
    handleBlockPress,
    handleClearChatPress,
    handlePickFromGallery,
    handlePickFile,
    handlePickDocument,
    startRecording,
    handlePauseResumeRecording,
    handleSend,
    stopRecording,
    stopRecordingAndPreview,
    sendRecordingImmediately,
    sendPreviewedAudio,
    discardRecording,
    isDeleteForEveryoneAvailable,
    deleteModalTitle,
    handleUnblock,
    participantStoreId,
    user,
    token,
  };
}
