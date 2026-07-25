"use client";

import { useEffect, useRef, useState, useCallback, Suspense } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useAuth } from "@/lib/auth-context";
import { useCall, type WSMessageData } from "@/lib/call-context";
import { getImageUrl } from "@/lib/utils";
import {
  getChats,
  getMessages,
  sendMessage,
  markChatRead,
  createChat,
  uploadFile,
  favoriteChat,
  muteChat,
  clearChatMessages,
  blockContact,
  unblockContact,
  archiveChat,
  type ChatListItem,
  type Message,
} from "@/lib/api";
import {
  Paperclip,
  Smile,
  MoreVertical,
  MessageSquare,
  Check,
  CheckCheck,
  X,
  Loader2,
  Clock,
  ArrowLeft,
  Phone,
  Video,
  SendHorizonal,
  Star,
  StarOff,
  Bell,
  BellOff,
  Trash2,
  Ban,
  User,
  ShieldAlert,
  Mic,
} from "lucide-react";
import ChatSidebar from "@/components/ChatSidebar";
import { EmojiGifStickerPicker } from "@/components/EmojiGifStickerPicker";
import { AudioPlayer } from "@/components/AudioPlayer";
import { VoiceNoteRecorderBar } from "@/components/VoiceNoteRecorderBar";

const isAudioUrl = (url?: string | null) =>
  !!url &&
  (/\.(m4a|mp3|wav|caf|ogg|3gp|opus|webm)(\?.*)?$/i.test(url) ||
    url.toLowerCase().includes("audio") ||
    url.toLowerCase().includes("voice_note") ||
    url.startsWith("blob:"));

const getPinnedChatIds = (): string[] => {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem("zapi_pinned_chats");
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
};

const savePinnedChatIds = (ids: string[]) => {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem("zapi_pinned_chats", JSON.stringify(ids));
  } catch (err) {
    console.error("Error saving pinned chats:", err);
  }
};

const applyPinnedState = (chatsList: ChatListItem[]): ChatListItem[] => {
  const pinnedIds = getPinnedChatIds();
  return chatsList.map((c) => ({
    ...c,
    is_pinned: pinnedIds.includes(c.id),
  }));
};

function ConversasContent() {
  const { token, user } = useAuth();
  const { startCall, addWSListener, sendWSMessage } = useCall();
  const router = useRouter();

  // Auth Guard
  useEffect(() => {
    const storedToken = localStorage.getItem("token");
    if (!token && !storedToken) {
      router.replace("/login");
    }
  }, [token, router]);



  const [chats, setChats] = useState<ChatListItem[]>([]);
  const [selectedChat, setSelectedChat] = useState<ChatListItem | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingChats, setLoadingChats] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [inputText, setInputText] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  // Audio recording states
  const [isRecording, setIsRecording] = useState(false);
  const [isRecordingPaused, setIsRecordingPaused] = useState(false);
  const [recordedUri, setRecordedUri] = useState<string | null>(null);
  const [recordingDuration, setRecordingDuration] = useState(0);

  // Modal & menu states
  const [showMuteModal, setShowMuteModal] = useState(false);
  const [showClearModal, setShowClearModal] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [showContactModal, setShowContactModal] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recordingTimerRef = useRef<NodeJS.Timeout | number | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Sync total unread count to GlobalSidebar
  useEffect(() => {
    const totalUnread = chats.reduce((acc, c) => acc + (c.unread_count || 0), 0);
    window.dispatchEvent(
      new CustomEvent("zapi_unread_count_update", { detail: totalUnread })
    );
  }, [chats]);

  // Helpers
  const loadChatList = useCallback(async () => {
    if (!token) return;
    try {
      setLoadingChats(true);
      const res = await getChats(token);
      setChats(applyPinnedState(res.chats || []));
    } catch (err) {
      console.error("Error fetching chats:", err);
    } finally {
      setLoadingChats(false);
    }
  }, [token]);

  const updateChatsListWithNewMessage = useCallback(
    (newMsg: Message) => {
      setChats((prevChats) => {
        const chatIndex = prevChats.findIndex((c) => c.id === newMsg.chat_id);

        if (chatIndex > -1) {
          const updatedChats = [...prevChats];
          const targetChat = { ...updatedChats[chatIndex] };

          targetChat.last_message =
            newMsg.content ||
            (newMsg.image_url
              ? isAudioUrl(newMsg.image_url)
                ? "🎙️ Áudio"
                : "[Imagem]"
              : "[Mídia]");
          targetChat.last_message_at = newMsg.created_at;

          // Only increment unread if it is not selected
          if (!selectedChat || selectedChat.id !== newMsg.chat_id) {
            targetChat.unread_count = (targetChat.unread_count || 0) + 1;
          }

          // Remove from current position and move to index 0 (top)
          updatedChats.splice(chatIndex, 1);
          return [targetChat, ...updatedChats];
        } else {
          // Chat not found locally, load entire list from API
          loadChatList();
          return prevChats;
        }
      });
    },
    [selectedChat, loadChatList],
  );

  // Load chats on mount and handle optional URL query parameters (chatId / participantId)
  useEffect(() => {
    let active = true;
    const init = async () => {
      await Promise.resolve();
      if (!active) return;

      await loadChatList();

      if (!token) return;
      const searchParams = new URLSearchParams(window.location.search);
      const participantId =
        searchParams.get("participantId") || searchParams.get("startChat");
      const chatId = searchParams.get("chatId");

      if (!participantId && !chatId) return;

      try {
        if (chatId) {
          const chatsRes = await getChats(token);
          if (!active) return;
          setChats(applyPinnedState(chatsRes.chats || []));
          const found = chatsRes.chats?.find((c) => c.id === chatId);
          if (found) setSelectedChat(found);
        } else if (participantId) {
          if (user?.id && participantId === user.id) return;
          const res = await createChat(token, participantId);
          const chatsRes = await getChats(token);
          if (!active) return;
          setChats(applyPinnedState(chatsRes.chats || []));
          const found = chatsRes.chats?.find(
            (c) => c.id === res.id || c.participant_id === participantId
          );
          if (found) setSelectedChat(found);
        }
      } catch (err) {
        console.error("Error setting chat from URL query params:", err);
      }
    };
    init();
    return () => {
      active = false;
    };
  }, [loadChatList, token, user?.id]);

  // Load messages when selectedChat changes
  useEffect(() => {
    let active = true;
    if (!token || !selectedChat) {
      const reset = async () => {
        await Promise.resolve();
        if (active) setMessages([]);
      };
      reset();
      return;
    }

    const fetchMsgs = async () => {
      await Promise.resolve();
      if (!active) return;
      setLoadingMessages(true);
      try {
        const res = await getMessages(token, selectedChat.id);
        if (!active) return;
        setMessages(res.messages);
        setLoadingMessages(false);
        // Mark read
        if (selectedChat.unread_count > 0) {
          markChatRead(token, selectedChat.id).catch(console.error);
          setChats((prev) =>
            prev.map((c) =>
              c.id === selectedChat.id ? { ...c, unread_count: 0 } : c,
            ),
          );
        }
      } catch (err) {
        if (!active) return;
        console.error("Error loading messages:", err);
        setLoadingMessages(false);
      }
    };
    fetchMsgs();

    return () => {
      active = false;
    };
  }, [selectedChat, token]);

  // WebSocket Listener via CallProvider
  useEffect(() => {
    if (!token || !user) return;

    const removeListener = addWSListener((data: WSMessageData) => {
      if (data.type === "new_message") {
        const newMsg = data.message as Message;

        // 1. Update messages list if it is the current chat
        if (selectedChat && newMsg.chat_id === selectedChat.id) {
          setMessages((prev) => {
            // Avoid duplicates
            if (prev.some((m) => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });

          // Send delivered ack to server
          if (newMsg.sender_id !== user.user_id) {
            sendWSMessage({
              type: "delivered_ack",
              chat_id: selectedChat.id,
            });
            markChatRead(token, selectedChat.id).catch(console.error);
          }
        }

        // 2. Update chats list preview and order
        updateChatsListWithNewMessage(newMsg);
      } else if (data.type === "new_message_notification") {
        const newMsg = data.message as Message;
        updateChatsListWithNewMessage(newMsg);
      } else if (data.type === "chat_list_update") {
        loadChatList();
      }
    });

    return () => {
      removeListener();
    };
  }, [
    token,
    user,
    selectedChat,
    loadChatList,
    updateChatsListWithNewMessage,
    addWSListener,
    sendWSMessage,
  ]);

  const discardRecording = useCallback(() => {
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }

    const recorder = mediaRecorderRef.current;
    if (recorder) {
      recorder.onstop = null;
      if (recorder.stream) {
        recorder.stream.getTracks().forEach((track) => track.stop());
      }
      try {
        if (recorder.state !== "inactive") recorder.stop();
      } catch {
        // ignore
      }
      mediaRecorderRef.current = null;
    }
    audioChunksRef.current = [];

    setRecordedUri((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });

    setIsRecording(false);
    setIsRecordingPaused(false);
    setRecordingDuration(0);
  }, []);

  // Subscribe to new chat rooms as activeChatId changes
  useEffect(() => {
    Promise.resolve().then(() => discardRecording());
    if (!selectedChat) return;
    sendWSMessage({ type: "subscribe", chat_id: selectedChat.id });
    return () => {
      if (selectedChat) {
        sendWSMessage({ type: "unsubscribe", chat_id: selectedChat.id });
      }
    };
  }, [selectedChat, sendWSMessage, discardRecording]);

  // Audio Recording Handlers & Cleanup
  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.stream) {
        mediaRecorderRef.current.stream
          .getTracks()
          .forEach((track) => track.stop());
      }
    };
  }, []);

  const startRecording = useCallback(async () => {
    setIsRecordingPaused(false);
    setRecordedUri(null);

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

      mediaRecorder.start(100);
      setIsRecording(true);
      setRecordingDuration(0);

      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
    } catch {
      alert(
        "Erro ao acessar o microfone: Permissão negada ou não suportada no navegador.",
      );
    }
  }, []);

  const handlePauseResumeRecording = useCallback(() => {
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
      } catch (err) {
        console.error("Failed to resume recording:", err);
      }
    } else {
      try {
        recorder.pause();
        setIsRecordingPaused(true);
        if (recordingTimerRef.current) {
          clearInterval(recordingTimerRef.current);
          recordingTimerRef.current = null;
        }
      } catch (err) {
        console.error("Failed to pause recording:", err);
      }
    }
  }, [isRecordingPaused]);

  const stopRecordingAndPreview = useCallback(() => {
    setIsRecordingPaused(false);
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }

    const recorder = mediaRecorderRef.current;
    if (!recorder) return;

    recorder.onstop = () => {
      const audioBlob = new Blob(audioChunksRef.current, {
        type: recorder.mimeType || "audio/webm",
      });
      const uri = URL.createObjectURL(audioBlob);
      setRecordedUri(uri);
    };

    if (recorder.state !== "inactive") {
      recorder.stop();
    }
  }, []);

  const sendAudioBlob = useCallback(
    async (audioBlob: Blob) => {
      if (!token || !selectedChat) return;

      const file = new File([audioBlob], `audio_${Date.now()}.webm`, {
        type: audioBlob.type || "audio/webm",
      });

      const tempId = `temp-${Date.now()}`;
      const localUri = URL.createObjectURL(audioBlob);

      const tempMsg: Message = {
        id: tempId,
        chat_id: selectedChat.id,
        sender_id: user?.user_id || "",
        sender_username: user?.username || "",
        content: null,
        image_url: localUri,
        status: "sending",
        created_at: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, tempMsg]);
      setTimeout(
        () => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }),
        50,
      );

      try {
        setUploadingFile(true);
        const uploadRes = await uploadFile(token, file);
        const res = await sendMessage(
          token,
          selectedChat.id,
          "",
          uploadRes.url,
        );

        if (res.message) {
          setMessages((prev) => {
            const hasOfficial = prev.some((m) => m.id === res.message.id);
            if (hasOfficial) {
              return prev.filter((m) => m.id !== tempId);
            }
            return prev.map((m) =>
              m.id === tempId ? { ...res.message, status: "sent" } : m,
            );
          });
          updateChatsListWithNewMessage(res.message);
        }
      } catch (err) {
        console.error("Failed to send audio message:", err);
        setMessages((prev) =>
          prev.map((m) => (m.id === tempId ? { ...m, status: "failed" } : m)),
        );
      } finally {
        setUploadingFile(false);
        discardRecording();
      }
    },
    [
      token,
      selectedChat,
      user,
      updateChatsListWithNewMessage,
      discardRecording,
    ],
  );

  const sendRecordingImmediately = useCallback(async () => {
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }

    const recorder = mediaRecorderRef.current;
    if (!recorder) return;

    recorder.onstop = async () => {
      if (recorder.stream) {
        recorder.stream.getTracks().forEach((track) => track.stop());
      }
      const audioBlob = new Blob(audioChunksRef.current, {
        type: recorder.mimeType || "audio/webm",
      });
      await sendAudioBlob(audioBlob);
    };

    if (recorder.state !== "inactive") {
      recorder.stop();
    } else {
      const audioBlob = new Blob(audioChunksRef.current, {
        type: "audio/webm",
      });
      await sendAudioBlob(audioBlob);
    }
  }, [sendAudioBlob]);

  const sendPreviewedAudio = useCallback(async () => {
    if (!recordedUri) return;
    try {
      const response = await fetch(recordedUri);
      const audioBlob = await response.blob();
      await sendAudioBlob(audioBlob);
    } catch (err) {
      console.error("Error sending previewed audio:", err);
    }
  }, [recordedUri, sendAudioBlob]);

  // Auto-scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loadingMessages]);

  // Send message handler
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!token || !selectedChat) return;
    if (!inputText.trim() && !selectedFile) return;

    let imageUrl: string | undefined = undefined;

    try {
      // 1. If there's a file, upload it first
      if (selectedFile) {
        setUploadingFile(true);
        const uploadRes = await uploadFile(token, selectedFile);
        imageUrl = uploadRes.url;
        setSelectedFile(null);
        setFilePreview(null);
        setUploadingFile(false);
      }

      const textToSend = inputText.trim();
      setInputText("");
      setShowEmojiPicker(false);

      // Create a temporary message for optimistic UI
      const tempId = "temp-" + Date.now();
      const tempMsg: Message = {
        id: tempId,
        chat_id: selectedChat.id,
        sender_id: user?.user_id || "",
        sender_username: user?.username || "",
        content: textToSend || null,
        image_url: imageUrl || null,
        created_at: new Date().toISOString(),
        status: "sending",
      };

      setMessages((prev) => [...prev, tempMsg]);

      // 2. Call send API
      const res = await sendMessage(
        token,
        selectedChat.id,
        textToSend,
        imageUrl,
      );

      // Replace temporary message with the official server message
      setMessages((prev) => {
        const hasOfficial = prev.some((m) => m.id === res.message.id);
        if (hasOfficial) {
          return prev.filter((m) => m.id !== tempId);
        }
        return prev.map((m) =>
          m.id === tempId ? { ...res.message, status: "sent" } : m,
        );
      });

      // Update chats list locally
      updateChatsListWithNewMessage(res.message);
    } catch (err) {
      console.error("Failed to send message:", err);
      setUploadingFile(false);
    }
  };

  const handleSendDirectMedia = async (mediaUrl: string) => {
    if (!token || !selectedChat) return;
    setShowEmojiPicker(false);

    const tempId = "temp-" + Date.now();
    const tempMsg: Message = {
      id: tempId,
      chat_id: selectedChat.id,
      sender_id: user?.user_id || "",
      sender_username: user?.username || "",
      content: null,
      image_url: mediaUrl,
      created_at: new Date().toISOString(),
      status: "sending",
    };

    setMessages((prev) => [...prev, tempMsg]);

    try {
      const res = await sendMessage(token, selectedChat.id, "", mediaUrl);
      setMessages((prev) => {
        const hasOfficial = prev.some((m) => m.id === res.message.id);
        if (hasOfficial) {
          return prev.filter((m) => m.id !== tempId);
        }
        return prev.map((m) =>
          m.id === tempId ? { ...res.message, status: "sent" } : m,
        );
      });
      updateChatsListWithNewMessage(res.message);
    } catch (err) {
      console.error("Failed to send direct media:", err);
    }
  };

  const handleStartChat = async (participantId: string) => {
    if (!token) return;
    try {
      const res = await createChat(token, participantId);

      // Refresh chat list, find the active chat and select it
      const chatsRes = await getChats(token);
      setChats(applyPinnedState(chatsRes.chats || []));

      const openedChat = chatsRes.chats.find((c) => c.id === res.id);
      if (openedChat) {
        setSelectedChat(openedChat);
      } else {
        // Fallback
        loadChatList();
      }
    } catch (err) {
      console.error("Failed to create/start chat:", err);
    }
  };

  const handleSelectChat = (chat: ChatListItem) => {
    setSelectedChat(chat);
  };

  // Image upload picker
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setFilePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleMuteChat = async (forever: boolean, hours?: number) => {
    if (!token || !selectedChat) return;
    try {
      setActionLoading(true);
      let mutedUntil: string | null = null;
      if (!forever && hours) {
        const date = new Date();
        date.setHours(date.getHours() + hours);
        mutedUntil = date.toISOString();
      }
      await muteChat(token, selectedChat.id, forever, mutedUntil);
      const updated: ChatListItem = {
        ...selectedChat,
        notification_muted_forever: forever,
        notification_muted_until: mutedUntil,
      };
      setSelectedChat(updated);
      setChats((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
      setShowMuteModal(false);
    } catch (err) {
      console.error("Error muting chat:", err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleFavorite = async () => {
    if (!token || !selectedChat) return;
    try {
      const newFav = !selectedChat.is_favorite;
      await favoriteChat(token, selectedChat.id, newFav);
      const updated: ChatListItem = { ...selectedChat, is_favorite: newFav };
      setSelectedChat(updated);
      setChats((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
    } catch (err) {
      console.error("Error toggling favorite:", err);
    }
  };

  const handleClearChat = async () => {
    if (!token || !selectedChat) return;
    try {
      setActionLoading(true);
      await clearChatMessages(token, selectedChat.id);
      setMessages([]);
      setShowClearModal(false);
      setShowMoreMenu(false);
    } catch (err) {
      console.error("Error clearing chat:", err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleBlock = async () => {
    if (!token || !selectedChat || !selectedChat.participant_id) return;
    try {
      setActionLoading(true);
      const isBlocked = !!selectedChat.is_blocked_by_me;
      if (isBlocked) {
        await unblockContact(token, selectedChat.participant_id);
      } else {
        await blockContact(token, selectedChat.participant_id);
      }
      const updated: ChatListItem = {
        ...selectedChat,
        is_blocked_by_me: !isBlocked,
      };
      setSelectedChat(updated);
      setChats((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
      setShowBlockModal(false);
      setShowMoreMenu(false);
    } catch (err) {
      console.error("Error toggling block status:", err);
    } finally {
      setActionLoading(false);
    }
  };

  // Sidebar action handlers
  const handleArchiveChatFromSidebar = async (chatId: string) => {
    if (!token) return;
    try {
      const chat = chats.find((c) => c.id === chatId);
      if (!chat) return;
      const newArchived = !chat.is_archived;
      await archiveChat(token, chatId, newArchived);
      setChats((prev) =>
        prev.map((c) =>
          c.id === chatId ? { ...c, is_archived: newArchived } : c,
        ),
      );
      if (selectedChat?.id === chatId) {
        setSelectedChat((prev) =>
          prev ? { ...prev, is_archived: newArchived } : prev,
        );
      }
    } catch (err) {
      console.error("Error toggling archive:", err);
    }
  };

  const handlePinChatFromSidebar = (chatId: string) => {
    setChats((prev) => {
      const updatedChats = prev.map((c) =>
        c.id === chatId ? { ...c, is_pinned: !c.is_pinned } : c,
      );
      const pinnedIds = updatedChats.filter((c) => c.is_pinned).map((c) => c.id);
      savePinnedChatIds(pinnedIds);
      return updatedChats;
    });
    if (selectedChat?.id === chatId) {
      setSelectedChat((prev) =>
        prev ? { ...prev, is_pinned: !prev.is_pinned } : prev,
      );
    }
  };

  const handleFavoriteChatFromSidebar = async (chatId: string) => {
    if (!token) return;
    try {
      const chat = chats.find((c) => c.id === chatId);
      if (!chat) return;
      const newFav = !chat.is_favorite;
      await favoriteChat(token, chatId, newFav);
      setChats((prev) =>
        prev.map((c) => (c.id === chatId ? { ...c, is_favorite: newFav } : c)),
      );
      if (selectedChat?.id === chatId) {
        setSelectedChat((prev) =>
          prev ? { ...prev, is_favorite: newFav } : prev,
        );
      }
    } catch (err) {
      console.error("Error toggling favorite:", err);
    }
  };

  const handleClearChatFromSidebar = async (chatId: string) => {
    if (!token) return;
    try {
      await clearChatMessages(token, chatId);
      if (selectedChat?.id === chatId) {
        setMessages([]);
      }
      setChats((prev) =>
        prev.map((c) =>
          c.id === chatId
            ? { ...c, last_message: null, last_message_at: null }
            : c,
        ),
      );
    } catch (err) {
      console.error("Error clearing chat:", err);
    }
  };

  // Sort chats: pinned first, then by last_message_at
  const sortedChats = [...chats].sort((a, b) => {
    if (a.is_pinned && !b.is_pinned) return -1;
    if (!a.is_pinned && b.is_pinned) return 1;
    const dateA = a.last_message_at ? new Date(a.last_message_at).getTime() : 0;
    const dateB = b.last_message_at ? new Date(b.last_message_at).getTime() : 0;
    return dateB - dateA;
  });

  return (
    <div className="flex flex-col h-full w-full bg-background overflow-hidden text-foreground">
      {/* Main Chat Workspace Card */}
      <div className="flex-1 min-h-0 border border-card-border bg-surface overflow-hidden flex shadow-lg">
        {/* Left Side: Chats List Sidebar */}
        <ChatSidebar
          chats={sortedChats}
          loadingChats={loadingChats}
          selectedChat={selectedChat}
          onSelectChat={handleSelectChat}
          onStartChat={handleStartChat}
          token={token}
          currentUserId={user?.user_id}
          onArchiveChat={handleArchiveChatFromSidebar}
          onPinChat={handlePinChatFromSidebar}
          onFavoriteChat={handleFavoriteChatFromSidebar}
          onClearChat={handleClearChatFromSidebar}
          onRefreshChats={loadChatList}
        />

        {/* Right Section - Main Chat View / Empty State */}
        <div className="flex-1 flex flex-col h-full bg-background relative overflow-hidden">
          {selectedChat ? (
            <>
              {/* Active Chat Header */}
              <div className="p-4 border-b border-card-border bg-card-bg/60 backdrop-blur-md flex items-center justify-between z-10">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setSelectedChat(null)}
                    className="md:hidden p-2 text-muted-text hover:text-foreground rounded-lg"
                  >
                    <ArrowLeft className="h-5 w-5" />
                  </button>

                  <div
                    onClick={() => setShowContactModal(true)}
                    className="h-10 w-10 rounded-full overflow-hidden bg-neutral-200 dark:bg-neutral-700 flex items-center justify-center font-bold text-sm shadow-inner flex-shrink-0 cursor-pointer hover:opacity-90 transition-opacity"
                  >
                    {selectedChat.participant_avatar_url ||
                    selectedChat.avatar_url ? (
                      <Image
                        src={getImageUrl(
                          selectedChat.participant_avatar_url ||
                            selectedChat.avatar_url,
                        )}
                        alt="Avatar"
                        width={40}
                        height={40}
                        className="h-full w-full object-cover"
                        unoptimized
                      />
                    ) : (
                      (
                        selectedChat.participant_name ||
                        selectedChat.participant_username ||
                        selectedChat.name ||
                        "C"
                      )
                        .charAt(0)
                        .toUpperCase()
                    )}
                  </div>

                  <div
                    onClick={() => setShowContactModal(true)}
                    className="cursor-pointer hover:opacity-90 transition-opacity"
                  >
                    <div className="flex items-center gap-1.5">
                      <h2 className="font-bold text-sm">
                        {selectedChat.participant_name ||
                          selectedChat.participant_username ||
                          selectedChat.name ||
                          "Contato"}
                      </h2>
                      {(selectedChat.notification_muted_forever ||
                        selectedChat.notification_muted_until) && (
                        <BellOff className="h-3.5 w-3.5 text-muted-text opacity-70" />
                      )}
                    </div>
                    <p className="text-xs text-muted-text">
                      {selectedChat.is_blocked_by_me ? (
                        <span className="text-red-500 font-medium">
                          Contato Bloqueado
                        </span>
                      ) : !selectedChat.is_group &&
                        selectedChat.participant_store_id ? (
                        "Conta comercial"
                      ) : selectedChat.participant_username ? (
                        `@${selectedChat.participant_username}`
                      ) : (
                        "Online"
                      )}
                    </p>
                  </div>
                </div>

                {/* Call & More Options Header Buttons */}
                <div className="flex items-center gap-1">
                  <button
                    onClick={() =>
                      startCall({
                        targetUserId:
                          selectedChat.participant_id || selectedChat.id,
                        targetUsername:
                          selectedChat.participant_name ||
                          selectedChat.participant_username ||
                          selectedChat.name ||
                          "Contato",
                        isVideo: true,
                        avatarUrl:
                          selectedChat.participant_avatar_url ||
                          selectedChat.avatar_url,
                      })
                    }
                    title="Chamada de vídeo"
                    className="p-2 text-muted-text hover:text-foreground rounded-lg hover:bg-neutral-100 dark:hover:bg-white/5 transition-colors cursor-pointer"
                  >
                    <Video className="h-5 w-5" />
                  </button>

                  <button
                    onClick={() =>
                      startCall({
                        targetUserId:
                          selectedChat.participant_id || selectedChat.id,
                        targetUsername:
                          selectedChat.participant_name ||
                          selectedChat.participant_username ||
                          selectedChat.name ||
                          "Contato",
                        isVideo: false,
                        avatarUrl:
                          selectedChat.participant_avatar_url ||
                          selectedChat.avatar_url,
                      })
                    }
                    title="Chamada de voz"
                    className="p-2 text-muted-text hover:text-foreground rounded-lg hover:bg-neutral-100 dark:hover:bg-white/5 transition-colors cursor-pointer"
                  >
                    <Phone className="h-5 w-5" />
                  </button>

                  {/* MoreVertical Button & Dropdown Menu */}
                  <div className="relative">
                    <button
                      onClick={() => setShowMoreMenu((prev) => !prev)}
                      title="Mais opções"
                      className="p-2 text-muted-text hover:text-foreground rounded-lg hover:bg-neutral-100 dark:hover:bg-white/5 transition-colors cursor-pointer"
                    >
                      <MoreVertical className="h-5 w-5" />
                    </button>

                    {/* Popover Dropdown Menu */}
                    {showMoreMenu && (
                      <>
                        <div
                          className="fixed inset-0 z-20"
                          onClick={() => setShowMoreMenu(false)}
                        />
                        <div className="absolute right-0 mt-2 w-60 bg-card-bg border border-card-border rounded-2xl shadow-2xl z-30 py-2 backdrop-blur-md animate-fadeIn">
                          {/* 1. Ver contato */}
                          <button
                            onClick={() => {
                              setShowMoreMenu(false);
                              setShowContactModal(true);
                            }}
                            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-foreground hover:bg-neutral-100 dark:hover:bg-white/5 transition-colors text-left font-medium cursor-pointer"
                          >
                            <User className="h-4 w-4 text-muted-text" />
                            <span>Ver contato</span>
                          </button>

                          {/* 2. Silenciar notificações */}
                          <button
                            onClick={() => {
                              setShowMoreMenu(false);
                              if (
                                selectedChat.notification_muted_forever ||
                                selectedChat.notification_muted_until
                              ) {
                                handleMuteChat(false);
                              } else {
                                setShowMuteModal(true);
                              }
                            }}
                            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-foreground hover:bg-neutral-100 dark:hover:bg-white/5 transition-colors text-left font-medium cursor-pointer"
                          >
                            {selectedChat.notification_muted_forever ||
                            selectedChat.notification_muted_until ? (
                              <>
                                <Bell className="h-4 w-4 text-amber-500" />
                                <span>Desativar silêncio</span>
                              </>
                            ) : (
                              <>
                                <BellOff className="h-4 w-4 text-muted-text" />
                                <span>Silenciar notificações</span>
                              </>
                            )}
                          </button>

                          {/* 3. Remover dos favoritos / Adicionar aos favoritos */}
                          <button
                            onClick={handleToggleFavorite}
                            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-foreground hover:bg-neutral-100 dark:hover:bg-white/5 transition-colors text-left font-medium cursor-pointer"
                          >
                            {selectedChat.is_favorite ? (
                              <>
                                <StarOff className="h-4 w-4 text-amber-500 fill-amber-500/20" />
                                <span>Remover dos favoritos</span>
                              </>
                            ) : (
                              <>
                                <Star className="h-4 w-4 text-muted-text" />
                                <span>Adicionar aos favoritos</span>
                              </>
                            )}
                          </button>

                          {/* 4. Limpar conversa */}
                          <button
                            onClick={() => {
                              setShowMoreMenu(false);
                              setShowClearModal(true);
                            }}
                            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-foreground hover:bg-neutral-100 dark:hover:bg-white/5 transition-colors text-left font-medium cursor-pointer"
                          >
                            <Trash2 className="h-4 w-4 text-muted-text" />
                            <span>Limpar conversa</span>
                          </button>

                          <div className="my-1.5 border-t border-card-border" />

                          {/* 5. Bloquear / Desbloquear */}
                          <button
                            onClick={() => {
                              setShowMoreMenu(false);
                              if (selectedChat.is_blocked_by_me) {
                                handleToggleBlock();
                              } else {
                                setShowBlockModal(true);
                              }
                            }}
                            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-500/10 transition-colors text-left font-semibold cursor-pointer"
                          >
                            <Ban className="h-4 w-4" />
                            <span>
                              {selectedChat.is_blocked_by_me
                                ? "Desbloquear"
                                : "Bloquear"}
                            </span>
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Messages viewport */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {loadingMessages ? (
                  <div className="flex flex-col items-center justify-center h-48 text-muted-text">
                    <Loader2 className="h-8 w-8 animate-spin" />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex items-center justify-center h-48 text-muted-text text-sm">
                    Nenhuma mensagem ainda...
                  </div>
                ) : (
                  messages.map((msg, index) => {
                    const isOwn = msg.sender_id === user?.user_id;
                    return (
                      <div
                        key={msg.id || index}
                        className={`flex ${isOwn ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`max-w-[70%] px-4 py-2 rounded-2xl ${
                            isOwn
                              ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 rounded-br-none"
                              : "bg-neutral-100 dark:bg-neutral-800 rounded-bl-none"
                          }`}
                        >
                          {/* Image or Audio Attachment */}
                          {msg.image_url &&
                            (isAudioUrl(msg.image_url) ? (
                              <AudioPlayer uri={msg.image_url} isMine={isOwn} />
                            ) : (
                              <div className="mb-2 rounded-xl overflow-hidden max-h-60 bg-black/10 flex items-center justify-center">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={msg.image_url}
                                  alt="Anexo / Figurinha / GIF"
                                  className="max-h-60 max-w-full object-contain rounded-xl"
                                  loading="lazy"
                                />
                              </div>
                            ))}

                          {/* Text Message Content */}
                          {msg.content && (
                            <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
                              {msg.content}
                            </p>
                          )}

                          {/* Timestamp & Status */}
                          <div
                            className={`flex items-center justify-end gap-1 mt-1 text-[10px] ${
                              isOwn
                                ? "text-white/70 dark:text-neutral-500"
                                : "text-muted-text"
                            }`}
                          >
                            <span>
                              {new Date(msg.created_at).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                            {isOwn && (
                              <span>
                                {msg.status === "read" ? (
                                  <CheckCheck className="h-3.5 w-3.5 text-blue-400 dark:text-blue-600" />
                                ) : (
                                  <Check className="h-3.5 w-3.5" />
                                )}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Message Input Box */}
              <div className="p-3 pb-5 backdrop-blur-md">
                {/* File Attachment Preview */}
                {selectedFile && (
                  <div className="mb-2 p-2 bg-neutral-100 dark:bg-neutral-800/80 rounded-xl flex items-center justify-between border border-card-border animate-fadeIn">
                    <div className="flex items-center gap-2 overflow-hidden">
                      {filePreview ? (
                        <div className="h-10 w-10 rounded-lg overflow-hidden flex-shrink-0">
                          <Image
                            src={filePreview}
                            alt="Preview"
                            width={40}
                            height={40}
                            className="h-full w-full object-cover"
                          />
                        </div>
                      ) : (
                        <Paperclip className="h-5 w-5 text-muted-text ml-2 flex-shrink-0" />
                      )}
                      <span className="text-xs font-medium truncate max-w-[200px]">
                        {selectedFile.name}
                      </span>
                    </div>
                    <button
                      onClick={() => {
                        setSelectedFile(null);
                        setFilePreview(null);
                      }}
                      className="p-1 text-muted-text hover:text-foreground rounded-lg"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                )}

                {isRecording || recordedUri ? (
                  <div className="bg-neutral-100 dark:bg-neutral-800/60 border border-card-border rounded-2xl p-1.5 transition-all">
                    <VoiceNoteRecorderBar
                      recordingDuration={recordingDuration}
                      isPaused={isRecordingPaused}
                      onPauseResumeRecording={handlePauseResumeRecording}
                      onStopRecording={discardRecording}
                      recordedUri={recordedUri}
                      onStopAndPreview={stopRecordingAndPreview}
                      onSendAudio={
                        recordedUri
                          ? sendPreviewedAudio
                          : sendRecordingImmediately
                      }
                    />
                  </div>
                ) : (
                  <form
                    onSubmit={handleSendMessage}
                    className="flex items-center gap-1.5 relative  border border-card-border rounded-full p-1.5 pl-3 transition-all"
                  >
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileSelect}
                      className="hidden"
                      accept="image/*,video/*,application/pdf"
                    />

                    {/* Attachment Button */}
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="p-2 text-muted-text hover:text-foreground rounded-xl hover:bg-neutral-200/60 dark:hover:bg-white/10 transition-colors cursor-pointer"
                      title="Anexar arquivo"
                    >
                      <Paperclip className="h-5 w-5" />
                    </button>

                    {/* Emoji Button */}
                    <button
                      type="button"
                      onClick={() => setShowEmojiPicker((prev) => !prev)}
                      className="p-2 text-muted-text hover:text-foreground rounded-xl hover:bg-neutral-200/60 dark:hover:bg-white/10 transition-colors cursor-pointer"
                      title="Emojis"
                    >
                      <Smile className="h-5 w-5" />
                    </button>

                    {/* Text Input */}
                    <input
                      type="text"
                      value={inputText}
                      onChange={(e) => setInputText(e.target.value)}
                      placeholder="Digite uma mensagem..."
                      className="flex-1 bg-transparent border-none outline-none focus:outline-none focus:ring-0 px-2 py-1.5 text-sm text-foreground placeholder-gray-400"
                    />

                    {/* Send or Mic Button */}
                    {!inputText.trim() && !selectedFile ? (
                      <button
                        type="button"
                        onClick={startRecording}
                        className="p-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-full transition-all cursor-pointer flex-shrink-0 shadow-md active:scale-95"
                        title="Gravar áudio"
                      >
                        <Mic className="h-5 w-5" />
                      </button>
                    ) : (
                      <button
                        type="submit"
                        disabled={
                          (!inputText.trim() && !selectedFile) || uploadingFile
                        }
                        className="p-2.5 bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 rounded-full hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer flex-shrink-0 shadow-md"
                      >
                        {uploadingFile ? (
                          <Loader2 className="h-5 w-5 animate-spin" />
                        ) : (
                          <SendHorizonal className="h-5 w-5" />
                        )}
                      </button>
                    )}

                    {/* Quick Emoji, GIF, and Sticker Picker Popover */}
                    {showEmojiPicker && (
                      <div className="absolute bottom-16 left-2 z-50">
                        <EmojiGifStickerPicker
                          onSelectEmoji={(emoji) =>
                            setInputText((prev) => prev + emoji)
                          }
                          onSelectGif={(gifUrl) =>
                            handleSendDirectMedia(gifUrl)
                          }
                          onSelectSticker={(stickerUrl) =>
                            handleSendDirectMedia(stickerUrl)
                          }
                          onClose={() => setShowEmojiPicker(false)}
                        />
                      </div>
                    )}
                  </form>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-muted-text">
              <MessageSquare className="h-16 w-16 mb-4 opacity-20" />
              <p className="text-lg font-medium">Selecione uma conversa</p>
            </div>
          )}
        </div>
      </div>

      {/* MODALS */}

      {/* 1. Modal: Ver Contato */}
      {showContactModal && selectedChat && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-card-bg border border-card-border rounded-3xl p-6 w-full max-w-md shadow-2xl relative">
            <button
              onClick={() => setShowContactModal(false)}
              className="absolute top-4 right-4 p-2 text-muted-text hover:text-foreground rounded-full hover:bg-neutral-100 dark:hover:bg-white/5 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex flex-col items-center text-center">
              <div className="h-24 w-24 rounded-full overflow-hidden bg-neutral-200 dark:bg-neutral-700 flex items-center justify-center text-2xl font-bold mb-4 shadow-md border-2 border-neutral-300 dark:border-neutral-600">
                {selectedChat.participant_avatar_url ||
                selectedChat.avatar_url ? (
                  <Image
                    src={getImageUrl(
                      selectedChat.participant_avatar_url ||
                        selectedChat.avatar_url,
                    )}
                    alt="Contact"
                    width={96}
                    height={96}
                    className="h-full w-full object-cover"
                    unoptimized
                  />
                ) : (
                  (
                    selectedChat.participant_name ||
                    selectedChat.participant_username ||
                    selectedChat.name ||
                    "C"
                  )
                    .charAt(0)
                    .toUpperCase()
                )}
              </div>

              <h3 className="text-xl font-bold">
                {selectedChat.participant_name ||
                  selectedChat.participant_username ||
                  selectedChat.name ||
                  "Contato"}
              </h3>
              {!selectedChat.is_group && selectedChat.participant_store_id ? (
                <p className="text-sm text-muted-text mt-0.5 font-medium">
                  Conta comercial
                </p>
              ) : selectedChat.participant_username ? (
                <p className="text-sm text-muted-text mt-0.5">
                  @{selectedChat.participant_username}
                </p>
              ) : null}

              <div className="w-full grid grid-cols-2 gap-3 mt-6">
                <button
                  onClick={() => {
                    setShowContactModal(false);
                    startCall({
                      targetUserId:
                        selectedChat.participant_id || selectedChat.id,
                      targetUsername:
                        selectedChat.participant_name ||
                        selectedChat.participant_username ||
                        selectedChat.name ||
                        "Contato",
                      isVideo: false,
                      avatarUrl:
                        selectedChat.participant_avatar_url ||
                        selectedChat.avatar_url,
                    });
                  }}
                  className="flex items-center justify-center gap-2 p-3 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-2xl text-sm font-semibold transition-all cursor-pointer"
                >
                  <Phone className="h-4 w-4" />
                  <span>Voz</span>
                </button>
                <button
                  onClick={() => {
                    setShowContactModal(false);
                    startCall({
                      targetUserId:
                        selectedChat.participant_id || selectedChat.id,
                      targetUsername:
                        selectedChat.participant_name ||
                        selectedChat.participant_username ||
                        selectedChat.name ||
                        "Contato",
                      isVideo: true,
                      avatarUrl:
                        selectedChat.participant_avatar_url ||
                        selectedChat.avatar_url,
                    });
                  }}
                  className="flex items-center justify-center gap-2 p-3 bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 hover:opacity-90 rounded-2xl text-sm font-semibold transition-all cursor-pointer"
                >
                  <Video className="h-4 w-4" />
                  <span>Vídeo</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. Modal: Silenciar Notificações */}
      {showMuteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-card-bg border border-card-border rounded-3xl p-6 w-full max-w-sm shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <BellOff className="h-5 w-5 text-amber-500" />
                Silenciar Notificações
              </h3>
              <button
                onClick={() => setShowMuteModal(false)}
                className="p-1 text-muted-text hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="text-xs text-muted-text mb-4">
              Escolha por quanto tempo deseja silenciar as notificações desta
              conversa:
            </p>
            <div className="space-y-2">
              <button
                onClick={() => handleMuteChat(false, 8)}
                disabled={actionLoading}
                className="w-full p-3 text-left font-medium text-sm rounded-2xl bg-neutral-100 dark:bg-neutral-800/80 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors flex items-center justify-between cursor-pointer"
              >
                <span>8 Horas</span>
                <Clock className="h-4 w-4 text-muted-text" />
              </button>
              <button
                onClick={() => handleMuteChat(false, 168)}
                disabled={actionLoading}
                className="w-full p-3 text-left font-medium text-sm rounded-2xl bg-neutral-100 dark:bg-neutral-800/80 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors flex items-center justify-between cursor-pointer"
              >
                <span>1 Semana</span>
                <Clock className="h-4 w-4 text-muted-text" />
              </button>
              <button
                onClick={() => handleMuteChat(true)}
                disabled={actionLoading}
                className="w-full p-3 text-left font-medium text-sm rounded-2xl bg-neutral-100 dark:bg-neutral-800/80 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors flex items-center justify-between cursor-pointer"
              >
                <span>Sempre</span>
                <BellOff className="h-4 w-4 text-muted-text" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. Modal: Limpar Conversa */}
      {showClearModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-card-bg border border-card-border rounded-3xl p-6 w-full max-w-sm shadow-2xl text-center">
            <div className="h-14 w-14 rounded-2xl bg-red-500/10 text-red-500 flex items-center justify-center mx-auto mb-4">
              <Trash2 className="h-7 w-7" />
            </div>
            <h3 className="text-lg font-bold mb-2">Limpar esta conversa?</h3>
            <p className="text-xs text-muted-text mb-6">
              Todas as mensagens desta conversa serão apagadas permanentemente
              para você.
            </p>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowClearModal(false)}
                disabled={actionLoading}
                className="flex-1 py-2.5 text-sm font-semibold rounded-xl border border-card-border hover:bg-neutral-100 dark:hover:bg-white/5 transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleClearChat}
                disabled={actionLoading}
                className="flex-1 py-2.5 text-sm font-semibold rounded-xl bg-red-600 hover:bg-red-700 text-white transition-colors cursor-pointer flex items-center justify-center gap-2"
              >
                {actionLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                Limpar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. Modal: Bloquear Contato */}
      {showBlockModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-card-bg border border-card-border rounded-3xl p-6 w-full max-w-sm shadow-2xl text-center">
            <div className="h-14 w-14 rounded-2xl bg-red-500/10 text-red-500 flex items-center justify-center mx-auto mb-4">
              <ShieldAlert className="h-7 w-7" />
            </div>
            <h3 className="text-lg font-bold mb-2">
              Bloquear{" "}
              {selectedChat?.participant_name ||
                selectedChat?.participant_username ||
                "contato"}
              ?
            </h3>
            <p className="text-xs text-muted-text mb-6">
              Este contato não poderá mais lhe enviar mensagens ou realizar
              chamadas pelo Zapi.
            </p>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowBlockModal(false)}
                disabled={actionLoading}
                className="flex-1 py-2.5 text-sm font-semibold rounded-xl border border-card-border hover:bg-neutral-100 dark:hover:bg-white/5 transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleToggleBlock}
                disabled={actionLoading}
                className="flex-1 py-2.5 text-sm font-semibold rounded-xl bg-red-600 hover:bg-red-700 text-white transition-colors cursor-pointer flex items-center justify-center gap-2"
              >
                {actionLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                Bloquear
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ConversasPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center bg-background">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
        </div>
      }
    >
      <ConversasContent />
    </Suspense>
  );
}
