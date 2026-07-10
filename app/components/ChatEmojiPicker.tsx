import React, { useState } from "react";
import { TouchableOpacity, StyleSheet } from "react-native";
import EmojiPicker, { type EmojiType } from "rn-emoji-keyboard";
import { Smile } from "lucide-react-native";

interface ChatEmojiPickerProps {
  onEmojiSelected: (emoji: string) => void;
}

export const ChatEmojiPicker: React.FC<ChatEmojiPickerProps> = ({
  onEmojiSelected,
}) => {
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const handleEmojiSelected = (emojiObject: EmojiType) => {
    onEmojiSelected(emojiObject.emoji);
  };

  return (
    <>
      <TouchableOpacity
        style={styles.iconBtn}
        onPress={() => setShowEmojiPicker(true)}
      >
        <Smile size={24} color="#272727" />
      </TouchableOpacity>

      <EmojiPicker
        open={showEmojiPicker}
        onClose={() => setShowEmojiPicker(false)}
        onEmojiSelected={handleEmojiSelected}
      />
    </>
  );
};

const styles = StyleSheet.create({
  iconBtn: {
    width: 36,
    height: 36,
    justifyContent: "center",
    alignItems: "center",
  },
});
