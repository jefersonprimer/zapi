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
import * as FileSystem from "expo-file-system/legacy";
import {
  Path,
  Rect,
  Svg,
} from "react-native-svg";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAppTheme } from "@/context/ThemeContext";
import { type Attachment } from "./AttachCameraButton";

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
  points: Point[];
};

interface DrawingCanvasModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (attachment: Attachment) => void;
}

const TOOL_CONFIG: Record<Tool, { label: string; icon: keyof typeof MaterialCommunityIcons.glyphMap; width: number }> = {
  pencil: { label: "Lápis", icon: "lead-pencil", width: 2.5 },
  pen: { label: "Caneta", icon: "pencil", width: 4 },
  brush: { label: "Pincel", icon: "brush", width: 9 },
  eraser: { label: "Borracha", icon: "eraser", width: 18 },
};

const COLORS = [
  "#111827",
  "#E11D48",
  "#F97316",
  "#EAB308",
  "#22C55E",
  "#06B6D4",
  "#3B82F6",
  "#8B5CF6",
  "#FFFFFF",
];

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

export function DrawingCanvasModal({
  visible,
  onClose,
  onSave,
}: DrawingCanvasModalProps) {
  const { colors, isDark } = useAppTheme();
  const [tool, setTool] = useState<Tool>("pen");
  const [activeColor, setActiveColor] = useState(COLORS[0]);
  const [showPalette, setShowPalette] = useState(false);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [redoStack, setRedoStack] = useState<Stroke[]>([]);
  const [currentStroke, setCurrentStroke] = useState<Stroke | null>(null);

  const strokeIdRef = useRef(0);
  const currentStrokeRef = useRef<Stroke | null>(null);
  const toolRef = useRef<Tool>("pen");
  const activeColorRef = useRef(COLORS[0]);

  useEffect(() => {
    toolRef.current = tool;
  }, [tool]);

  useEffect(() => {
    activeColorRef.current = activeColor;
  }, [activeColor]);

  const paletteShadow = useMemo(
    () =>
      isDark
        ? "rgba(0,0,0,0.28)"
        : "rgba(15, 23, 42, 0.12)",
    [isDark],
  );

  const canvasWidth = canvasSize.width || SCREEN_WIDTH - 32;
  const canvasHeight = canvasSize.height || Math.max(420, SCREEN_HEIGHT * 0.56);

  const nextStrokeId = () => `stroke_${Date.now()}_${strokeIdRef.current++}`;

  const resetCanvas = () => {
    setTool("pen");
    setActiveColor(COLORS[0]);
    setShowPalette(false);
    setCanvasSize({ width: 0, height: 0 });
    setStrokes([]);
    setRedoStack([]);
    setCurrentStroke(null);
    currentStrokeRef.current = null;
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
        return `
          <path
            d="${escapeXml(path)}"
            fill="none"
            stroke="${escapeXml(strokeColor)}"
            stroke-width="${stroke.width}"
            stroke-linecap="round"
            stroke-linejoin="round"
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
        const stroke: Stroke = {
          id: nextStrokeId(),
          tool: currentTool,
          color: currentColor,
          width: TOOL_CONFIG[currentTool].width,
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
        const nextPoints = [
          ...stroke.points,
          { x: locationX, y: locationY },
        ];
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
    Alert.alert(
      "Apagar desenho",
      "Deseja limpar toda a tela?",
      [
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
      ],
    );
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
      Alert.alert("Erro ao salvar", err?.message || "Não foi possível salvar o desenho.");
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
      />
    );
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { borderBottomColor: colors.border, backgroundColor: colors.surface }]}>
          <TouchableOpacity onPress={onClose} style={styles.headerButton} hitSlop={12}>
            <MaterialCommunityIcons name="arrow-left" size={24} color={colors.text} />
          </TouchableOpacity>

          <View style={styles.headerActions}>
            <TouchableOpacity
              onPress={handleUndo}
              style={styles.headerButton}
              hitSlop={12}
              disabled={strokes.length === 0}
            >
              <MaterialCommunityIcons
                name="undo"
                size={24}
                color={strokes.length === 0 ? colors.textSecondary : colors.text}
              />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleRedo}
              style={styles.headerButton}
              hitSlop={12}
              disabled={redoStack.length === 0}
            >
              <MaterialCommunityIcons
                name="redo"
                size={24}
                color={redoStack.length === 0 ? colors.textSecondary : colors.text}
              />
            </TouchableOpacity>
            <TouchableOpacity onPress={handleSave} style={styles.headerButton} hitSlop={12}>
              <MaterialCommunityIcons name="check" size={24} color={colors.tint} />
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
                <Rect x="0" y="0" width={canvasWidth} height={canvasHeight} fill="#FFFFFF" />
                {strokes.map(renderStroke)}
                {currentStroke ? renderStroke(currentStroke) : null}
              </Svg>
            </View>
          </View>
        </View>

        <View style={[styles.toolbarWrap, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.toolbarContent}
          >
            <TouchableOpacity
              style={[styles.actionPill, { backgroundColor: showPalette ? colors.tint : "transparent", borderColor: colors.border }]}
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
                  <Text style={[styles.toolLabel, { color: active ? "#fff" : colors.textSecondary }]}>
                    {TOOL_CONFIG[item].label}
                  </Text>
                </TouchableOpacity>
              );
            })}

            <TouchableOpacity
              style={[styles.actionPill, { borderColor: colors.border }]}
              onPress={handleClear}
            >
              <MaterialCommunityIcons name="delete-outline" size={22} color={colors.text} />
            </TouchableOpacity>
          </ScrollView>

          {showPalette && (
            <View style={[styles.paletteRow, { borderTopColor: colors.border }]}>
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
                        borderColor: color === "#FFFFFF" ? colors.border : color,
                        shadowColor: paletteShadow,
                      },
                      isActive && styles.colorChipActive,
                    ]}
                  >
                    {color === "#FFFFFF" ? (
                      <MaterialCommunityIcons name="check" size={14} color="#111827" />
                    ) : null}
                  </TouchableOpacity>
                );
              })}
            </View>
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
    borderBottomWidth: StyleSheet.hairlineWidth,
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
  },
  body: {
    flex: 1,
    padding: 16,
    justifyContent: "center",
  },
  canvasFrame: {
    flex: 1,
    borderRadius: 24,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.06)",
    shadowOpacity: 0.12,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    elevation: 4,
  },
  toolbarWrap: {
    borderTopWidth: StyleSheet.hairlineWidth,
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
    marginTop: 12,
    paddingHorizontal: 14,
    paddingTop: 12,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  colorChip: {
    width: 34,
    height: 34,
    borderRadius: 17,
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
});
