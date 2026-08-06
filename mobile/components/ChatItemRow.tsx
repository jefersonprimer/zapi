import React, { useRef, useEffect } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Animated, PanResponder, Image, Alert } from "react-native";
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
  onLayoutMessage?: (
    msgId: string,
    layout: { x: number; y: number; width: number; height: number }
  ) => void;
  onMeasureBubble?: (
    msgId: string,
    layout: {
      x: number;
      y: number;
      width: number;
      height: number;
      pageX: number;
      pageY: number;
    }
  ) => void;
  onToggleMessageSelection: (msg: Message, layout?: { x: number; y: number; width: number; height: number }, onlyReactions?: boolean) => void;
  onToggleCallSelection: (callId: string) => void;
  onCreateNote?: (msg: Message) => void;
  onCreateReminder?: (msg: Message) => void;
  onCreateEvent?: (msg: Message) => void;
  onRemoveSticker: (msgId: string, stickerId: string) => void;
}

interface PlacedStickerComponentProps {
  placed: any;
  msgId: string;
  onRemoveSticker: (msgId: string, stickerId: string) => void;
  extraTop: number;
}

const PlacedStickerComponent: React.FC<PlacedStickerComponentProps> = ({
  placed,
  msgId,
  onRemoveSticker,
  extraTop,
}) => {
  const scaleAnim = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.spring(scaleAnim, {
      toValue: placed.scale_factor || 1.0,
      tension: 110,
      friction: 6,
      useNativeDriver: true,
    }).start();
  }, [placed.scale_factor]);

  const handleLongPress = () => {
    Alert.alert(
      "Remover Figurinha",
      "Deseja remover esta figurinha da mensagem?",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Remover",
          style: "destructive",
          onPress: () => onRemoveSticker(msgId, placed.id),
        },
      ]
    );
  };

  return (
    <Animated.View
      style={{
        position: "absolute",
        left: placed.x_offset - 35,
        top: placed.y_offset + extraTop - 35,
        transform: [
          { rotate: `${placed.rotation || 0}deg` },
          { scale: scaleAnim },
        ],
        zIndex: 9999,
      }}
    >
      <TouchableOpacity
        activeOpacity={0.8}
        onLongPress={handleLongPress}
      >
        <Image
          source={{ uri: placed.sticker_url }}
          style={{
            width: 70,
            height: 70,
          }}
          resizeMode="contain"
        />
      </TouchableOpacity>
    </Animated.View>
  );
};

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
  onLayoutMessage,
  onMeasureBubble,
  onToggleMessageSelection,
  onToggleCallSelection,
  onCreateNote,
  onCreateReminder,
  onCreateEvent,
  onRemoveSticker,
}) => {
  const { colors, isDark } = useAppTheme();
  const bubbleRef = useRef<React.ElementRef<typeof TouchableOpacity>>(null);
  const lastPressRef = useRef<number>(0);

  const [bubbleHeight, setBubbleHeight] = React.useState(0);

  const reportBubbleLayout = () => {
    if (!onMeasureBubble || item.type !== "message") return;
    requestAnimationFrame(() => {
      bubbleRef.current?.measure((x, y, width, height, pageX, pageY) => {
        onMeasureBubble(item.data.id, { x, y, width, height, pageX, pageY });
      });
    });
  };

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
    const isMine = msg.sender_id === currentUserId;
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

    let extraTop = 0;
    let extraBottom = 0;
    if (msg.placed_stickers && msg.placed_stickers.length > 0) {
      msg.placed_stickers.forEach((s: any) => {
        const radius = 35 * (s.scale_factor || 1.0);
        const topBound = s.y_offset - radius;
        const bottomBound = s.y_offset + radius;
        if (topBound < 0) {
          extraTop = Math.max(extraTop, -topBound);
        }
        if (bubbleHeight > 0 && bottomBound > bubbleHeight) {
          extraBottom = Math.max(extraBottom, bottomBound - bubbleHeight);
        }
      });
    }

    return (
      <View
        onLayout={(e) => {
          if (onLayoutMessage) {
            onLayoutMessage(msg.id, {
              x: e.nativeEvent.layout.x,
              y: e.nativeEvent.layout.y,
              width: e.nativeEvent.layout.width,
              height: e.nativeEvent.layout.height,
            });
          }
        }}
        style={{
          position: "relative",
          paddingTop: extraTop,
          paddingBottom: extraBottom,
        }}
      >
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
          <View
            style={{
              position: "relative",
              paddingTop: extraTop,
              paddingBottom: extraBottom,
            }}
          >
            <TouchableOpacity
              ref={bubbleRef}
              onLayout={(e) => {
                reportBubbleLayout();
                setBubbleHeight(e.nativeEvent.layout.height);
              }}
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

            {/* Placed Stickers rendered relative to the messageRow view inside the SwipeableMessageRow */}
            {!msg.deleted_for_everyone && msg.placed_stickers?.map((placed) => (
              <PlacedStickerComponent
                key={placed.id}
                placed={placed}
                msgId={msg.id}
                onRemoveSticker={onRemoveSticker}
                extraTop={extraTop} // Shift layout down to match container paddingTop extension
              />
            ))}
          </View>
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
