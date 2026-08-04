import React, { useCallback } from "react";
import { StyleSheet, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { useAppTheme } from "@/context/ThemeContext";

const SWIPE_THRESHOLD = 64;
const MAX_TRANSLATE = 88;

interface SwipeableMessageRowProps {
  children: React.ReactNode;
  enabled?: boolean;
  onSwipeRight: () => void;
  isSelected?: boolean;
  selectedBackgroundColor?: string;
}

export function SwipeableMessageRow({
  children,
  enabled = true,
  onSwipeRight,
  isSelected,
  selectedBackgroundColor,
}: SwipeableMessageRowProps) {
  const { colors } = useAppTheme();
  const translateX = useSharedValue(0);
  const iconOpacity = useSharedValue(0);
  const didHaptic = useSharedValue(false);

  const triggerSwipe = useCallback(() => {
    onSwipeRight();
  }, [onSwipeRight]);

  const triggerHaptic = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  }, []);

  const pan = Gesture.Pan()
    .enabled(enabled)
    .activeOffsetX(12)
    .failOffsetY([-16, 16])
    .onUpdate((event) => {
      const next = Math.max(0, Math.min(event.translationX, MAX_TRANSLATE));
      translateX.value = next;
      iconOpacity.value = Math.min(1, next / SWIPE_THRESHOLD);

      if (next >= SWIPE_THRESHOLD && !didHaptic.value) {
        didHaptic.value = true;
        runOnJS(triggerHaptic)();
      } else if (next < SWIPE_THRESHOLD) {
        didHaptic.value = false;
      }
    })
    .onEnd((event) => {
      if (event.translationX >= SWIPE_THRESHOLD) {
        runOnJS(triggerSwipe)();
      }
      translateX.value = withSpring(0, { damping: 18, stiffness: 220 });
      iconOpacity.value = withSpring(0);
      didHaptic.value = false;
    });

  const rowStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const iconStyle = useAnimatedStyle(() => ({
    opacity: iconOpacity.value,
    transform: [
      {
        scale: 0.7 + iconOpacity.value * 0.3,
      },
    ],
  }));

  return (
    <View
      style={[
        styles.container,
        isSelected && selectedBackgroundColor
          ? { backgroundColor: selectedBackgroundColor }
          : null,
      ]}
    >
      <Animated.View style={[styles.iconContainer, iconStyle]}>
        <View style={[styles.iconCircle, { backgroundColor: colors.tint }]}>
          <Ionicons name="arrow-undo" size={16} color="#fff" />
        </View>
      </Animated.View>
      <GestureDetector gesture={pan}>
        <Animated.View style={[styles.row, rowStyle]}>{children}</Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    position: "relative",
    borderRadius: 8,
    overflow: "hidden",
  },
  iconContainer: {
    position: "absolute",
    left: 12,
    top: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 0,
  },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  row: {
    width: "100%",
    zIndex: 1,
  },
});
