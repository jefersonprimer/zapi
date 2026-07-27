import { useEffect, useRef, useState } from "react";
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
import { useNavigation, useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
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
import { useAppTheme } from "@/context/ThemeContext";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useChat } from "@/hooks/useChat";
import { useChatLists } from "@/hooks/useChatLists";

export default function ChatScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const router = useRouter();
  const { colors } = useAppTheme();
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
  } = useChat();

  const flatListRef = useRef<FlatList>(null);
  const inputRef = useRef<any>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [actionsModalVisible, setActionsModalVisible] = useState(false);

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
            onPress={() => (isSelectionMode ? clearSelection() : router.back())}
            style={styles.headerBackBtn}
          >
            <MaterialCommunityIcons
              name="arrow-left"
              size={24}
              color={colors.text}
            />
          </TouchableOpacity>
          {isSelectionMode ? (
            <Text
              style={[
                styles.headerTitleText,
                { color: colors.text, marginLeft: 4 },
              ]}
            >
              {selectedCount}
            </Text>
          ) : null}
          {!isSelectionMode && (
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
                    Conta comercial
                  </Text>
                ) : null}
              </View>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.headerRightContainer}>
          {isSelectionMode ? (
            <>
              {hasOnlyMessagesSelected && selectedMessageIds.length === 1 && (
                <TouchableOpacity
                  onPress={() => handleReencaminhar()}
                  style={styles.headerActionBtn}
                >
                  <MaterialCommunityIcons
                    name="reply"
                    size={22}
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
                    name="share"
                    size={22}
                    color={colors.text}
                  />
                </TouchableOpacity>
              )}
              <TouchableOpacity
                onPress={() => setDeleteModalVisible(true)}
                style={styles.headerActionBtn}
              >
                <MaterialCommunityIcons
                  name="trash-can-outline"
                  size={22}
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
                    size={22}
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
                    name="shopping"
                    size={22}
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
                    size={22}
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
                  size={22}
                  color={colors.text}
                />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setMenuVisible(true)}
                style={styles.headerActionBtn}
              >
                <MaterialCommunityIcons
                  name="dots-vertical"
                  size={22}
                  color={colors.text}
                />
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
        renderItem={({ item, index }) => (
          <ChatItemRow
            item={item}
            index={index}
            chatItems={chatItems}
            selectedMessageIds={selectedMessageIds}
            selectedCallIds={selectedCallIds}
            isSelectionMode={isSelectionMode}
            currentUserId={user?.user_id}
            isGroup={isGroup}
            participantId={participantId}
            participantUsername={participantUsername}
            participantAvatarUrl={participantAvatarUrl}
            onSwipeRight={handleReencaminhar}
            onToggleMessageSelection={toggleMessageSelection}
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

      {forwardingMessage && (
        <ForwardPreviewBar
          forwarded={forwardingMessage}
          onClear={() => setForwardingMessage(null)}
        />
      )}

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
            paddingBottom:
              isKeyboardVisible || showEmojiPicker || attachSheetVisible
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
        ) : isRecording ? (
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
        ) : (
          <>
            <View
              style={[
                styles.inputContainerMessage,
                { backgroundColor: "transparent", borderColor: colors.border },
              ]}
            >
              <TouchableOpacity
                style={styles.actionMenuButton}
                onPress={() => {
                  setShowEmojiPicker(false);
                  setActionsModalVisible(true);
                }}
              >
                <MaterialCommunityIcons
                  name="plus"
                  size={24}
                  color={colors.icon}
                />
              </TouchableOpacity>

              <ChatInput
                ref={inputRef}
                value={content}
                onChangeText={setContent}
                onFocus={() => {
                  setShowEmojiPicker(false);
                  setAttachSheetVisible(false);
                }}
              />
            </View>

            <SendOrMicButton
              hasContent={
                content.trim().length > 0 ||
                selectedAttachment !== null ||
                forwardingMessage !== null
              }
              sending={sending}
              onSend={() => handleSend()}
              onStartRecording={startRecording}
            />
          </>
        )}
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
          height={320}
        />
      )}

      <AttachMediaSheet
        visible={attachSheetVisible}
        onClose={() => setAttachSheetVisible(false)}
        onPickGallery={handlePickFromGallery}
        onPickDocument={handlePickFile}
        onSelectMedia={setSelectedAttachment}
      />

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

      <MuteModal
        visible={muteModalVisible}
        onClose={() => setMuteModalVisible(false)}
        onMute={handleMuteChats}
      />

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

      <CreateListModal
        visible={createListModalVisible}
        onClose={() => {
          setCreateListModalVisible(false);
          setListSelectorVisible(true);
        }}
        onCreate={handleCreateList}
      />

      {/* Delete Confirmation Modal */}
      <ChatDeleteModal
        visible={deleteModalVisible}
        onClose={() => setDeleteModalVisible(false)}
        deleteModalTitle={deleteModalTitle}
        isDeleteForEveryoneAvailable={isDeleteForEveryoneAvailable}
        onDeleteForEveryone={handleDeleteForEveryone}
        onDeleteForMe={handleDeleteForMe}
      />

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
      />
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
  customHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#ffffff",
    borderBottomWidth: StyleSheet.hairlineWidth,
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
    width: 36,
    height: 36,
    justifyContent: "center",
    alignItems: "center",
    marginHorizontal: 4,
  },
});
