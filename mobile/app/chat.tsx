import { useEffect, useRef, useState, useCallback } from "react";
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
  Alert,
} from "react-native";
import { useNavigation, useRouter } from "expo-router";
import { ChatHeader } from "@/components/ChatHeader";
import { ChatBlockedBar } from "@/components/ChatBlockedBar";
import { ChatDeleteModal } from "@/components/ChatDeleteModal";
import { ChatItemRow } from "@/components/ChatItemRow";
import { ChatEmojiPicker } from "@/components/ChatEmojiPicker";
import { ChatInput } from "@/components/ChatInput";
import { AttachDocumentButton } from "@/components/AttachDocumentButton";
import { AttachCameraButton } from "@/components/AttachCameraButton";
import { AttachMediaSheet } from "@/components/AttachMediaSheet";
import { SendOrMicButton } from "@/components/SendOrMicButton";
import { ChatMenuModal } from "@/components/ChatMenuModal";
import MuteModal from "@/components/MuteModal";
import CreateListModal from "@/components/CreateListModal";
import ListSelectorModal from "@/components/ListSelectorModal";
import { VoiceNoteRecorderBar } from "@/components/VoiceNoteRecorderBar";
import { AttachmentPreviewBar } from "@/components/AttachmentPreviewBar";
import { ForwardPreviewBar } from "@/components/ForwardPreviewBar";
import { useAppTheme } from "@/context/ThemeContext";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useChat } from "@/hooks/useChat";
import { getChatLists, createChatList } from "@/services/api";
import { getLocalChatLists, saveLocalChatLists, type LocalChatList } from "@/services/database";
import { updateChatListSelections } from "@/services/chatActions";

export default function ChatScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const router = useRouter();
  const { colors } = useAppTheme();
  const flatListRef = useRef<FlatList>(null);

  // Disable native header to render custom styled header bar
  useEffect(() => {
    navigation.setOptions({
      headerShown: false,
    });
  }, [navigation]);

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
    handlePickDocument,
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
    user,
    token,
  } = useChat();

  // Lists feature states
  const [listSelectorVisible, setListSelectorVisible] = useState(false);
  const [createListModalVisible, setCreateListModalVisible] = useState(false);
  const [allLists, setAllLists] = useState<LocalChatList[]>([]);
  const [selectedListIds, setSelectedListIds] = useState<string[]>([]);

  const syncLists = async () => {
    if (!token) return;
    try {
      const response = await getChatLists(token);
      if (response && response.lists) {
        const mappedLists: LocalChatList[] = response.lists.map((l) => ({
          id: l.id,
          user_id: l.user_id,
          name: l.name,
          color: l.color,
          icon: l.icon,
          position: l.position,
          created_at: l.created_at,
          updated_at: l.updated_at,
          chat_ids: l.chat_ids,
        }));
        await saveLocalChatLists(mappedLists);
        setAllLists(mappedLists);
        if (chatId) {
          const selected = mappedLists
            .filter((l) => l.chat_ids.includes(chatId))
            .map((l) => l.id);
          setSelectedListIds(selected);
        }
      }
    } catch (err) {
      console.warn("Offline or sync error syncing lists:", err);
    }
  };

  const loadListsAndSelection = useCallback(async () => {
    try {
      const lists = await getLocalChatLists();
      setAllLists(lists);
      if (chatId) {
        const selected = lists
          .filter((l) => l.chat_ids.includes(chatId))
          .map((l) => l.id);
        setSelectedListIds(selected);
      } else {
        setSelectedListIds([]);
      }
    } catch (err) {
      console.error("Error loading chat lists:", err);
    }
  }, [chatId]);

  useEffect(() => {
    loadListsAndSelection();
  }, [loadListsAndSelection]);

  const handleOpenListSelector = async () => {
    try {
      await syncLists();
      setListSelectorVisible(true);
    } catch (err) {
      console.error("Error fetching lists:", err);
      setListSelectorVisible(true);
    }
  };

  const handleSaveLists = async (selectedIds: string[]) => {
    if (!token || !chatId) return;
    try {
      await updateChatListSelections(token, chatId, selectedIds);
      setSelectedListIds(selectedIds);
      setListSelectorVisible(false);
      Alert.alert("Sucesso", "Listas atualizadas com sucesso.");
    } catch (err: any) {
      console.error("Error saving lists:", err);
      Alert.alert(
        "Erro",
        err.message || "Não foi possível atualizar as listas.",
      );
    }
  };

  const handleCreateList = async (
    name: string,
    color: string,
    icon: string,
  ) => {
    if (!token) return;
    try {
      const response = await createChatList(token, name, color, icon);
      if (response && response.list) {
        await syncLists();
        setSelectedListIds((prev) => [...prev, response.list.id]);
        setCreateListModalVisible(false);
        setListSelectorVisible(true);
      }
    } catch (err: any) {
      console.error("Error creating list:", err);
      Alert.alert("Erro", "Não foi possível criar a lista.");
    }
  };

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
      <ChatHeader
        insets={insets}
        chatId={chatId}
        participantId={participantId}
        participantUsername={participantUsername}
        participantAvatarUrl={participantAvatarUrl}
        displayTitle={displayTitle}
        isGroup={isGroup}
        isSelectionMode={isSelectionMode}
        selectedCount={selectedCount}
        hasOnlyMessagesSelected={hasOnlyMessagesSelected}
        selectedMessageIds={selectedMessageIds}
        clearSelection={clearSelection}
        onReencaminhar={handleReencaminhar}
        onEncaminhar={handleEncaminhar}
        onDeletePress={() => setDeleteModalVisible(true)}
        onOptionsPress={() => setOptionsModalVisible(true)}
        onMenuPress={() => setMenuVisible(true)}
      />

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
            paddingBottom: isKeyboardVisible ? 6 : insets.bottom,
            backgroundColor: colors.background,
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
            onSendAudio={recordedUri ? sendPreviewedAudio : sendRecordingImmediately}
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

      <AttachMediaSheet
        visible={attachSheetVisible}
        onClose={() => setAttachSheetVisible(false)}
        onPickGallery={handlePickFromGallery}
        onPickDocument={handlePickFile}
        onSelectMedia={setSelectedAttachment}
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
});
