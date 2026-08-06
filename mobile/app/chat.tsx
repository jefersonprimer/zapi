import { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Modal,
  ActivityIndicator,
  Keyboard,
  Image,
  Alert,
  Animated,
} from "react-native";
import { useStickerDrag } from "@/context/StickerDragContext";
import { placeStickerOnMessage, removePlacedSticker } from "@/services/placedStickersApi";
import { updateMessageStickersLocal } from "@/services/database";
import * as ImagePicker from "expo-image-picker";
import { useFocusEffect, useNavigation, useRouter } from "expo-router";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { voiceCallManager } from "@/services/voiceCallManager";
import { API_URL, PlacedSticker } from "@/services/api";
import { EmojiModal } from "@/components/EmojiModal";
import { GifModal } from "@/components/GifModal";
import { StickerModal } from "@/components/StickerModal";
import { ChatBlockedBar } from "@/components/ChatBlockedBar";
import { ChatDeleteModal } from "@/components/ChatDeleteModal";
import { ChatItemRow } from "@/components/ChatItemRow";
import { ChatInput } from "@/components/ChatInput";
import { AttachMediaSheet } from "@/components/AttachMediaSheet";
import { SendOrMicButton } from "@/components/SendOrMicButton";
import { ChatMenuModal } from "@/components/ChatMenuModal";
import MuteModal from "@/components/MuteModal";
import CreateListModal from "@/components/CreateListModal";
import ListSelectorModal from "@/components/ListSelectorModal";
import { VoiceNoteRecorderBar } from "@/components/VoiceNoteRecorderBar";
import { AttachmentPreviewBar } from "@/components/AttachmentPreviewBar";
import { ForwardPreviewBar } from "@/components/ForwardPreviewBar";
import { ChatActionsModal } from "@/components/ChatActionsModal";
import { DrawingCanvasModal } from "@/components/DrawingCanvasModal";
import { LocationPickerModal } from "@/components/LocationPickerModal";
import { ChatMessageOptionsModal } from "@/components/ChatMessageOptionsModal";
import { WebSearchBottomSheet } from "@/components/WebSearchBottomSheet";
import { SendLaterModal } from "@/components/SendLaterModal";
import { SendLaterPreviewBar } from "@/components/SendLaterPreviewBar";
import { useAppTheme } from "@/context/ThemeContext";
import { useAuth } from "@/context/AuthContext";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useChat } from "@/hooks/useChat";
import { useChatLists } from "@/hooks/useChatLists";
import { Ionicons } from "@expo/vector-icons";
import { analyzeMessageRules, analyzeMessageMultiIntents, IntentSuggestion } from "@/services/chatIntentEngine";
import { ItemEditBottomSheet } from "@/components/ItemEditBottomSheet";
import { ItemType } from "@/types/item";

export default function ChatScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const router = useRouter();
  const { colors, isDark } = useAppTheme();
  const {
    chatId,
    participantId,
    participantUsername,
    participantAvatarUrl,
    displayTitle,
    isKeyboardVisible,
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
    setSelectedMessageIds,
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
    clearSelection,
    toggleMessageSelection,
    toggleCallSelection,
    isBlockedByMe,
    isBlockedByThem,
    messagesRestrictedReason,
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
    startRecording,
    handlePauseResumeRecording,
    handleSend,
    sendRecordingImmediately,
    sendPreviewedAudio,
    discardRecording,
    stopRecordingAndPreview,
    isDeleteForEveryoneAvailable,
    deleteModalTitle,
    handleUnblock,
    participantStoreId,
    user,
    handleReact,
    restoreScheduledMessageToComposer,
    messages,
    setMessages,
    loadMessages,
    handleScheduleMessage,
  } = useChat();

  const { token } = useAuth();

  const handleRemoveSticker = async (msgId: string, stickerId: string) => {
    if (!token || !chatId) return;

    // Optimistic UI update
    setMessages((prev) =>
      prev.map((msg) => {
        if (msg.id === msgId) {
          const updatedStickers = (msg.placed_stickers || []).filter((s) => s.id !== stickerId);
          updateMessageStickersLocal(msgId, updatedStickers).catch(console.error);
          return { ...msg, placed_stickers: updatedStickers };
        }
        return msg;
      })
    );

    try {
      await removePlacedSticker(token, chatId, msgId, stickerId);
    } catch (err) {
      console.error("Failed to remove sticker:", err);
      loadMessages();
    }
  };

  const flatListRef = useRef<FlatList>(null);
  const flatListContainerRef = useRef<View>(null);
  const inputRef = useRef<any>(null);
  const shouldStickToBottomRef = useRef(true);
  const [activePicker, setActivePicker] = useState<"emoji" | "gif" | "sticker" | null>(null);
  const [actionsModalVisible, setActionsModalVisible] = useState(false);
  const [sendLaterVisible, setSendLaterVisible] = useState(false);
  const [scheduledDelayMs, setScheduledDelayMs] = useState<number | null>(null);
  const [webSearchVisible, setWebSearchVisible] = useState(false);
  const [locationPickerVisible, setLocationPickerVisible] = useState(false);
  const [drawingVisible, setDrawingVisible] = useState(false);
  const [msgOptionsVisible, setMsgOptionsVisible] = useState(false);
  const [onlyReactionsMode, setOnlyReactionsMode] = useState(false);
  const [reactionsByMe, setReactionsByMe] = useState<Record<string, boolean>>(
    {},
  );
  const [selectedMessageLayout, setSelectedMessageLayout] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);

  // Sticker Drag & Drop References and Hook
  const { draggingSticker, dragPosition, stopDragging, registerOnDrop } = useStickerDrag();
  const messageLayouts = useRef<Record<string, { x: number; y: number; width: number; height: number }>>({});
  const bubbleLayouts = useRef<Record<string, { x: number; y: number; width: number; height: number; pageX: number; pageY: number }>>({});
  const flatListScrollOffset = useRef(0);
  const flatListLayout = useRef({ x: 0, y: 0, width: 0, height: 0 });

  const dragScale = useRef(new Animated.Value(1.0)).current;
  const dragScaleVal = useRef(1.0);
  const initialDragDistance = useRef<number | null>(null);
  const initialDragScale = useRef(1.0);

  const dragRotation = useRef(new Animated.Value(0)).current;
  const dragRotationVal = useRef(0);
  const initialDragAngle = useRef<number | null>(null);
  const initialDragRotation = useRef(0);

  const hoveredMessageIdRef = useRef<string | null>(null);
  const hoverTimerRef = useRef<any>(null);
  const lastTouchCoordsRef = useRef({ x: 0, y: 0 });

  const clearHoverTimer = () => {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
    hoveredMessageIdRef.current = null;
  };

  useEffect(() => {
    if (draggingSticker) {
      dragScale.setValue(1.0);
      dragScaleVal.current = 1.0;
      dragRotation.setValue(0);
      dragRotationVal.current = 0;
      initialDragDistance.current = null;
      initialDragAngle.current = null;
      clearHoverTimer();
    }
  }, [draggingSticker, dragScale, dragRotation]);

  // Handle when a sticker is dropped onto a message
  useEffect(() => {
    registerOnDrop((stickerUrl, pageX, pageY) => {
      clearHoverTimer();

      // Find which message bubble contains (pageX, pageY) using the measured bounds from bubbleLayouts
      let foundMsgId: string | null = null;
      let relativeX = 0;
      let relativeY = 0;

      for (const [msgId, layout] of Object.entries(bubbleLayouts.current)) {
        if (
          pageX >= layout.pageX &&
          pageX <= layout.pageX + layout.width &&
          pageY >= layout.pageY &&
          pageY <= layout.pageY + layout.height
        ) {
          foundMsgId = msgId;
          relativeX = pageX - layout.pageX;
          relativeY = pageY - layout.pageY;
          break;
        }
      }

      if (foundMsgId) {
        const targetLayout = bubbleLayouts.current[foundMsgId];
        if (!targetLayout) return;

        // Limit coordinates to remain inside the message bubble bounds
        const xOffset = Math.max(10, Math.min(targetLayout.width - 10, relativeX));
        const localY = Math.max(10, Math.min(targetLayout.height - 10, relativeY));

        const tempId = `temp_${Date.now()}`;
        const tempSticker: PlacedSticker = {
          id: tempId,
          message_id: foundMsgId,
          user_id: user?.user_id || "",
          sticker_url: stickerUrl,
          x_offset: xOffset,
          y_offset: localY,
          scale_factor: dragScaleVal.current,
          rotation: dragRotationVal.current,
          created_at: new Date().toISOString()
        };

        // Optimistic Update
        setMessages((prev) =>
          prev.map((msg) => {
            if (msg.id === foundMsgId) {
              return { ...msg, placed_stickers: [...(msg.placed_stickers || []), tempSticker] };
            }
            return msg;
          })
        );

        if (token && chatId) {
          // Fire API to place sticker
          placeStickerOnMessage(token, chatId, foundMsgId, stickerUrl, xOffset, localY, dragScaleVal.current, dragRotationVal.current)
            .then((newPlaced) => {
              console.log("Sticker placed successfully on message:", foundMsgId);
              setMessages((prev) =>
                prev.map((msg) => {
                  if (msg.id === foundMsgId) {
                    const updatedStickers = (msg.placed_stickers || []).filter(s => s.id !== tempId);
                    updatedStickers.push(newPlaced);
                    updateMessageStickersLocal(foundMsgId, updatedStickers).catch(console.error);
                    return { ...msg, placed_stickers: updatedStickers };
                  }
                  return msg;
                })
              );
            })
            .catch((err) => {
              console.error("Failed to place sticker:", err);
              Alert.alert("Erro", "Não foi possível colocar a figurinha na mensagem.");
              // Revert optimistic update
              setMessages((prev) =>
                prev.map((msg) => {
                  if (msg.id === foundMsgId) {
                    return { ...msg, placed_stickers: (msg.placed_stickers || []).filter(s => s.id !== tempId) };
                  }
                  return msg;
                })
              );
            });
        }
      }
    });
  }, [token, chatId, registerOnDrop, messages, setMessages, user?.user_id]);

  const scrollToBottom = useCallback((animated = false) => {
    flatListRef.current?.scrollToEnd({ animated });
  }, []);

  useEffect(() => {
    shouldStickToBottomRef.current = true;
  }, [chatId]);

  useFocusEffect(
    useCallback(() => {
      shouldStickToBottomRef.current = true;
      const frame = requestAnimationFrame(() => scrollToBottom(false));
      return () => cancelAnimationFrame(frame);
    }, [scrollToBottom]),
  );

  useEffect(() => {
    if (!isLoading && chatItems.length > 0) {
      const frame = requestAnimationFrame(() => scrollToBottom(false));
      return () => cancelAnimationFrame(frame);
    }
  }, [isLoading, chatItems.length, scrollToBottom]);

  const handleContentSizeChange = useCallback(() => {
    if (shouldStickToBottomRef.current) {
      scrollToBottom(false);
    }
  }, [scrollToBottom]);

  const handleScroll = useCallback(
    (event: {
      nativeEvent: {
        layoutMeasurement: { height: number };
        contentOffset: { y: number };
        contentSize: { height: number };
      };
    }) => {
      const { layoutMeasurement, contentOffset, contentSize } =
        event.nativeEvent;
      flatListScrollOffset.current = contentOffset.y;
      const distanceFromBottom =
        contentSize.height - layoutMeasurement.height - contentOffset.y;
      shouldStickToBottomRef.current = distanceFromBottom < 80;
    },
    [],
  );

  const handleTakePhoto = async () => {
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (permission.status !== "granted") {
        Alert.alert(
          "Permissão Negada",
          "O acesso à câmera é necessário para tirar fotos.",
        );
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ["images", "videos"],
        quality: 0.8,
      });

      if (result.canceled || !result.assets || result.assets.length === 0)
        return;
      const asset = result.assets[0];

      const isVideo =
        asset.type === "video" ||
        (asset as any).mediaType === "video" ||
        asset.mimeType?.startsWith("video/");
      setSelectedAttachment({
        uri: asset.uri,
        name: isVideo ? `video_${Date.now()}.mp4` : `photo_${Date.now()}.jpg`,
        type: isVideo ? "video" : "image",
        mimeType: asset.mimeType || (isVideo ? "video/mp4" : "image/jpeg"),
        size: asset.fileSize,
      });
    } catch (err: any) {
      Alert.alert("Erro ao tirar foto", err.message);
    }
  };

  useEffect(() => {
    if (isKeyboardVisible) {
      setActivePicker(null);
      setAttachSheetVisible(false);
    }
  }, [isKeyboardVisible, setAttachSheetVisible, setActivePicker]);

  useEffect(() => {
    if (attachSheetVisible) {
      inputRef.current?.blur();
      Keyboard.dismiss();
      setActivePicker(null);
    }
  }, [attachSheetVisible, setActivePicker]);

  useEffect(() => {
    navigation.setOptions({
      headerShown: false,
    });
  }, [navigation]);

  const {
    listSelectorVisible,
    setListSelectorVisible,
    createListModalVisible,
    setCreateListModalVisible,
    allLists,
    selectedListIds,
    handleOpenListSelector,
    handleSaveLists,
    handleCreateList,
  } = useChatLists(chatId);

  // Bottom Sheet state
  const [bottomSheetVisible, setBottomSheetVisible] = useState(false);
  const [sheetType, setSheetType] = useState<ItemType>("note");
  const [sheetSuggestion, setSheetSuggestion] = useState<IntentSuggestion | null>(null);

  const openSheetForMessage = (msg: any, type: ItemType) => {
    const parsed = analyzeMessageRules(msg.content);
    setSheetType(type);
    setSheetSuggestion(
      parsed || {
        id: Math.random().toString(),
        type,
        intent: type,
        score: 100,
        confidence: 100,
        matchedText: msg.content,
        title: msg.content.slice(0, 35) || "Novo Item",
        content: msg.content,
        entities: {
          title: msg.content.slice(0, 35) || "Novo Item",
          content: msg.content,
        }
      }
    );
    setBottomSheetVisible(true);
  };

  // Debounce de 2.5s para analisar as últimas mensagens quando a conversa pausar
  useEffect(() => {
    if (!messages || messages.length === 0) return;

    const timer = setTimeout(() => {
      // Pega as últimas 5 mensagens
      const recent = messages.slice(-5);
      const combinedText = recent.map((m) => m.content).join("\n");
      const result = analyzeMessageRules(combinedText);

      // Só exibe a sugestão se a pontuação for >= 80 (ou IA remota)
      if (result && result.confidence >= 80) {
        // setActiveSuggestion(result);
      }
    }, 2500);

    return () => clearTimeout(timer);
  }, [messages]);

  const selectedMsg = messages.find((m) => selectedMessageIds.includes(m.id));
  const isMine = selectedMsg ? selectedMsg.sender_id === user?.user_id : false;
  const currentReaction = selectedMsg ? selectedMsg.reaction : null;
  const isScheduledSelected =
    selectedMsg?.status === "scheduled" &&
    selectedMsg.sender_id === user?.user_id;

  const handleAddStickerToSelectedMessage = useCallback(
    async (stickerUrl: string) => {
      if (!token || !chatId || !selectedMsg) return;

      const rowLayout = messageLayouts.current[selectedMsg.id];
      if (!rowLayout) return;

      const xOffset = selectedMsg.sender_id === user?.user_id
        ? Math.max(30, rowLayout.width - 30)
        : 30;
      const yOffset = Math.max(0, rowLayout.height - 8);

      const tempId = `temp_${Date.now()}`;
      const tempSticker: PlacedSticker = {
        id: tempId,
        message_id: selectedMsg.id,
        user_id: user?.user_id || "",
        sticker_url: stickerUrl,
        x_offset: xOffset,
        y_offset: yOffset,
        scale_factor: 1,
        rotation: 0,
        created_at: new Date().toISOString(),
      };

      setMessages((prev) =>
        prev.map((msg) => {
          if (msg.id === selectedMsg.id) {
            return { ...msg, placed_stickers: [...(msg.placed_stickers || []), tempSticker] };
          }
          return msg;
        })
      );

      try {
        const newPlaced = await placeStickerOnMessage(
          token,
          chatId,
          selectedMsg.id,
          stickerUrl,
          xOffset,
          yOffset,
          1,
          0
        );

        setMessages((prev) =>
          prev.map((msg) => {
            if (msg.id === selectedMsg.id) {
              const updatedStickers = (msg.placed_stickers || []).filter((s) => s.id !== tempId);
              updatedStickers.push(newPlaced);
              updateMessageStickersLocal(selectedMsg.id, updatedStickers).catch(console.error);
              return { ...msg, placed_stickers: updatedStickers };
            }
            return msg;
          })
        );
      } catch (err) {
        console.error("Failed to place sticker from menu:", err);
        Alert.alert("Erro", "Não foi possível adicionar o sticker.");
        setMessages((prev) =>
          prev.map((msg) => {
            if (msg.id === selectedMsg.id) {
              return { ...msg, placed_stickers: (msg.placed_stickers || []).filter((s) => s.id !== tempId) };
            }
            return msg;
          })
        );
      }
    },
    [token, chatId, selectedMsg, user?.user_id, setMessages]
  );

  const handleEditScheduledMessage = useCallback(async () => {
    if (!selectedMsg || !isScheduledSelected) return;

    const draft = await restoreScheduledMessageToComposer(selectedMsg.id);
    if (!draft) return;

    setContent(draft.content);
    setSelectedAttachment(draft.attachment);
    setScheduledDelayMs(draft.delayMs);
    setMsgOptionsVisible(false);
    setOnlyReactionsMode(false);
    setActivePicker(null);
    setAttachSheetVisible(false);
    inputRef.current?.focus();
    clearSelection();
  }, [
    selectedMsg,
    isScheduledSelected,
    restoreScheduledMessageToComposer,
    setContent,
    setSelectedAttachment,
    setAttachSheetVisible,
    setActivePicker,
    clearSelection,
  ]);

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
      <View
        style={{
          paddingTop: insets.top,
          backgroundColor: colors.surface,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            height: 60,
            paddingHorizontal: 16,
          }}
        >
          <View style={styles.headerLeftContainer}>
            <TouchableOpacity
              onPress={() =>
                isSelectionMode ? clearSelection() : router.back()
              }
              style={styles.headerBackBtn}
            >
              <Ionicons
                name="chevron-back-outline"
                size={24}
                color={colors.text}
              />
            </TouchableOpacity>
            {isSelectionMode && !msgOptionsVisible ? (
              <Text
                style={[
                  styles.headerTitleText,
                  { color: colors.text, marginLeft: 4 },
                ]}
              >
                {selectedCount}
              </Text>
            ) : null}
            {(!isSelectionMode || msgOptionsVisible) && (
              <TouchableOpacity
                onPress={() => {
                  if (isGroup) {
                    router.push({
                      pathname: "/group-detail",
                      params: {
                        chatId,
                        participantUsername: displayTitle,
                      },
                    });
                  } else if (participantId) {
                    router.push({
                      pathname: "/contact-detail",
                      params: {
                        participantId,
                        participantUsername: participantUsername || "Unknown",
                        chatId,
                        avatarUrl: participantAvatarUrl || undefined,
                      },
                    });
                  }
                }}
                style={styles.avatarTitleContainer}
              >
                <View
                  style={[
                    styles.avatarContainer,
                    {
                      backgroundColor: isGroup ? "#34C759" : colors.tint,
                    },
                  ]}
                >
                  {participantAvatarUrl ? (
                    <Image
                      source={{
                        uri: participantAvatarUrl.startsWith("http")
                          ? participantAvatarUrl
                          : `${API_URL}${participantAvatarUrl}`,
                      }}
                      style={styles.avatarImage}
                    />
                  ) : (
                    <Text style={styles.avatarPlaceholderText}>
                      {displayTitle[0]?.toUpperCase()}
                    </Text>
                  )}
                </View>
                <View style={{ flex: 1, justifyContent: "center" }}>
                  <Text
                    style={[
                      styles.headerTitleText,
                      { color: colors.text, flex: 0 },
                    ]}
                    numberOfLines={1}
                  >
                    {displayTitle}
                  </Text>
                  {participantStoreId ? (
                    <Text
                      style={[
                        styles.subTitleText,
                        { color: colors.textSecondary },
                      ]}
                      numberOfLines={1}
                    >
                      Conta Comercial
                    </Text>
                  ) : null}
                </View>
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.headerRightContainer}>
            {isSelectionMode && !msgOptionsVisible ? (
              <>
                {hasOnlyMessagesSelected && selectedMessageIds.length === 1 && (
                  <TouchableOpacity
                    onPress={() => handleReencaminhar()}
                    style={styles.headerActionBtn}
                  >
                    <MaterialCommunityIcons
                      name="reply-outline"
                      size={24}
                      color={colors.text}
                    />
                  </TouchableOpacity>
                )}
                {hasOnlyMessagesSelected && (
                  <TouchableOpacity
                    onPress={handleEncaminhar}
                    style={styles.headerActionBtn}
                  >
                    <MaterialCommunityIcons
                      name="share-all-outline"
                      size={24}
                      color={colors.text}
                    />
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  onPress={() => setDeleteModalVisible(true)}
                  style={styles.headerActionBtn}
                >
                  <MaterialCommunityIcons
                    name="delete-outline"
                    size={24}
                    color={colors.text}
                  />
                </TouchableOpacity>
                {hasOnlyMessagesSelected && selectedMessageIds.length === 1 && (
                  <TouchableOpacity
                    onPress={() => setOptionsModalVisible(true)}
                    style={styles.headerActionBtn}
                  >
                    <MaterialCommunityIcons
                      name="dots-vertical"
                      size={24}
                      color={colors.text}
                    />
                  </TouchableOpacity>
                )}
              </>
            ) : (
              <>
                {participantStoreId && (
                  <TouchableOpacity
                    onPress={() =>
                      router.push({
                        pathname: "/delivery/[storeId]",
                        params: { storeId: participantStoreId },
                      })
                    }
                    style={styles.headerActionBtn}
                  >
                    <MaterialCommunityIcons
                      name="shopping-outline"
                      size={24}
                      color={colors.tint}
                    />
                  </TouchableOpacity>
                )}
                {!participantStoreId && (
                  <TouchableOpacity
                    onPress={() =>
                      voiceCallManager.startCall(
                        participantId,
                        participantUsername || "Unknown",
                        true,
                        participantAvatarUrl,
                      )
                    }
                    style={styles.headerActionBtn}
                  >
                    <Ionicons
                      name="videocam-outline"
                      size={24}
                      color={colors.text}
                    />
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  onPress={() =>
                    voiceCallManager.startCall(
                      participantId,
                      participantUsername || "Unknown",
                      false,
                      participantAvatarUrl,
                    )
                  }
                  style={styles.headerActionBtn}
                >
                  <Ionicons name="call-outline" size={22} color={colors.text} />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setMenuVisible(true)}
                  style={styles.headerActionBtn}
                >
                  <MaterialCommunityIcons
                    name="dots-vertical"
                    size={24}
                    color={colors.text}
                  />
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </View>

      <View
        ref={flatListContainerRef}
        style={{ flex: 1 }}
        onLayout={() => {
          flatListContainerRef.current?.measure((x, y, width, height, pageX, pageY) => {
            flatListLayout.current = { x: pageX, y: pageY, width, height };
          });
        }}
      >
        <FlatList
          key={chatId}
          ref={flatListRef}
          data={chatItems}
          keyExtractor={(item) =>
            item.type === "message" ? item.data.id : `call_${item.data.id}`
          }
          onContentSizeChange={handleContentSizeChange}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          style={styles.messageList}
          contentContainerStyle={{
            padding: 16,
            paddingBottom:
              (isKeyboardVisible || attachSheetVisible
                ? 60
                : activePicker
                  ? 280 + (insets.bottom > 0 ? insets.bottom : 16) + 60
                  : insets.bottom + 60) + 16,
          }}
          renderItem={({ item, index }) => (
            <ChatItemRow
              item={item}
              index={index}
              chatItems={chatItems}
              selectedMessageIds={selectedMessageIds}
              selectedCallIds={selectedCallIds}
              isSelectionMode={isSelectionMode && !msgOptionsVisible}
              currentUserId={user?.user_id}
              isGroup={isGroup}
              participantId={participantId}
              participantUsername={participantUsername}
              participantAvatarUrl={participantAvatarUrl}
              onSwipeRight={handleReencaminhar}
              onLayoutMessage={(msgId, layout) => {
                messageLayouts.current[msgId] = layout;
              }}
              onMeasureBubble={(msgId, layout) => {
                bubbleLayouts.current[msgId] = layout;
              }}
              onToggleMessageSelection={(msg, layout, onlyReactions) => {
                if (selectedMessageIds.length > 0) {
                  toggleMessageSelection(msg);
                } else {
                  setSelectedMessageIds([msg.id]);
                  setSelectedMessageLayout(layout || null);
                  setOnlyReactionsMode(!!onlyReactions);
                  setMsgOptionsVisible(true);
                }
              }}
              onToggleCallSelection={toggleCallSelection}
              onCreateNote={(() => {
                if (item.type !== "message") return undefined;
                const multi = analyzeMessageMultiIntents(item.data.content);
                return multi.isNote ? (msg) => openSheetForMessage(msg, "note") : undefined;
              })()}
              onCreateReminder={(() => {
                if (item.type !== "message") return undefined;
                const multi = analyzeMessageMultiIntents(item.data.content);
                return multi.isReminder ? (msg) => openSheetForMessage(msg, "reminder") : undefined;
              })()}
              onCreateEvent={(() => {
                if (item.type !== "message") return undefined;
                const multi = analyzeMessageMultiIntents(item.data.content);
                return multi.isEvent ? (msg) => openSheetForMessage(msg, "event") : undefined;
              })()}
              onRemoveSticker={handleRemoveSticker}
            />
          )}
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
      </View>

      <View
        style={{
          position: "absolute",
          bottom: activePicker
            ? 280 + (insets.bottom > 0 ? insets.bottom : 16)
            : sendLaterVisible
              ? 280 + (insets.bottom > 0 ? insets.bottom : 16)
              : 0,
          left: 0,
          right: 0,
          zIndex: 10,
        }}
      >
        <View
          style={[
            styles.inputContainer,
            {
              paddingBottom:
                isKeyboardVisible ||
                activePicker !== null ||
                attachSheetVisible ||
                sendLaterVisible
                  ? 6
                  : insets.bottom,
              backgroundColor: "transparent",
            },
          ]}
        >
          {isBlockedByMe || isBlockedByThem || messagesRestrictedReason ? (
            <ChatBlockedBar
              isBlockedByMe={isBlockedByMe}
              isBlockedByThem={isBlockedByThem}
              messagesRestrictedReason={messagesRestrictedReason}
              onUnblock={handleUnblock}
            />
          ) : (
            <>
              {isRecording && (
                <VoiceNoteRecorderBar
                  recordingDuration={recordingDuration}
                  onStopRecording={discardRecording}
                  isPaused={isRecordingPaused}
                  onPauseResumeRecording={handlePauseResumeRecording}
                  recordedUri={recordedUri}
                  onStopAndPreview={stopRecordingAndPreview}
                  onSendAudio={
                    recordedUri ? sendPreviewedAudio : sendRecordingImmediately
                  }
                />
              )}

              <View
                style={
                  isRecording
                    ? {
                        position: "absolute",
                        opacity: 0,
                        width: 0,
                        height: 0,
                        overflow: "hidden",
                      }
                    : [
                        styles.inputContainerMessage,
                        {
                          backgroundColor: isDark
                            ? "rgba(30, 30, 30, 0.85)"
                            : "rgba(255, 255, 255, 0.85)",
                          borderColor: isDark
                            ? "rgba(255, 255, 255, 0.12)"
                            : "rgba(0, 0, 0, 0.08)",
                        },
                        (scheduledDelayMs !== null ||
                          selectedAttachment !== null ||
                          forwardingMessage !== null) && {
                          flexDirection: "column",
                          alignItems: "stretch",
                          borderRadius: 20,
                          paddingHorizontal: 0,
                          paddingVertical: 0,
                          overflow: "hidden",
                        },
                      ]
                }
                pointerEvents={isRecording ? "none" : "auto"}
              >
                {scheduledDelayMs !== null && (
                  <SendLaterPreviewBar
                    delayMs={scheduledDelayMs}
                    onPress={() => {
                      Keyboard.dismiss();
                      setSendLaterVisible(true);
                    }}
                    onClear={() => setScheduledDelayMs(null)}
                  />
                )}

                {selectedAttachment && (
                  <AttachmentPreviewBar
                    attachment={selectedAttachment}
                    onClear={() => setSelectedAttachment(null)}
                  />
                )}

                {forwardingMessage && (
                  <ForwardPreviewBar
                    forwarded={forwardingMessage}
                    onClear={() => setForwardingMessage(null)}
                  />
                )}

                <View
                  style={
                    scheduledDelayMs !== null ||
                    selectedAttachment !== null ||
                    forwardingMessage !== null
                      ? {
                          flexDirection: "row",
                          alignItems: "flex-end",
                          paddingHorizontal: 4,
                          paddingVertical: 4,
                        }
                      : {
                          flexDirection: "row",
                          alignItems: "flex-end",
                          flex: 1,
                        }
                  }
                >
                  <TouchableOpacity
                    style={[
                      styles.actionMenuButton,
                      {
                        backgroundColor: isDark
                          ? "rgba(255, 255, 255, 0.15)"
                          : "rgba(0, 0, 0, 0.06)",
                      },
                    ]}
                    onPress={() => {
                      setActivePicker(null);
                      setActionsModalVisible(true);
                    }}
                  >
                    <MaterialCommunityIcons
                      name="plus"
                      size={24}
                      color={colors.text}
                    />
                  </TouchableOpacity>

                  <ChatInput
                    ref={inputRef}
                    value={content}
                    onChangeText={setContent}
                    onFocus={() => {
                      setActivePicker(null);
                      setAttachSheetVisible(false);
                      setSendLaterVisible(false);
                    }}
                  />
                </View>
              </View>

              {!isRecording && (
                <SendOrMicButton
                  hasContent={
                    content.trim().length > 0 ||
                    selectedAttachment !== null ||
                    forwardingMessage !== null
                  }
                  sending={sending}
                  onSend={() => {
                    if (scheduledDelayMs !== null) {
                      handleScheduleMessage(scheduledDelayMs);
                      setScheduledDelayMs(null);
                    } else {
                      handleSend();
                    }
                  }}
                  onStartRecording={startRecording}
                />
              )}
            </>
          )}
        </View>
      </View>

      {activePicker === "emoji" && (
        <EmojiModal
          onEmojiSelected={(emojiObject) =>
            setContent((prev) => prev + emojiObject.emoji)
          }
          height={280}
        />
      )}
      {activePicker === "gif" && (
        <GifModal
          onSendMedia={(media) => {
            setSelectedAttachment(media);
            setActivePicker(null);
          }}
          height={280}
        />
      )}
      {activePicker === "sticker" && (
        <StickerModal
          onSendMedia={(media) => {
            setSelectedAttachment(media);
            setActivePicker(null);
          }}
          height={280}
        />
      )}

      {sendLaterVisible && (
        <SendLaterModal
          initialDelayMs={scheduledDelayMs || undefined}
          onClose={() => setSendLaterVisible(false)}
          onSchedule={(delayMs) => {
            setScheduledDelayMs(delayMs);
          }}
        />
      )}

      {attachSheetVisible && (
        <AttachMediaSheet
          visible={attachSheetVisible}
          onClose={() => setAttachSheetVisible(false)}
          onPickGallery={handlePickFromGallery}
          onPickDocument={handlePickFile}
          onSelectMedia={setSelectedAttachment}
        />
      )}

      {menuVisible && (
        <ChatMenuModal
          visible={menuVisible}
          onClose={() => setMenuVisible(false)}
          isContact={isContact}
          isGroup={isGroup}
          isBlocked={isBlockedByMe}
          onToggleContact={handleToggleContact}
          onMutePress={() => setMuteModalVisible(true)}
          onBlockPress={handleBlockPress}
          onClearChatPress={handleClearChatPress}
          onAddToListPress={handleOpenListSelector}
          onViewContact={
            isGroup
              ? () => {
                  router.push({
                    pathname: "/group-detail",
                    params: {
                      chatId,
                      participantUsername: displayTitle,
                    },
                  });
                }
              : participantId
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
      )}

      {muteModalVisible && (
        <MuteModal
          visible={muteModalVisible}
          onClose={() => setMuteModalVisible(false)}
          onMute={handleMuteChats}
        />
      )}

      {listSelectorVisible && (
        <ListSelectorModal
          visible={listSelectorVisible}
          onClose={() => setListSelectorVisible(false)}
          userLists={allLists}
          initialSelectedListIds={selectedListIds}
          onSave={handleSaveLists}
          onCreateNewList={() => {
            setListSelectorVisible(false);
            setCreateListModalVisible(true);
          }}
        />
      )}

      {createListModalVisible && (
        <CreateListModal
          visible={createListModalVisible}
          onClose={() => {
            setCreateListModalVisible(false);
            setListSelectorVisible(true);
          }}
          onSubmit={handleCreateList}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deleteModalVisible && (
        <ChatDeleteModal
          visible={deleteModalVisible}
          onClose={() => setDeleteModalVisible(false)}
          deleteModalTitle={deleteModalTitle}
          isDeleteForEveryoneAvailable={isDeleteForEveryoneAvailable}
          onDeleteForEveryone={handleDeleteForEveryone}
          onDeleteForMe={handleDeleteForMe}
        />
      )}

      {/* Options/Ellipsis Dropdown Modal */}
      {optionsModalVisible && (
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
                <Text
                  style={[styles.dropdownOptionText, { color: colors.text }]}
                >
                  Copiar
                </Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>
      )}

      {actionsModalVisible && (
        <ChatActionsModal
          visible={actionsModalVisible}
          onClose={() => setActionsModalVisible(false)}
          onEmojiPress={() => {
            inputRef.current?.blur();
            setActivePicker("emoji");
          }}
          onGifPress={() => {
            inputRef.current?.blur();
            setActivePicker("gif");
          }}
          onStickerPress={() => {
            inputRef.current?.blur();
            setActivePicker("sticker");
          }}
          onFotosPress={handlePickFromGallery}
          onCameraPress={handleTakePhoto}
          onDocumentosPress={handlePickFile}
          onDrawPress={() => setDrawingVisible(true)}
          onSearchWebPress={() => setWebSearchVisible(true)}
          onLocationPress={() => setLocationPickerVisible(true)}
          onSendLaterPress={() => {
            setActivePicker(null);
            setScheduledDelayMs(60000); // 1 minute default delay
          }}
        />
      )}

      {locationPickerVisible && (
        <LocationPickerModal
          visible={locationPickerVisible}
          onClose={() => setLocationPickerVisible(false)}
          onSendLocation={(locationData) => {
            handleSend(null, JSON.stringify(locationData));
          }}
        />
      )}

      {drawingVisible && (
        <DrawingCanvasModal
          visible={drawingVisible}
          onClose={() => setDrawingVisible(false)}
          onSave={(attachment) => {
            setSelectedAttachment(attachment);
          }}
        />
      )}

      {msgOptionsVisible && selectedMsg && (
        <ChatMessageOptionsModal
          visible={msgOptionsVisible}
          layout={selectedMessageLayout}
          isMine={isMine}
          reaction={currentReaction}
          onlyReactions={onlyReactionsMode}
          canEdit={isScheduledSelected}
          onReact={(reactionEmoji) => {
            handleReact(selectedMsg.id, reactionEmoji);
            setReactionsByMe((prev) => ({
              ...prev,
              [selectedMsg.id]: reactionEmoji !== null,
            }));
          }}
          currentUserAvatarUrl={user?.avatar_url}
          currentUsername={user?.username || "Você"}
          participantAvatarUrl={participantAvatarUrl}
          participantUsername={participantUsername || "Outro"}
          reactionByMe={
            reactionsByMe[selectedMsg.id] !== undefined
              ? reactionsByMe[selectedMsg.id]
              : selectedMsg.sender_id !== user?.user_id
          }
          onClose={(shouldClear) => {
            setMsgOptionsVisible(false);
            setOnlyReactionsMode(false);
            if (shouldClear) {
              clearSelection();
            }
          }}
          onReply={() => {
            handleReencaminhar();
          }}
          onForward={() => {
            handleEncaminhar();
          }}
          onCopy={() => {
            handleCopy();
          }}
          onEdit={handleEditScheduledMessage}
          onDelete={() => {
            setDeleteModalVisible(true);
          }}
          onSelect={() => {
            setMsgOptionsVisible(false);
          }}
          onCreateNote={() => {
            if (selectedMsg) openSheetForMessage(selectedMsg, "note");
          }}
          onCreateReminder={() => {
            if (selectedMsg) openSheetForMessage(selectedMsg, "reminder");
          }}
          onCreateEvent={() => {
            if (selectedMsg) openSheetForMessage(selectedMsg, "event");
          }}
          onAddSticker={handleAddStickerToSelectedMessage}
        />
      )}

      <WebSearchBottomSheet
        visible={webSearchVisible}
        onClose={() => setWebSearchVisible(false)}
        onSendMedia={(media) => {
          handleSend(media);
          setWebSearchVisible(false);
        }}
        onSendLink={(link) => {
          handleSend(null, link);
          setWebSearchVisible(false);
        }}
      />

      <ItemEditBottomSheet
        visible={bottomSheetVisible}
        initialType={sheetType}
        suggestion={sheetSuggestion}
        onClose={() => setBottomSheetVisible(false)}
      />
      {draggingSticker && (
        <View
          style={[StyleSheet.absoluteFill, { zIndex: 9999 }]}
          onStartShouldSetResponder={() => true}
          onMoveShouldSetResponder={() => true}
          onResponderTerminationRequest={() => false}
          onResponderRelease={(e) => {
            if (e.nativeEvent.touches.length === 0) {
              const lastCoords = lastTouchCoordsRef.current;
              clearHoverTimer();
              stopDragging(lastCoords.x, lastCoords.y);
            }
          }}
          onTouchMove={(e) => {
            const touches = e.nativeEvent.touches;
            if (touches && touches.length === 2) {
              const dx = touches[0].pageX - touches[1].pageX;
              const dy = touches[0].pageY - touches[1].pageY;
              const distance = Math.sqrt(dx * dx + dy * dy);
              const angle = Math.atan2(dy, dx) * (180 / Math.PI);

              if (initialDragDistance.current === null) {
                initialDragDistance.current = distance;
                initialDragScale.current = dragScaleVal.current;
              } else {
                const newScale = Math.max(0.3, Math.min(3.0, (distance / initialDragDistance.current) * initialDragScale.current));
                dragScaleVal.current = newScale;
                dragScale.setValue(newScale);
              }

              if (initialDragAngle.current === null) {
                initialDragAngle.current = angle;
                initialDragRotation.current = dragRotationVal.current;
              } else {
                const angleDiff = angle - initialDragAngle.current;
                let newRotation = (initialDragRotation.current + angleDiff) % 360;
                if (newRotation < 0) newRotation += 360;
                dragRotationVal.current = newRotation;
                dragRotation.setValue(newRotation);
              }
              
              // Clear hover timer when adjusting to prevent snapping during pinch
              clearHoverTimer();
            } else if (touches && touches.length === 1) {
              const touch = touches[0];
              const pageX = touch.pageX;
              const pageY = touch.pageY;

              dragPosition.setValue({
                x: pageX - 50,
                y: pageY - 50,
              });
              initialDragDistance.current = null;
              initialDragAngle.current = null;

              // Detect which message is hovered
              const relativeY = pageY - flatListLayout.current.y + flatListScrollOffset.current;
              let currentHoveredMsgId: string | null = null;
              
              let accumulatedY = 16; // contentContainerStyle padding is 16
              for (const item of chatItems) {
                const id = item.type === "message" ? item.data.id : `call_${item.data.id}`;
                const layout = messageLayouts.current[id];
                const h = layout ? layout.height : 0;
                
                if (h > 0 && relativeY >= accumulatedY && relativeY <= accumulatedY + h) {
                  currentHoveredMsgId = item.type === "message" ? id : null;
                  break;
                }
                accumulatedY += h;
              }

              const lastCoords = lastTouchCoordsRef.current;
              const dist = Math.sqrt(Math.pow(pageX - lastCoords.x, 2) + Math.pow(pageY - lastCoords.y, 2));

              if (currentHoveredMsgId !== hoveredMessageIdRef.current || dist > 15) {
                clearHoverTimer();
                hoveredMessageIdRef.current = currentHoveredMsgId;

                if (currentHoveredMsgId) {
                  hoverTimerRef.current = setTimeout(() => {
                    const snapCoords = lastTouchCoordsRef.current;
                    clearHoverTimer();
                    stopDragging(snapCoords.x, snapCoords.y);
                  }, 600);
                }
              }
              lastTouchCoordsRef.current = { x: pageX, y: pageY };
            }
          }}
        >
          <Animated.View
            style={{
              position: "absolute",
              width: 100,
              height: 100,
              transform: [
                { translateX: dragPosition.x },
                { translateY: dragPosition.y },
                { scale: dragScale },
                {
                  rotate: dragRotation.interpolate({
                    inputRange: [0, 360],
                    outputRange: ["0deg", "360deg"],
                  }),
                },
              ],
              opacity: 0.85,
            }}
          >
            <Image
              source={{ uri: draggingSticker.stickerUrl }}
              style={{ width: "100%", height: "100%" }}
              resizeMode="contain"
            />
          </Animated.View>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  messageList: { flex: 1 },
  inputContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    padding: 12,
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
  inputContainerMessage: {
    flex: 1,
    flexDirection: "row",
    alignItems: "flex-end",
    backgroundColor: "#ffffff",
    borderRadius: 28,
    borderWidth: 1,
    paddingVertical: 6,
    paddingHorizontal: 6,
    marginRight: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 3,
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
    fontSize: 16,
    fontWeight: "400",
    color: "#272727",
    flex: 1,
  },
  subTitleText: {
    fontSize: 12,
    marginTop: 2,
  },
  headerRightContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  headerActionBtn: {
    padding: 8,
    marginLeft: 12,
  },
  avatarTitleContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
  },
  avatarContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
    overflow: "hidden",
  },
  avatarImage: {
    width: "100%",
    height: "100%",
  },
  avatarPlaceholderText: {
    color: "#FFF",
    fontSize: 14,
    fontWeight: "bold",
  },
  actionMenuButton: {
    width: 44,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  stickerControlsContainer: {
    position: "absolute",
    bottom: 90,
    left: 20,
    right: 20,
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
    zIndex: 10000,
  },
  stickerControlsTitle: {
    fontSize: 15,
    fontWeight: "600",
    marginBottom: 12,
    textAlign: "center",
  },
  stickerControlsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: 16,
  },
  controlGroup: {
    alignItems: "center",
  },
  controlLabel: {
    fontSize: 12,
    marginBottom: 6,
  },
  controlButtons: {
    flexDirection: "row",
    alignItems: "center",
  },
  controlBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  controlValue: {
    fontSize: 14,
    fontWeight: "600",
    marginHorizontal: 12,
    minWidth: 40,
    textAlign: "center",
  },
  stickerControlsActions: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    height: 38,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    marginHorizontal: 6,
  },
  actionBtnText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
});
