import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from "react-native";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useAppTheme } from "@/context/ThemeContext";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const ITEM_HEIGHT = 48;
const VISIBLE_ITEMS = 3;
const PICKER_HEIGHT = ITEM_HEIGHT * VISIBLE_ITEMS;

interface WheelPickerProps {
  options: number[];
  selectedValue: number;
  onChange: (value: number) => void;
  label: string;
}

function WheelPicker({
  options,
  selectedValue,
  onChange,
  label,
}: WheelPickerProps) {
  const { colors, isDark } = useAppTheme();
  const scrollViewRef = useRef<ScrollView>(null);
  const isInitialRender = useRef(true);

  const paddedOptions = [null, ...options, null];

  useEffect(() => {
    const selectedIndex = options.indexOf(selectedValue);
    if (selectedIndex !== -1 && scrollViewRef.current) {
      const scrollY = selectedIndex * ITEM_HEIGHT;
      if (isInitialRender.current) {
        setTimeout(() => {
          scrollViewRef.current?.scrollTo({ y: scrollY, animated: false });
          isInitialRender.current = false;
        }, 100);
      } else {
        scrollViewRef.current?.scrollTo({ y: scrollY, animated: true });
      }
    }
  }, [selectedValue, options]);

  const handleScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const yOffset = e.nativeEvent.contentOffset.y;
    const index = Math.round(yOffset / ITEM_HEIGHT);
    const clampedIndex = Math.max(0, Math.min(options.length - 1, index));
    const newValue = options[clampedIndex];
    if (newValue !== selectedValue) {
      onChange(newValue);
    }
  };

  return (
    <View style={styles.pickerContainer}>
      <Text style={[styles.pickerLabel, { color: colors.textSecondary }]}>
        {label}
      </Text>
      <View style={[styles.wheelContainer, { height: PICKER_HEIGHT }]}>
        <View
          style={[
            styles.selectionOverlay,
            {
              borderColor: colors.border,
              height: ITEM_HEIGHT,
              top: ITEM_HEIGHT,
            },
          ]}
          pointerEvents="none"
        />
        <ScrollView
          ref={scrollViewRef}
          showsVerticalScrollIndicator={false}
          snapToInterval={ITEM_HEIGHT}
          decelerationRate="fast"
          onMomentumScrollEnd={handleScrollEnd}
          onScrollEndDrag={handleScrollEnd}
          scrollEventThrottle={16}
          contentContainerStyle={styles.scrollContent}
        >
          {paddedOptions.map((item, idx) => {
            if (item === null) {
              return (
                <View key={`pad-${idx}`} style={{ height: ITEM_HEIGHT }} />
              );
            }
            const isSelected = item === selectedValue;
            return (
              <View
                key={item}
                style={[styles.itemWrapper, { height: ITEM_HEIGHT }]}
              >
                <Text
                  style={[
                    styles.itemText,
                    {
                      color: isSelected
                        ? colors.text
                        : isDark
                          ? "#666"
                          : "#AAA",
                      fontWeight: isSelected ? "bold" : "normal",
                      fontSize: isSelected ? 18 : 14,
                    },
                  ]}
                >
                  {String(item).padStart(2, "0")}
                </Text>
              </View>
            );
          })}
        </ScrollView>
      </View>
    </View>
  );
}

interface SendLaterModalProps {
  onClose: () => void;
  onSchedule: (delayMs: number) => void;
  initialDelayMs?: number;
}

export function SendLaterModal({
  onClose,
  onSchedule,
  initialDelayMs,
}: SendLaterModalProps) {
  const { colors, isDark } = useAppTheme();
  const insets = useSafeAreaInsets();

  const bottomPadding = insets.bottom > 0 ? insets.bottom + 12 : 28;

  const initialSeconds = initialDelayMs
    ? Math.floor(initialDelayMs / 1000)
    : 60;
  const initialDays = Math.floor(initialSeconds / 86400);
  const remainingSecs1 = initialSeconds % 86400;
  const initialHours = Math.floor(remainingSecs1 / 3600);
  const initialMinutes = Math.max(1, Math.floor((remainingSecs1 % 3600) / 60));

  const [days, setDays] = useState(initialDays);
  const [hours, setHours] = useState(initialHours);
  const [minutes, setMinutes] = useState(initialMinutes);

  const daysArray = Array.from({ length: 31 }, (_, i) => i);
  const hoursArray = Array.from({ length: 24 }, (_, i) => i);
  const minutesArray = Array.from({ length: 60 }, (_, i) => i);

  useEffect(() => {
    const totalSeconds = days * 86400 + hours * 3600 + minutes * 60;
    const delayMs = totalSeconds > 0 ? totalSeconds * 1000 : 60000;
    onSchedule(delayMs);
  }, [days, hours, minutes, onSchedule]);

  const modalBgColor = isDark
    ? "rgba(28, 28, 30, 0.85)"
    : "rgba(255, 255, 255, 0.85)";

  return (
    <View
      style={[
        styles.sheetContainer,
        {
          backgroundColor: modalBgColor,
          borderTopColor: colors.border,
          paddingBottom: bottomPadding,
        },
      ]}
    >
      {/* Wheel Pickers Row */}
      <View
        style={[
          styles.pickersRow,
          {
            backgroundColor: "transparent",
          },
        ]}
      >
        <WheelPicker
          options={daysArray}
          selectedValue={days}
          onChange={setDays}
          label="dias"
        />
        <WheelPicker
          options={hoursArray}
          selectedValue={hours}
          onChange={setHours}
          label="horas"
        />
        <WheelPicker
          options={minutesArray}
          selectedValue={minutes}
          onChange={setMinutes}
          label="min"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sheetContainer: {
    width: "100%",
    height: "34%",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: Platform.OS === "ios" ? 34 : 20,
    borderTopWidth: StyleSheet.hairlineWidth,
    justifyContent: "center",
  },

  pickersRow: {
    flexDirection: "row",
    justifyContent: "space-evenly",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
  pickerContainer: {
    flex: 1,
    alignItems: "center",
  },
  pickerLabel: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  wheelContainer: {
    width: "85%",
    overflow: "hidden",
    position: "relative",
  },
  selectionOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    zIndex: 10,
  },
  scrollContent: {
    alignItems: "center",
  },
  itemWrapper: {
    justifyContent: "center",
    alignItems: "center",
    width: "100%",
  },
  itemText: {
    textAlign: "center",
  },
  confirmButton: {
    borderRadius: 14,
    height: 48,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  confirmButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
});
