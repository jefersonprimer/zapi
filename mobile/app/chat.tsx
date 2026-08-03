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
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useFocusEffect, useNavigation, useRouter } from "expo-router";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { voiceCallManager } from "@/services/voiceCallManager";
import { API_URL } from "@/services/api";
import { ChatMediaSelector } from "@/components/ChatMediaSelector";
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
import { LocationPickerModal } from "@/components/LocationPickerModal";
import { ChatMessageOptionsModal } from "@/components/ChatMessageOptionsModal";
import { WebSearchBottomSheet } from "@/components/WebSearchBottomSheet";
import { SendLaterModal } from "@/components/SendLaterModal";
import { SendLaterPreviewBar } from "@/components/SendLaterPreviewBar";
import { useAppTheme } from "@/context/ThemeContext";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useChat } from "@/hooks/useChat";
import { useChatLists } from "@/hooks/useChatLists";

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
    messages,
    setMessages,
    handleScheduleMessage,
  } = useChat();

  const flatListRef = useRef<FlatList>(null);
  const inputRef = useRef<any>(null);
  const shouldStickToBottomRef = useRef(true);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [actionsModalVisible, setActionsModalVisible] = useState(false);
  const [sendLaterVisible, setSendLaterVisible] = useState(false);
  const [scheduledDelayMs, setScheduledDelayMs] = useState<number | null>(null);
  const [webSearchVisible, setWebSearchVisible] = useState(false);
  const [locationPickerVisible, setLocationPickerVisible] = useState(false);
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
      setShowEmojiPicker(false);
      setAttachSheetVisible(false);
    }
  }, [isKeyboardVisible, setAttachSheetVisible, setShowEmojiPicker]);

  useEffect(() => {
    if (attachSheetVisible) {
      inputRef.current?.blur();
      Keyboard.dismiss();
      setShowEmojiPicker(false);
    }
  }, [attachSheetVisible, setShowEmojiPicker]);

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

  const selectedMsg = messages.find((m) => selectedMessageIds.includes(m.id));
  const isMine = selectedMsg ? selectedMsg.sender_id === user?.user_id : false;
  const currentReaction = selectedMsg ? selectedMsg.reaction : null;

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
              <MaterialCommunityIcons
                name="arrow-left"
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
                    <MaterialCommunityIcons
                      name="video-outline"
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
                  <MaterialCommunityIcons
                    name="phone-outline"
                    size={24}
                    color={colors.text}
                  />
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
              : showEmojiPicker
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

      <View
        style={{
          position: "absolute",
          bottom: showEmojiPicker
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
                showEmojiPicker ||
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
                      setShowEmojiPicker(false);
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
                      setShowEmojiPicker(false);
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

      {showEmojiPicker && (
        <ChatMediaSelector
          onEmojiSelected={(emojiObject) =>
            setContent((prev) => prev + emojiObject.emoji)
          }
          onSendMedia={(media) => {
            handleSend(media);
            setShowEmojiPicker(false);
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
            setShowEmojiPicker(true);
          }}
          onFotosPress={handlePickFromGallery}
          onCameraPress={handleTakePhoto}
          onDocumentosPress={handlePickFile}
          onSearchWebPress={() => setWebSearchVisible(true)}
          onLocationPress={() => setLocationPickerVisible(true)}
          onSendLaterPress={() => {
            setShowEmojiPicker(false);
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

      {msgOptionsVisible && selectedMsg && (
        <ChatMessageOptionsModal
          visible={msgOptionsVisible}
          layout={selectedMessageLayout}
          isMine={isMine}
          reaction={currentReaction}
          onlyReactions={onlyReactionsMode}
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
          onDelete={() => {
            setDeleteModalVisible(true);
          }}
          onSelect={() => {
            setMsgOptionsVisible(false);
          }}
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
});
