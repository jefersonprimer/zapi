import { useEffect, useRef } from "react";
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
import { useChatLists } from "@/hooks/useChatLists";

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
    participantStoreId,
    user,
  } = useChat();

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
        participantStoreId={participantStoreId}
      />

      {participantStoreId && !isSelectionMode && (
        <View style={[styles.storeBar, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
          <Text style={[styles.storeBarText, { color: colors.text }]}>Esta é uma conta comercial</Text>
          <TouchableOpacity
            style={[styles.storeBarBtn, { backgroundColor: colors.tint }]}
            onPress={() =>
              router.push({
                pathname: "/delivery/[storeId]",
                params: { storeId: participantStoreId },
              })
            }
            activeOpacity={0.8}
          >
            <Text style={styles.storeBarBtnText}>Ver catálogo</Text>
          </TouchableOpacity>
        </View>
      )}

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
  storeBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
  },
  storeBarText: {
    fontSize: 14,
    fontWeight: "500",
  },
  storeBarBtn: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
  },
  storeBarBtnText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "bold",
  },
});
