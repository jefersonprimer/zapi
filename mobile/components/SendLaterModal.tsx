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
  containerStyle?: any;
  wheelStyle?: any;
}

function WheelPicker<T extends number | string>({
  options,
  selectedValue,
  onChange,
  label,
  containerStyle,
  wheelStyle,
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
    <View style={[styles.pickerContainer, containerStyle]}>
      <Text style={[styles.pickerLabel, { color: colors.textSecondary }]}>
        {label}
      </Text>
      <View
        style={[styles.wheelContainer, { height: PICKER_HEIGHT }, wheelStyle]}
      >
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
            const isLongText = typeof item === "string" && item.length > 6;
            const fontSize = isSelected
              ? isLongText
                ? 14
                : 18
              : isLongText
                ? 11
                : 14;

            return (
              <View
                key={String(item)}
                style={[styles.itemWrapper, { height: ITEM_HEIGHT }]}
              >
                <Text
                  numberOfLines={1}
                  ellipsizeMode="tail"
                  style={[
                    styles.itemText,
                    {
                      color: isSelected
                        ? colors.text
                        : isDark
                          ? "#666"
                          : "#AAA",
                      fontWeight: isSelected ? "bold" : "normal",
                      fontSize,
                    },
                  ]}
                >
                  {typeof item === "number"
                    ? String(item).padStart(2, "0")
                    : item}
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
  const initialMinutes = initialDate.getMinutes();

  const getDayLabel = (offset: number) => {
    if (offset === 0) return "Hoje";
    if (offset === 1) return "Amanhã";
    const date = new Date();
    date.setDate(date.getDate() + offset);

    const weekdays = [
      "Domingo",
      "Segunda-feira",
      "Terça-feira",
      "Quarta-feira",
      "Quinta-feira",
      "Sexta-feira",
      "Sábado",
    ];
    const months = [
      "Jan",
      "Fev",
      "Mar",
      "Abr",
      "Mai",
      "Jun",
      "Jul",
      "Ago",
      "Set",
      "Out",
      "Nov",
      "Dez",
    ];

    const weekday = weekdays[date.getDay()];
    const day = date.getDate();
    const month = months[date.getMonth()];

    return `${weekday} ${day} ${month}`;
  };

  const daysLimit = 30; // 1 month limit
  const daysArray = Array.from({ length: daysLimit }, (_, i) => getDayLabel(i));
  const hoursArray = Array.from({ length: 24 }, (_, i) => i);
  const minutesArray = Array.from({ length: 60 }, (_, i) => i);

  // Fallback to "Hoje" if targetDay exceeds 1 month limit
  const initialDayLabel =
    initialDays < daysLimit ? getDayLabel(initialDays) : getDayLabel(0);

  const [selectedDayLabel, setSelectedDayLabel] = useState(initialDayLabel);
  const [hours, setHours] = useState(rawHours);
  const [minutes, setMinutes] = useState(initialMinutes);

  const onScheduleRef = useRef(onSchedule);
  useEffect(() => {
    onScheduleRef.current = onSchedule;
  }, [onSchedule]);

  useEffect(() => {
    const dayOffset = Math.max(0, daysArray.indexOf(selectedDayLabel));
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + dayOffset);

    targetDate.setHours(hours, minutes, 0, 0);

    // Se o horário selecionado já passou, agenda automaticamente para o dia seguinte
    if (targetDate.getTime() <= Date.now()) {
      targetDate.setDate(targetDate.getDate() + 1);
    }

    const delayMs = Math.max(60000, targetDate.getTime() - Date.now());
    onScheduleRef.current(delayMs);
  }, [selectedDayLabel, hours, minutes]);

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
          selectedValue={selectedDayLabel}
          onChange={setSelectedDayLabel}
          label="dias"
          containerStyle={{ flex: 2.2 }}
          wheelStyle={{ width: "95%" }}
        />
        <WheelPicker
          options={hoursArray}
          selectedValue={hours}
          onChange={setHours}
          label="horas"
          containerStyle={{ flex: 1 }}
          wheelStyle={{ width: "85%" }}
        />
        <WheelPicker
          options={minutesArray}
          selectedValue={minutes}
          onChange={setMinutes}
          label="min"
          containerStyle={{ flex: 1 }}
          wheelStyle={{ width: "85%" }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sheetContainer: {
    width: "100%",
    height: "32%",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: Platform.OS === "ios" ? 32 : 20,
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
