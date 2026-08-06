import React from "react";
import { View, StyleSheet } from "react-native";
import { EmojiKeyboard } from "rn-emoji-keyboard";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppTheme } from "@/context/ThemeContext";

interface EmojiModalProps {
  onEmojiSelected: (emojiObject: { emoji: string }) => void;
  height?: number;
}

export const EmojiModal: React.FC<EmojiModalProps> = ({
  onEmojiSelected,
  height = 300,
}) => {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const bottomPadding = insets.bottom > 0 ? insets.bottom : 16;

  return (
    <View
      style={[
        styles.container,
        {
          height: height + bottomPadding,
          paddingBottom: bottomPadding,
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
        },
      ]}
    >
      <View style={styles.contentPane}>
        <EmojiKeyboard
          onEmojiSelected={onEmojiSelected}
          defaultHeight={height - 50}
          expandable={false}
          hideHeader={true}
          enableRecentlyUsed={true}
          categoryOrder={[
            "recently_used",
            "smileys_emotion",
            "people_body",
            "animals_nature",
            "food_drink",
            "travel_places",
            "activities",
            "objects",
            "symbols",
            "flags",
          ]}
          categoryPosition="bottom"
          styles={{
            category: {
              container: {
                width: "100%",
                borderRadius: 0,
              },
            },
          }}
          theme={{
            backdrop: "transparent",
            knob: colors.brandGreen,
            container: colors.surface,
            header: colors.text,
            skinTonesContainer: colors.surface,
            category: {
              icon: colors.icon,
              iconActive: colors.brandGreen,
              container: colors.surface,
              containerActive: colors.surface,
            },
            search: {
              text: colors.text,
              placeholder: colors.textSecondary,
              icon: colors.icon,
              background: colors.background,
            },
            emoji: {
              selected: colors.surface,
            },
          }}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderTopWidth: 1,
    flexDirection: "column",
    width: "100%",
    maxHeight: "34%",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: "hidden",
  },
  contentPane: {
    flex: 1,
  },
});
