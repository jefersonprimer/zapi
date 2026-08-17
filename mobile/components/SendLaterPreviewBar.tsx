import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAppTheme } from "@/context/ThemeContext";

interface SendLaterPreviewBarProps {
  delayMs: number;
  onPress: () => void;
  onClear: () => void;
}

export const SendLaterPreviewBar: React.FC<SendLaterPreviewBarProps> = ({
  delayMs,
  onPress,
  onClear,
}) => {
  const { colors, isDark } = useAppTheme();

  const getScheduledDateTimeString = (delay: number) => {
    const now = new Date();
    const targetDate = new Date(Date.now() + delay);

    const isToday =
      targetDate.getDate() === now.getDate() &&
      targetDate.getMonth() === now.getMonth() &&
      targetDate.getFullYear() === now.getFullYear();

    const tomorrow = new Date(now);
    tomorrow.setDate(now.getDate() + 1);
    const isTomorrow =
      targetDate.getDate() === tomorrow.getDate() &&
      targetDate.getMonth() === tomorrow.getMonth() &&
      targetDate.getFullYear() === tomorrow.getFullYear();

    const diffTime = targetDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    let dayLabel = "";
    if (isToday) {
      dayLabel = "Hoje";
    } else if (isTomorrow) {
      dayLabel = "Amanhã";
    } else if (diffDays > 0 && diffDays < 7) {
      const weekdays = [
        "Domingo",
        "Segunda",
        "Terça",
        "Quarta",
        "Quinta",
        "Sexta",
        "Sábado",
      ];
      dayLabel = weekdays[targetDate.getDay()];
    } else {
      const day = String(targetDate.getDate()).padStart(2, "0");
      const month = String(targetDate.getMonth() + 1).padStart(2, "0");
      dayLabel = `${day}/${month}`;
    }

    const hours = targetDate.getHours();
    const minutes = String(targetDate.getMinutes()).padStart(2, "0");
    const ampm = hours >= 12 ? "PM" : "AM";
    const displayHours = hours % 12 || 12;
    const timeString = `${displayHours}:${minutes} ${ampm}`;

    return `${dayLabel} às ${timeString}`;
  };

  const greenColor = isDark ? "#34C759" : "#07C160";
  const iconColor = isDark ? "#34C759" : "#07C160";

  return (
    <View
      style={[
        styles.container,
        {
          borderColor: isDark
            ? "rgba(52, 199, 89, 0.4)"
            : "rgba(7, 193, 96, 0.4)",
        },
      ]}
    >
      <Ionicons
        name="time-outline"
        size={20}
        color={iconColor}
        style={styles.clockIcon}
      />
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={onPress}
        style={styles.content}
      >
        <View style={styles.textContainer}>
          <Text style={[styles.text, { color: colors.textSecondary }]}>
            Enviar{" "}
            <Text style={[styles.scheduledText, { color: greenColor }]}>
              {getScheduledDateTimeString(delayMs)}
            </Text>
          </Text>
          <Ionicons
            name="chevron-forward"
            size={16}
            color={greenColor}
            style={styles.chevronIcon}
          />
        </View>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.closeBtn}
        onPress={onClear}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
      >
        <Ionicons name="close" size={20} color={greenColor} />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 50,
    borderWidth: 1.5,
    borderStyle: "dashed",
    alignSelf: "center",
    marginVertical: 8,
    marginHorizontal: 12,
  },
  clockIcon: {
    marginRight: 6,
  },
  content: {
    flex: 1,
    justifyContent: "center",
  },
  textContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
  },
  text: {
    fontSize: 14,
    fontWeight: "400",
  },
  scheduledText: {
    fontWeight: "500",
  },
  chevronIcon: {
    marginLeft: 4,
  },
  closeBtn: {
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 8,
  },
});
