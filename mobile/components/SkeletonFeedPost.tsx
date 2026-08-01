import React, { useEffect, useRef } from "react";
import { View, StyleSheet, Animated } from "react-native";
import { useAppTheme } from "@/context/ThemeContext";

export default function SkeletonFeedPost() {
  const { colors } = useAppTheme();
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.7,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [opacity]);

  return (
    <View style={[styles.card, { borderBottomColor: colors.border }]}>
      {/* Header Skeleton */}
      <View style={styles.header}>
        <Animated.View
          style={[
            styles.avatar,
            { backgroundColor: colors.border, opacity }
          ]}
        />
        <View style={styles.headerTextContainer}>
          <Animated.View
            style={[
              styles.lineName,
              { backgroundColor: colors.border, opacity }
            ]}
          />
          <Animated.View
            style={[
              styles.lineMeta,
              { backgroundColor: colors.border, opacity }
            ]}
          />
        </View>
      </View>

      {/* Content Skeleton */}
      <View style={styles.contentContainer}>
        <Animated.View
          style={[
            styles.lineText,
            { width: "90%", backgroundColor: colors.border, opacity }
          ]}
        />
        <Animated.View
          style={[
            styles.lineText,
            { width: "75%", backgroundColor: colors.border, opacity }
          ]}
        />
      </View>

      {/* Image Attachment Skeleton */}
      <Animated.View
        style={[
          styles.imagePlaceholder,
          { backgroundColor: colors.border, opacity }
        ]}
      />

      {/* Actions Skeleton */}
      <View style={styles.actions}>
        <Animated.View
          style={[
            styles.actionButton,
            { backgroundColor: colors.border, opacity }
          ]}
        />
        <Animated.View
          style={[
            styles.actionButton,
            { backgroundColor: colors.border, opacity }
          ]}
        />
        <Animated.View
          style={[
            styles.actionButton,
            { backgroundColor: colors.border, opacity }
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingBottom: 12,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  headerTextContainer: {
    marginLeft: 12,
    flex: 1,
    gap: 6,
  },
  lineName: {
    height: 14,
    width: 120,
    borderRadius: 4,
  },
  lineMeta: {
    height: 10,
    width: 80,
    borderRadius: 4,
  },
  contentContainer: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 8,
  },
  lineText: {
    height: 12,
    borderRadius: 4,
  },
  imagePlaceholder: {
    height: 200,
    marginHorizontal: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  actions: {
    flexDirection: "row",
    paddingHorizontal: 16,
    gap: 24,
  },
  actionButton: {
    height: 20,
    width: 60,
    borderRadius: 4,
  },
});
