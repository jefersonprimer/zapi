import React, { forwardRef, useCallback, useMemo } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";

import {
  BottomSheetModal,
  BottomSheetView,
  BottomSheetBackdrop,
} from "@gorhom/bottom-sheet";
import { useAppTheme } from "@/context/ThemeContext";
import { MaterialCommunityIcons } from "@expo/vector-icons";

interface BrowserSidebarProps {
  canGoBack: boolean;
  canGoForward: boolean;
  onGoBack: () => void;
  onGoForward: () => void;
  onReload: () => void;
  isCurrentFavorite: boolean;
  onToggleFavorite: () => void;
  onShare: () => void;
  onOpenAdblockSettings: () => void;
  onOpenHistoryBookmarks: () => void;
  onCreateTab: () => void;
  onOpenTabManager: () => void;
  tabsCount: number;
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetZoom: () => void;
}

export const BrowserSidebar = forwardRef<BottomSheetModal, BrowserSidebarProps>(
  (
    {
      canGoBack,
      canGoForward,
      onGoBack,
      onGoForward,
      onReload,
      isCurrentFavorite,
      onToggleFavorite,
      onShare,
      onOpenAdblockSettings,
      onOpenHistoryBookmarks,
      onCreateTab,
      onOpenTabManager,
      tabsCount,
      zoom,
      onZoomIn,
      onZoomOut,
      onResetZoom,
    },
    ref,
  ) => {
    const { colors } = useAppTheme();
    const snapPoints = useMemo(() => ["42%"], []);

    const renderBackdrop = useCallback(
      (props: any) => (
        <BottomSheetBackdrop
          {...props}
          disappearsOnIndex={-1}
          appearsOnIndex={0}
        />
      ),
      [],
    );

    const handleClose = () => {
      if (ref && "current" in ref && ref.current) {
        ref.current.dismiss();
      }
    };

    return (
      <BottomSheetModal
        ref={ref}
        snapPoints={snapPoints}
        backdropComponent={renderBackdrop}
        backgroundStyle={{ backgroundColor: colors.surface }}
        handleIndicatorStyle={{ backgroundColor: colors.border }}
      >
        <BottomSheetView style={styles.contentContainer}>
          {/* Top Navigation Row */}
          <View
            style={[
              styles.bottomSheetNavRow,
              { borderBottomColor: colors.border },
            ]}
          >
            <TouchableOpacity
              onPress={() => {
                onGoBack();
                handleClose();
              }}
              disabled={!canGoBack}
              style={[
                styles.bottomSheetNavButton,
                {
                  backgroundColor: colors.background,
                  opacity: canGoBack ? 1 : 0.5,
                },
              ]}
            >
              <MaterialCommunityIcons
                name="arrow-left"
                size={24}
                color={canGoBack ? colors.text : colors.tabIconDefault}
              />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                onGoForward();
                handleClose();
              }}
              disabled={!canGoForward}
              style={[
                styles.bottomSheetNavButton,
                {
                  backgroundColor: colors.background,
                  opacity: canGoForward ? 1 : 0.5,
                },
              ]}
            >
              <MaterialCommunityIcons
                name="arrow-right"
                size={22}
                color={canGoForward ? colors.text : colors.tabIconDefault}
              />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                onReload();
                handleClose();
              }}
              style={[
                styles.bottomSheetNavButton,
                { backgroundColor: colors.background },
              ]}
            >
              <MaterialCommunityIcons
                name="rotate-right"
                size={20}
                color={colors.text}
              />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                onToggleFavorite();
                handleClose();
              }}
              style={[
                styles.bottomSheetNavButton,
                { backgroundColor: colors.background },
              ]}
            >
              <MaterialCommunityIcons
                name="star"
                size={24}
                color={isCurrentFavorite ? "#FFB300" : colors.text}
                fill={isCurrentFavorite ? "#FFB300" : "transparent"}
              />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                onCreateTab();
                handleClose();
              }}
              style={[
                styles.bottomSheetNavButton,
                { backgroundColor: colors.background },
              ]}
            >
              <MaterialCommunityIcons
                name="plus"
                size={24}
                color={colors.text}
              />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                onOpenTabManager();
                handleClose();
              }}
              style={[
                styles.bottomSheetNavButton,
                { backgroundColor: colors.background },
              ]}
            >
              <View style={[styles.tabBadge, { borderColor: colors.text }]}>
                <Text style={[styles.tabBadgeText, { color: colors.text }]}>
                  {tabsCount}
                </Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* Zoom Control Row */}
          <View style={[styles.zoomRow, { borderBottomColor: colors.border }]}>
            <Text style={[styles.zoomLabel, { color: colors.text }]}>
              Zoom da Página
            </Text>
            <View style={styles.zoomControls}>
              <TouchableOpacity
                onPress={onZoomOut}
                style={[
                  styles.zoomButton,
                  { backgroundColor: colors.background },
                ]}
              >
                <MaterialCommunityIcons
                  name="magnify-minus"
                  size={20}
                  color={colors.text}
                />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={onResetZoom}
                style={styles.zoomValueContainer}
              >
                <Text style={[styles.zoomValue, { color: colors.text }]}>
                  {zoom}%
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={onZoomIn}
                style={[
                  styles.zoomButton,
                  { backgroundColor: colors.background },
                ]}
              >
                <MaterialCommunityIcons
                  name="magnify-plus"
                  size={20}
                  color={colors.text}
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Menu Items List */}
          <View style={styles.bottomSheetMenuList}>
            <TouchableOpacity
              onPress={() => {
                onShare();
                handleClose();
              }}
              style={styles.bottomSheetMenuItem}
            >
              <MaterialCommunityIcons
                name="share"
                size={24}
                color={colors.text}
                style={styles.bottomSheetMenuIcon}
              />
              <Text
                style={[styles.bottomSheetMenuText, { color: colors.text }]}
              >
                Compartilhar
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                handleClose();
                onOpenHistoryBookmarks();
              }}
              style={styles.bottomSheetMenuItem}
            >
              <MaterialCommunityIcons
                name="star"
                size={24}
                color={colors.text}
                style={styles.bottomSheetMenuIcon}
              />
              <Text
                style={[styles.bottomSheetMenuText, { color: colors.text }]}
              >
                Favoritos e Histórico
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                handleClose();
                onOpenAdblockSettings();
              }}
              style={styles.bottomSheetMenuItem}
            >
              <MaterialCommunityIcons
                name="shield"
                size={24}
                color={colors.text}
                style={styles.bottomSheetMenuIcon}
              />
              <Text
                style={[styles.bottomSheetMenuText, { color: colors.text }]}
              >
                Configurações do AdBlock
              </Text>
            </TouchableOpacity>
          </View>
        </BottomSheetView>
      </BottomSheetModal>
    );
  },
);

BrowserSidebar.displayName = "BrowserSidebar";

const styles = StyleSheet.create({
  contentContainer: {
    paddingBottom: 24,
  },
  bottomSheetNavRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  zoomRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderBottomWidth: 1,
  },
  zoomLabel: {
    fontSize: 16,
    fontWeight: "500",
  },
  zoomControls: {
    flexDirection: "row",
    alignItems: "center",
  },
  zoomButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  zoomValueContainer: {
    paddingHorizontal: 16,
    minWidth: 60,
    alignItems: "center",
  },
  zoomValue: {
    fontSize: 15,
    fontWeight: "600",
  },
  bottomSheetNavButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: "center",
    alignItems: "center",
  },
  tabBadge: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    justifyContent: "center",
    alignItems: "center",
  },
  tabBadgeText: {
    fontSize: 11,
    fontWeight: "800",
  },
  bottomSheetMenuList: {
    paddingVertical: 8,
  },
  bottomSheetMenuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 24,
  },
  bottomSheetMenuIcon: {
    marginRight: 16,
  },
  bottomSheetMenuText: {
    fontSize: 16,
    fontWeight: "500",
  },
});
