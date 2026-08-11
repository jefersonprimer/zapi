import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Platform,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from "react-native";
import { useAppTheme } from "@/context/ThemeContext";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const ITEM_HEIGHT = 48;
const VISIBLE_ITEMS = 3;
const PICKER_HEIGHT = ITEM_HEIGHT * VISIBLE_ITEMS;

interface WheelPickerProps<T extends number | string> {
  options: T[];
  selectedValue: T;
  onChange: (value: T) => void;
  label: string;
}

function WheelPicker<T extends number | string>({
  options,
  selectedValue,
  onChange,
  label,
}: WheelPickerProps<T>) {
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
                key={String(item)}
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
                  {typeof item === "number" ? String(item).padStart(2, "0") : item}
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

  const initialDate = new Date(Date.now() + (initialDelayMs || 60000));
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const targetDay = new Date(initialDate);
  targetDay.setHours(0, 0, 0, 0);
  const diffTime = targetDay.getTime() - today.getTime();
  const initialDays = Math.max(0, Math.floor(diffTime / 86400000));

  const rawHours = initialDate.getHours();
  const initialAmpm: "AM" | "PM" = rawHours >= 12 ? "PM" : "AM";
  let initialHours = rawHours % 12;
  if (initialHours === 0) initialHours = 12;

  const initialMinutes = initialDate.getMinutes();

  const [days, setDays] = useState(initialDays);
  const [hours, setHours] = useState(initialHours);
  const [minutes, setMinutes] = useState(initialMinutes);
  const [ampm, setAmpm] = useState<"AM" | "PM">(initialAmpm);

  const daysArray = Array.from({ length: 31 }, (_, i) => i);
  const hoursArray = Array.from({ length: 12 }, (_, i) => i + 1);
  const minutesArray = Array.from({ length: 60 }, (_, i) => i);
  const ampmArray: ("AM" | "PM")[] = ["AM", "PM"];

  const onScheduleRef = useRef(onSchedule);
  useEffect(() => {
    onScheduleRef.current = onSchedule;
  }, [onSchedule]);

  useEffect(() => {
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + days);
    
    let targetHour = hours;
    if (ampm === "PM" && hours !== 12) {
      targetHour += 12;
    } else if (ampm === "AM" && hours === 12) {
      targetHour = 0;
    }
    
    targetDate.setHours(targetHour, minutes, 0, 0);

    // Se o horário selecionado já passou, agenda automaticamente para o dia seguinte
    if (targetDate.getTime() <= Date.now()) {
      targetDate.setDate(targetDate.getDate() + 1);
    }

    const delayMs = Math.max(60000, targetDate.getTime() - Date.now());
    onScheduleRef.current(delayMs);
  }, [days, hours, minutes, ampm]);

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
        <WheelPicker
          options={ampmArray}
          selectedValue={ampm}
          onChange={setAmpm}
          label="am/pm"
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
