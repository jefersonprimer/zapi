import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Dimensions,
  Modal,
  PanResponder,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { Ionicons } from "@expo/vector-icons";
import * as FileSystem from "expo-file-system/legacy";
import { Path, Rect, Svg } from "react-native-svg";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAppTheme } from "@/context/ThemeContext";
import { type Attachment } from "./AttachCameraButton";

import { DRAWING_COLORS } from "./ColorModal";

const SCREEN_WIDTH = Dimensions.get("window").width;
const SCREEN_HEIGHT = Dimensions.get("window").height;

type Tool = "pencil" | "pen" | "brush" | "eraser";

type Point = {
  x: number;
  y: number;
};

type Stroke = {
  id: string;
  tool: Tool;
  color: string;
  width: number;
  opacity: number;
  points: Point[];
};

interface DrawingCanvasModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (attachment: Attachment) => void;
}

const TOOL_CONFIG: Record<
  Tool,
  {
    label: string;
    icon: keyof typeof MaterialCommunityIcons.glyphMap;
    width: number;
  }
> = {
  pencil: { label: "Lápis", icon: "lead-pencil", width: 2.5 },
  pen: { label: "Caneta", icon: "pencil", width: 4 },
  brush: { label: "Pincel", icon: "brush", width: 9 },
  eraser: { label: "Borracha", icon: "eraser", width: 18 },
};

const COLORS = DRAWING_COLORS;

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function pointsToPath(points: Point[]) {
  if (points.length === 0) return "";
  if (points.length === 1) {
    const point = points[0];
    return `M ${point.x} ${point.y} L ${point.x + 0.1} ${point.y + 0.1}`;
  }

  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i += 1) {
    const point = points[i];
    d += ` L ${point.x} ${point.y}`;
  }
  return d;
}

interface SliderProps {
  value: number;
  min: number;
  max: number;
  onChange: (val: number) => void;
  step?: number;
  width?: number;
}

function CustomSlider({
  value,
  min,
  max,
  onChange,
  step = 1,
  width = 100,
}: SliderProps) {
  const { colors } = useAppTheme();
  const [sliderWidth, setSliderWidth] = useState(width);

  const handleTouch = (event: any) => {
    const x = event.nativeEvent.locationX;
    const percentage = Math.max(0, Math.min(1, x / sliderWidth));
    const rawValue = min + percentage * (max - min);
    const steppedValue = Math.round(rawValue / step) * step;
    onChange(Math.max(min, Math.min(max, parseFloat(steppedValue.toFixed(2)))));
  };

  const percentage = ((value - min) / (max - min)) * 100;

  return (
    <View
      style={{
        width: width,
        height: 32,
        justifyContent: "center",
      }}
      onLayout={(e) => setSliderWidth(e.nativeEvent.layout.width)}
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      onResponderGrant={handleTouch}
      onResponderMove={handleTouch}
    >
      <View
        pointerEvents="none"
        style={{
          height: 4,
          backgroundColor: colors.border,
          borderRadius: 2,
          position: "relative",
        }}
      >
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            left: 0,
            width: `${percentage}%`,
            height: "100%",
            backgroundColor: colors.tint,
            borderRadius: 2,
          }}
        />
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            left: `${percentage}%`,
            marginLeft: -8,
            top: -6,
            width: 16,
            height: 16,
            borderRadius: 8,
            backgroundColor: "#FFFFFF",
            borderWidth: 2,
            borderColor: colors.tint,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.16,
            shadowRadius: 2,
            elevation: 2,
          }}
        />
      </View>
    </View>
  );
}

export function DrawingCanvasModal({
  visible,
  onClose,
  onSave,
}: DrawingCanvasModalProps) {
  const { colors, isDark } = useAppTheme();
  const [tool, setTool] = useState<Tool>("pen");
  const [activeColor, setActiveColor] = useState(COLORS[1]); // Começa com o preto suave index 1
  const [showPalette, setShowPalette] = useState(false);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [redoStack, setRedoStack] = useState<Stroke[]>([]);
  const [currentStroke, setCurrentStroke] = useState<Stroke | null>(null);

  const [opacity, setOpacity] = useState(1.0);
  const [toolWidths, setToolWidths] = useState<Record<Tool, number>>({
    pencil: 2.5,
    pen: 4,
    brush: 9,
    eraser: 18,
  });

  const strokeIdRef = useRef(0);
  const currentStrokeRef = useRef<Stroke | null>(null);
  const toolRef = useRef<Tool>("pen");
  const activeColorRef = useRef(COLORS[1]);
  const opacityRef = useRef(1.0);
  const toolWidthsRef = useRef(toolWidths);

  useEffect(() => {
    toolRef.current = tool;
  }, [tool]);

  useEffect(() => {
    activeColorRef.current = activeColor;
  }, [activeColor]);

  useEffect(() => {
    opacityRef.current = opacity;
  }, [opacity]);

  useEffect(() => {
    toolWidthsRef.current = toolWidths;
  }, [toolWidths]);

  const paletteShadow = useMemo(
    () => (isDark ? "rgba(0,0,0,0.28)" : "rgba(15, 23, 42, 0.12)"),
    [isDark],
  );

  const canvasWidth = canvasSize.width || SCREEN_WIDTH - 32;
  const canvasHeight = canvasSize.height || Math.max(420, SCREEN_HEIGHT * 0.56);

  const nextStrokeId = () => `stroke_${Date.now()}_${strokeIdRef.current++}`;

  const resetCanvas = () => {
    setTool("pen");
    setActiveColor(COLORS[1]);
    setShowPalette(false);
    setCanvasSize({ width: 0, height: 0 });
    setStrokes([]);
    setRedoStack([]);
    setCurrentStroke(null);
    currentStrokeRef.current = null;
    setOpacity(1.0);
    setToolWidths({
      pencil: 2.5,
      pen: 4,
      brush: 9,
      eraser: 18,
    });
  };

  useEffect(() => {
    if (!visible) {
      resetCanvas();
    }
  }, [visible]);

  const buildSvg = (strokesToRender: Stroke[]) => {
    const svgWidth = Math.max(1, Math.round(canvasWidth));
    const svgHeight = Math.max(1, Math.round(canvasHeight));
    const radius = 24;
    const paths = strokesToRender
      .map((stroke) => {
        const isEraser = stroke.tool === "eraser";
        const strokeColor = isEraser ? "#FFFFFF" : stroke.color;
        const path = pointsToPath(stroke.points);
        const opacityAttr = isEraser
          ? ""
          : `stroke-opacity="${stroke.opacity ?? 1}"`;
        return `
          <path
            d="${escapeXml(path)}"
            fill="none"
            stroke="${escapeXml(strokeColor)}"
            stroke-width="${stroke.width}"
            stroke-linecap="round"
            stroke-linejoin="round"
            ${opacityAttr}
          />
        `;
      })
      .join("");

    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${svgWidth}" height="${svgHeight}" viewBox="0 0 ${svgWidth} ${svgHeight}">
  <defs>
    <clipPath id="rounded-canvas">
      <rect x="0" y="0" width="${svgWidth}" height="${svgHeight}" rx="${radius}" ry="${radius}" />
    </clipPath>
  </defs>
  <g clip-path="url(#rounded-canvas)">
    <rect width="100%" height="100%" fill="#FFFFFF" rx="${radius}" ry="${radius}" />
    ${paths}
  </g>
</svg>`;
  };

  const finalizeCurrentStroke = () => {
    const stroke = currentStrokeRef.current;
    if (!stroke) return;

    setStrokes((prev) => [...prev, stroke]);
    setCurrentStroke(null);
    currentStrokeRef.current = null;
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponderCapture: () => true,
      onShouldBlockNativeResponder: () => true,
      onPanResponderGrant: (evt) => {
        setShowPalette(false);
        const { locationX, locationY } = evt.nativeEvent;
        const currentTool = toolRef.current;
        const currentColor = activeColorRef.current;
        const currentWidth = toolWidthsRef.current[currentTool];
        const currentOpacity = opacityRef.current;
        const stroke: Stroke = {
          id: nextStrokeId(),
          tool: currentTool,
          color: currentColor,
          width: currentWidth,
          opacity: currentOpacity,
          points: [{ x: locationX, y: locationY }],
        };

        currentStrokeRef.current = stroke;
        setCurrentStroke(stroke);
        setRedoStack([]);
      },
      onPanResponderMove: (evt) => {
        const stroke = currentStrokeRef.current;
        if (!stroke) return;

        const { locationX, locationY } = evt.nativeEvent;
        const nextPoints = [...stroke.points, { x: locationX, y: locationY }];
        const nextStroke = { ...stroke, points: nextPoints };
        currentStrokeRef.current = nextStroke;
        setCurrentStroke(nextStroke);
      },
      onPanResponderRelease: () => {
        finalizeCurrentStroke();
      },
      onPanResponderTerminate: () => {
        finalizeCurrentStroke();
      },
    }),
  ).current;

  const handleUndo = () => {
    setShowPalette(false);
    setStrokes((prev) => {
      if (prev.length === 0) return prev;
      const next = prev.slice(0, -1);
      const removed = prev[prev.length - 1];
      setRedoStack((redoPrev) => [removed, ...redoPrev]);
      return next;
    });
  };

  const handleRedo = () => {
    setShowPalette(false);
    setRedoStack((prev) => {
      if (prev.length === 0) return prev;
      const [restored, ...remaining] = prev;
      setStrokes((strokePrev) => [...strokePrev, restored]);
      return remaining;
    });
  };

  const handleClear = () => {
    Alert.alert("Apagar desenho", "Deseja limpar toda a tela?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Limpar",
        style: "destructive",
        onPress: () => {
          setStrokes([]);
          setCurrentStroke(null);
          currentStrokeRef.current = null;
          setRedoStack([]);
          setShowPalette(false);
        },
      },
    ]);
  };

  const handleSave = async () => {
    const allStrokes = currentStrokeRef.current
      ? [...strokes, currentStrokeRef.current]
      : strokes;
    const svg = buildSvg(allStrokes);
    const filename = `drawing_${Date.now()}.svg`;
    const fileUri = `${FileSystem.documentDirectory}${filename}`;

    try {
      await FileSystem.writeAsStringAsync(fileUri, svg, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      onSave({
        uri: fileUri,
        name: filename,
        type: "image",
        mimeType: "image/svg+xml",
        size: svg.length,
        previewSvg: svg,
      });
      onClose();
    } catch (err: any) {
      Alert.alert(
        "Erro ao salvar",
        err?.message || "Não foi possível salvar o desenho.",
      );
    }
  };

  const renderStroke = (stroke: Stroke) => {
    const isEraser = stroke.tool === "eraser";
    const color = isEraser ? "#FFFFFF" : stroke.color;
    const path = pointsToPath(stroke.points);

    return (
      <Path
        key={stroke.id}
        d={path}
        fill="none"
        stroke={color}
        strokeWidth={stroke.width}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeOpacity={isEraser ? 1 : stroke.opacity}
      />
    );
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <SafeAreaView style={[styles.safeArea, { backgroundColor: "#FFFFFF" }]}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={onClose}
            style={[
              styles.headerButton,
              {
                borderColor: colors.border,
                backgroundColor: isDark
                  ? "rgba(30, 30, 30, 0.98)"
                  : "rgba(255, 255, 255, 0.98)",
              },
            ]}
            hitSlop={12}
          >
            <Ionicons name="close" size={24} color={colors.textSecondary} />
          </TouchableOpacity>

          <View style={styles.headerActions}>
            <View
              style={[
                styles.segmentedGroup,
                {
                  borderColor: colors.border,
                  backgroundColor: isDark
                    ? "rgba(30, 30, 30, 0.98)"
                    : "rgba(255, 255, 255, 0.98)",
                },
              ]}
            >
              <TouchableOpacity
                onPress={handleUndo}
                style={styles.segmentedButton}
                hitSlop={8}
                disabled={strokes.length === 0}
              >
                <MaterialCommunityIcons
                  name="undo-variant"
                  size={24}
                  color={
                    strokes.length === 0 ? colors.textSecondary : colors.text
                  }
                />
              </TouchableOpacity>

              <View
                style={[
                  styles.segmentedDivider,
                  { backgroundColor: colors.border },
                ]}
              />

              <TouchableOpacity
                onPress={handleRedo}
                style={styles.segmentedButton}
                hitSlop={8}
                disabled={redoStack.length === 0}
              >
                <MaterialCommunityIcons
                  name="redo-variant"
                  size={24}
                  color={
                    redoStack.length === 0 ? colors.textSecondary : colors.text
                  }
                />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              onPress={handleSave}
              style={[
                styles.headerButton,
                { backgroundColor: "#34C759", borderColor: "#34C759" },
              ]}
              hitSlop={12}
            >
              <Ionicons name="checkmark" size={24} color="#ffffff" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.body}>
          <View
            style={[
              styles.canvasFrame,
              {
                backgroundColor: "#FFFFFF",
                shadowColor: paletteShadow,
              },
            ]}
            onLayout={(event) => {
              const { width, height } = event.nativeEvent.layout;
              if (width !== canvasSize.width || height !== canvasSize.height) {
                setCanvasSize({ width, height });
              }
            }}
          >
            <View style={StyleSheet.absoluteFill} {...panResponder.panHandlers}>
              <Svg
                pointerEvents="none"
                width="100%"
                height="100%"
                viewBox={`0 0 ${canvasWidth} ${canvasHeight}`}
              >
                <Rect
                  x="0"
                  y="0"
                  width={canvasWidth}
                  height={canvasHeight}
                  fill="#FFFFFF"
                />
                {strokes.map(renderStroke)}
                {currentStroke ? renderStroke(currentStroke) : null}
              </Svg>
            </View>
          </View>
        </View>

        <View style={[styles.toolbarWrap, { backgroundColor: colors.surface }]}>
          {/* Controles de tamanho e opacidade */}
          <View style={styles.adjustmentsRow}>
            <View style={styles.adjustmentItem}>
              <Text
                style={[
                  styles.adjustmentLabel,
                  { color: colors.textSecondary },
                ]}
              >
                Tam: {toolWidths[tool]}px
              </Text>
              <CustomSlider
                value={toolWidths[tool]}
                min={1}
                max={
                  tool === "pencil"
                    ? 15
                    : tool === "pen"
                      ? 30
                      : tool === "brush"
                        ? 60
                        : 100
                }
                step={tool === "pencil" ? 0.5 : 1}
                width={100}
                onChange={(val) => {
                  setToolWidths((prev) => ({
                    ...prev,
                    [tool]: val,
                  }));
                }}
              />
            </View>

            {tool !== "eraser" && (
              <View style={styles.adjustmentItem}>
                <Text
                  style={[
                    styles.adjustmentLabel,
                    { color: colors.textSecondary },
                  ]}
                >
                  Opac: {Math.round(opacity * 100)}%
                </Text>
                <CustomSlider
                  value={opacity}
                  min={0.1}
                  max={1.0}
                  step={0.05}
                  width={100}
                  onChange={(val) => {
                    setOpacity(val);
                  }}
                />
              </View>
            )}
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.toolbarContent}
          >
            <TouchableOpacity
              style={[
                styles.actionPill,
                {
                  backgroundColor: showPalette ? colors.tint : "transparent",
                  borderColor: colors.border,
                },
              ]}
              onPress={() => setShowPalette((prev) => !prev)}
            >
              <MaterialCommunityIcons
                name="palette"
                size={22}
                color={showPalette ? "#fff" : colors.text}
              />
            </TouchableOpacity>

            {(["pencil", "pen", "brush", "eraser"] as Tool[]).map((item) => {
              const active = tool === item;
              return (
                <TouchableOpacity
                  key={item}
                  style={[
                    styles.toolButton,
                    {
                      backgroundColor: active ? colors.tint : "transparent",
                      borderColor: colors.border,
                    },
                  ]}
                  onPress={() => {
                    setTool(item);
                    setShowPalette(false);
                  }}
                >
                  <MaterialCommunityIcons
                    name={TOOL_CONFIG[item].icon}
                    size={20}
                    color={active ? "#fff" : colors.text}
                  />
                  <Text
                    style={[
                      styles.toolLabel,
                      { color: active ? "#fff" : colors.textSecondary },
                    ]}
                  >
                    {TOOL_CONFIG[item].label}
                  </Text>
                </TouchableOpacity>
              );
            })}

            <TouchableOpacity
              style={[styles.actionPill, { borderColor: colors.border }]}
              onPress={handleClear}
            >
              <MaterialCommunityIcons
                name="delete-outline"
                size={22}
                color={colors.text}
              />
            </TouchableOpacity>
          </ScrollView>

          {showPalette && (
            <ScrollView style={{ maxHeight: 150 }} nestedScrollEnabled>
              <View
                style={[styles.paletteRow, { borderTopColor: colors.border }]}
              >
                {COLORS.map((color) => {
                  const isActive = activeColor === color;
                  return (
                    <TouchableOpacity
                      key={color}
                      onPress={() => {
                        setActiveColor(color);
                        setShowPalette(false);
                      }}
                      style={[
                        styles.colorChip,
                        {
                          backgroundColor: color,
                          borderColor:
                            color === "#FFFFFF" ? colors.border : color,
                          shadowColor: paletteShadow,
                        },
                        isActive && styles.colorChipActive,
                      ]}
                    >
                      {isActive ? (
                        <MaterialCommunityIcons
                          name="check"
                          size={14}
                          color={color === "#FFFFFF" ? "#111827" : "#FFFFFF"}
                        />
                      ) : null}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>
          )}
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 20,
    borderWidth: 1,
  },
  segmentedGroup: {
    flexDirection: "row",
    alignItems: "center",
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 4,
  },
  segmentedButton: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  segmentedDivider: {
    width: 1,
    height: 18,
  },
  body: {
    flex: 1,
    justifyContent: "center",
  },
  canvasFrame: {
    flex: 1,
    overflow: "hidden",
  },
  toolbarWrap: {
    paddingTop: 12,
    paddingBottom: 14,
  },
  toolbarContent: {
    paddingHorizontal: 14,
    alignItems: "center",
    gap: 10,
  },
  toolButton: {
    minWidth: 78,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  toolLabel: {
    marginTop: 4,
    fontSize: 11,
    fontWeight: "600",
  },
  actionPill: {
    width: 52,
    height: 52,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  paletteRow: {
    paddingHorizontal: 14,
    paddingTop: 12,
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "flex-start",
    gap: 10,
  },
  colorChip: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    shadowOpacity: 0.16,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  colorChipActive: {
    transform: [{ scale: 1.08 }],
  },
  adjustmentsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginBottom: 8,
  },
  adjustmentItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  adjustmentLabel: {
    fontSize: 12,
    fontWeight: "600",
  },
  stepperContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  stepperButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
