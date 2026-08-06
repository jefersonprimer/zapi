import React, { createContext, useContext, useState, useRef } from "react";
import { Animated, PanResponder, GestureResponderEvent, PanResponderGestureState } from "react-native";

interface StickerDragData {
  stickerUrl: string;
  initialX: number;
  initialY: number;
}

interface StickerDragContextType {
  draggingSticker: StickerDragData | null;
  startDragging: (stickerUrl: string, startX: number, startY: number) => void;
  stopDragging: (x: number, y: number) => void;
  cancelDragging: () => void;
  dragPosition: Animated.ValueXY;
  onDropSticker: ((stickerUrl: string, x: number, y: number) => void) | null;
  registerOnDrop: (callback: (stickerUrl: string, x: number, y: number) => void) => void;
}

const StickerDragContext = createContext<StickerDragContextType | undefined>(undefined);

export const useStickerDrag = () => {
  const context = useContext(StickerDragContext);
  if (!context) {
    throw new Error("useStickerDrag must be used within a StickerDragProvider");
  }
  return context;
};

export const StickerDragProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [draggingSticker, setDraggingSticker] = useState<StickerDragData | null>(null);
  const dragPosition = useRef(new Animated.ValueXY()).current;
  const onDropStickerRef = useRef<((stickerUrl: string, x: number, y: number) => void) | null>(null);

  const startDragging = (stickerUrl: string, startX: number, startY: number) => {
    dragPosition.setValue({ x: startX - 50, y: startY - 50 }); // Center sticker on touch
    setDraggingSticker({
      stickerUrl,
      initialX: startX,
      initialY: startY,
    });
  };

  const stopDragging = (x: number, y: number) => {
    if (draggingSticker && onDropStickerRef.current) {
      onDropStickerRef.current(draggingSticker.stickerUrl, x, y);
    }
    setDraggingSticker(null);
  };

  const cancelDragging = () => {
    setDraggingSticker(null);
  };

  const registerOnDrop = (callback: (stickerUrl: string, x: number, y: number) => void) => {
    onDropStickerRef.current = callback;
  };

  return (
    <StickerDragContext.Provider
      value={{
        draggingSticker,
        startDragging,
        stopDragging,
        cancelDragging,
        dragPosition,
        onDropSticker: onDropStickerRef.current,
        registerOnDrop,
      }}
    >
      {children}
    </StickerDragContext.Provider>
  );
};
