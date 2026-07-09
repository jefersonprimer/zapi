import React, { useState, useEffect } from "react";
import { Text, StyleSheet } from "react-native";

export default function CallTimer() {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, "0");
    const s = (secs % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  return <Text style={styles.timer}>{formatTime(seconds)}</Text>;
}

const styles = StyleSheet.create({
  timer: {
    fontSize: 18,
    fontWeight: "600",
    color: "#ffffff",
    letterSpacing: 1.5,
    fontVariant: ["tabular-nums"],
  },
});
