import React, { useRef } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { SwipeableMessageRow } from "@/components/SwipeableMessageRow";
import { MessageBubble } from "@/components/MessageBubble";
import { CallBubble } from "@/components/CallBubble";
import { useAppTheme } from "@/context/ThemeContext";
import { isSameDay, getDateLabel } from "@/utils/date";
import { type Message } from "@/services/api";
import { type CallHistoryItem } from "@/services/callApi";

export type ChatItem =
  | { type: "message"; data: Message }
  | { type: "call"; data: CallHistoryItem };

interface ChatItemRowProps {
  item: ChatItem;
  index: number;
  chatItems: ChatItem[];
  selectedMessageIds: string[];
  selectedCallIds: string[];
  isSelectionMode: boolean;
  currentUserId?: string;
  isGroup: boolean;
  participantId: string;
  participantUsername: string;
  participantAvatarUrl: string;
  onSwipeRight: (msg: Message) => void;
  onToggleMessageSelection: (msg: Message, layout?: { x: number; y: number; width: number; height: number }, onlyReactions?: boolean) => void;
  onToggleCallSelection: (callId: string) => void;
  onCreateNote?: (msg: Message) => void;
  onCreateReminder?: (msg: Message) => void;
  onCreateEvent?: (msg: Message) => void;
}

export const ChatItemRow: React.FC<ChatItemRowProps> = ({
  item,
  index,
  chatItems,
  selectedMessageIds,
  selectedCallIds,
  isSelectionMode,
  currentUserId,
  isGroup,
  participantId,
  participantUsername,
  participantAvatarUrl,
  onSwipeRight,
  onToggleMessageSelection,
  onToggleCallSelection,
  onCreateNote,
  onCreateReminder,
  onCreateEvent,
}) => {
  const { colors, isDark } = useAppTheme();
  const bubbleRef = useRef<React.ElementRef<typeof TouchableOpacity>>(null);
  const lastPressRef = useRef<number>(0);

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
    const isSelected = selectedMessageIds.includes(msg.id);
    const handleLongPress = (onlyReactions = false) => {
      if (isSelectionMode) {
        onToggleMessageSelection(msg);
      } else {
        bubbleRef.current?.measure((x: number, y: number, width: number, height: number, pageX: number, pageY: number) => {
          onToggleMessageSelection(msg, { x: pageX, y: pageY, width, height }, onlyReactions);
        });
      }
    };

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
        <SwipeableMessageRow
          enabled={!isSelectionMode && !msg.deleted_for_everyone}
          onSwipeRight={() => onSwipeRight(msg)}
          isSelected={isSelected}
          selectedBackgroundColor={
            isDark
              ? "rgba(10, 132, 255, 0.25)"
              : "rgba(0, 122, 255, 0.15)"
          }
        >
          <TouchableOpacity
            ref={bubbleRef}
            onPress={() => {
              if (isSelectionMode) {
                onToggleMessageSelection(msg);
              } else {
                const now = Date.now();
                const DOUBLE_PRESS_DELAY = 300;
                if (now - lastPressRef.current < DOUBLE_PRESS_DELAY) {
                  handleLongPress(true);
                }
                lastPressRef.current = now;
              }
            }}
            onLongPress={() => handleLongPress(false)}
            delayLongPress={500}
            style={styles.messageRow}
            activeOpacity={0.8}
          >
            <MessageBubble
              item={msg}
              currentUserId={currentUserId}
              isGroup={isGroup}
              onLongPress={handleLongPress}
              onCreateNote={onCreateNote ? () => onCreateNote(msg) : undefined}
              onCreateReminder={onCreateReminder ? () => onCreateReminder(msg) : undefined}
              onCreateEvent={onCreateEvent ? () => onCreateEvent(msg) : undefined}
            />
          </TouchableOpacity>
        </SwipeableMessageRow>
      </View>
    );
  } else {
    const call = item.data;
    const isSelected = selectedCallIds.includes(call.id);

    return (
      <CallBubble
        call={call}
        currentUserId={currentUserId}
        participantId={participantId}
        participantUsername={participantUsername}
        participantAvatarUrl={participantAvatarUrl}
        showDateHeader={showDateHeader}
        selectionMode={isSelectionMode}
        isSelected={isSelected}
        selectedBackgroundColor={
          isDark
            ? "rgba(10, 132, 255, 0.25)"
            : "rgba(0, 122, 255, 0.15)"
        }
        onPress={() => {
          if (isSelectionMode) onToggleCallSelection(call.id);
        }}
        onLongPress={() => onToggleCallSelection(call.id)}
      />
    );
  }
};

const styles = StyleSheet.create({
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
  messageRow: {
    width: "100%",
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
});
