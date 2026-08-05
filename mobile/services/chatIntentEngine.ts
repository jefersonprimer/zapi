import { ItemType } from "@/types/item";

export interface IntentDetectionResult {
  intent: ItemType;
  score: number;
  entities: {
    title: string;
    content: string;
    date?: string;
    time?: string;
    dueDate?: string;
    start?: string;
    end?: string;
  };
}

export interface IntentSuggestion extends IntentDetectionResult {
  id: string;
  type: ItemType;
  confidence: number;
  matchedText: string;
}

export interface MultiIntentResult {
  isNote: boolean;
  isReminder: boolean;
  isEvent: boolean;
  noteSuggestion?: IntentSuggestion;
  reminderSuggestion?: IntentSuggestion;
  eventSuggestion?: IntentSuggestion;
  topSuggestion?: IntentSuggestion;
}

// ────────────────────────────────────────────────────────
// DICIONÁRIOS E PESOS DOS DETECTORES INDEPENDENTES
// ────────────────────────────────────────────────────────

/** 1. DETECTOR DE NOTAS (`detectNoteIntent`) */
const NOTE_WORDS = [
  "anota", "anote", "anotar", "escreve", "escrever", "lista", "compra", "comprar",
  "mercado", "guardar", "salvar", "adiciona", "coloca na lista", "itens", "produtos"
];

const GROCERY_CATEGORIES = [
  "arroz", "feijão", "feijao", "leite", "pão", "pao", "café", "cafe", "açúcar", "acucar",
  "óleo", "oleo", "macarrão", "macarrao", "ovo", "ovos", "carne", "frango", "queijo",
  "presunto", "manteiga", "banana", "maçã", "maca", "tomate", "cebola", "batata", "azeite",
  "sabão", "sabao", "amaciante", "papel higiênico", "papel higienico", "detergente"
];

const EXCLUDED_HIGH_VALUE = ["carro", "casa", "apartamento", "moto", "terreno", "notebook", "iphone"];

/** 2. DETECTOR DE LEMBRETE (`detectReminderIntent`) */
const REMINDER_VERBS = [
  "lembra", "lembrar", "me lembra", "não esquece", "nao esquece", "não esquecer",
  "nao esquecer", "preciso", "tenho que", "devo", "não posso esquecer", "nao posso esquecer"
];

const REMINDER_ACTIONS = [
  "pagar", "buscar", "ligar", "enviar", "mandar", "comprar", "estudar", "cancelar",
  "resolver", "entregar", "renovar", "marcar"
];

/** 3. DETECTOR DE EVENTO (`detectEventIntent`) */
const EVENT_VERBS = [
  "vamos", "marcar", "encontrar", "reunir", "reunião", "reuniao", "almoçar", "almoco",
  "jantar", "tomar café", "tomar cafe", "viajar", "consulta", "aniversário", "aniversario",
  "casamento", "festa", "show", "cinema"
];

const EVENT_CONFIRMATIONS = [
  "fechado", "combinado", "beleza", "ok", "pode ser", "confirmado", "bora", "vamos sim"
];

/** DATAS & HORÁRIOS COMPARTILHADOS (+30 cada) */
const DATE_KEYWORDS = [
  "amanhã", "amanha", "hoje", "sexta", "segunda", "terça", "terca", "quarta", "quinta",
  "sábado", "sabado", "domingo", "daqui a pouco", "semana que vem", "mês que vem", "mes que vem"
];

const TIME_REGEX = /(?:às|as|à|a)?\s*(\d{1,2})(?:h|:|hs|hrs|\s*horas?)(?:(\d{2}))?/i;
const DATE_REGEX = /(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/;

// ────────────────────────────────────────────────────────
// DETECTORES INDEPENDENTES
// ────────────────────────────────────────────────────────

/**
 * 📝 Detector 1: Intent de Nota
 */
export function detectNoteIntent(text: string): IntentDetectionResult {
  const lower = text.toLowerCase();
  const rawLines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  let score = 0;

  // Descarte de falsos positivos
  if (EXCLUDED_HIGH_VALUE.some((ex) => lower.includes(ex))) {
    return { intent: "note", score: 0, entities: { title: "Nota", content: text } };
  }

  // Estrutura de Lista (+40 se tiver bullets, +30 se forem 3+ linhas curtas)
  const hasBullets = rawLines.length >= 2 && rawLines.some((l) => /^[-•*\[\]\d\.]/.test(l));
  const isMultiShortLines = rawLines.length >= 3 && rawLines.every((l) => l.length <= 35 && !/[?!]/.test(l));

  if (hasBullets) score += 40;
  if (isMultiShortLines) score += 30;

  // Palavras de nota/compra (+30)
  if (NOTE_WORDS.some((word) => lower.includes(word))) {
    score += 30;
  }

  // Produtos de lista (+10 cada)
  GROCERY_CATEGORIES.forEach((prod) => {
    if (lower.includes(prod)) score += 10;
  });

  let title = "Lista de compras";
  if (rawLines.length > 0 && !/^[-•*\[\]\d\.]/.test(rawLines[0]) && rawLines[0].length < 30) {
    title = rawLines[0].replace(/[:]$/, "");
  }

  return {
    intent: "note",
    score,
    entities: { title, content: text },
  };
}

/**
 * ⏰ Detector 2: Intent de Lembrete
 */
export function detectReminderIntent(text: string): IntentDetectionResult {
  const lower = text.toLowerCase();
  let score = 0;

  // Verbos (+40)
  const hasVerb = REMINDER_VERBS.some((v) => lower.includes(v));
  if (hasVerb) score += 40;

  // Ações (+20)
  const hasAction = REMINDER_ACTIONS.some((a) => lower.includes(a));
  if (hasAction) score += 20;

  // Datas (+30)
  const hasDate = DATE_KEYWORDS.some((d) => lower.includes(d)) || DATE_REGEX.test(lower);
  if (hasDate) score += 30;

  // Horários (+30)
  const hasTime = TIME_REGEX.test(lower);
  if (hasTime) score += 30;

  // Parser de data/hora
  const now = new Date();
  let targetDate = new Date(now);
  if (lower.includes("amanhã") || lower.includes("amanha")) {
    targetDate.setDate(targetDate.getDate() + 1);
  }
  const timeMatch = lower.match(TIME_REGEX);
  if (timeMatch) {
    const hours = parseInt(timeMatch[1], 10);
    const minutes = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
    targetDate.setHours(hours, minutes, 0, 0);
  } else {
    targetDate.setHours(18, 0, 0, 0);
  }

  return {
    intent: "reminder",
    score,
    entities: {
      title: text.length > 35 ? text.substring(0, 35) + "..." : text,
      content: text,
      dueDate: targetDate.toISOString(),
    },
  };
}

/**
 * 📅 Detector 3: Intent de Evento
 */
export function detectEventIntent(text: string): IntentDetectionResult {
  const lower = text.toLowerCase();
  let score = 0;

  // Verbos / Compromissos (+35)
  const hasVerb = EVENT_VERBS.some((v) => lower.includes(v));
  if (hasVerb) score += 35;

  // Confirmações (+20)
  const hasConfirm = EVENT_CONFIRMATIONS.some((c) => lower.includes(c));
  if (hasConfirm) score += 20;

  // Datas (+30)
  const hasDate = DATE_KEYWORDS.some((d) => lower.includes(d)) || DATE_REGEX.test(lower);
  if (hasDate) score += 30;

  // Horários (+30)
  const hasTime = TIME_REGEX.test(lower);
  if (hasTime) score += 30;

  // Parser de data/hora
  const now = new Date();
  let targetDate = new Date(now);
  if (lower.includes("amanhã") || lower.includes("amanha")) {
    targetDate.setDate(targetDate.getDate() + 1);
  }
  const timeMatch = lower.match(TIME_REGEX);
  if (timeMatch) {
    const hours = parseInt(timeMatch[1], 10);
    const minutes = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
    targetDate.setHours(hours, minutes, 0, 0);
  } else {
    targetDate.setHours(14, 0, 0, 0);
  }

  return {
    intent: "event",
    score,
    entities: {
      title: text.length > 35 ? text.substring(0, 35) + "..." : text,
      content: text,
      start: targetDate.toISOString(),
      end: new Date(targetDate.getTime() + 3600000).toISOString(),
    },
  };
}

// ────────────────────────────────────────────────────────
// ANÁLISE GLOBAL E COMPARAÇÃO DE SCORE
// ────────────────────────────────────────────────────────

/**
 * Executa os 3 detectores independentes, calcula e compara a pontuação de cada um.
 */
export function analyzeMessageMultiIntents(text: string): MultiIntentResult {
  const noteResult = detectNoteIntent(text);
  const reminderResult = detectReminderIntent(text);
  const eventResult = detectEventIntent(text);

  // Cortes mínimos de confiança para cada tipo (Lembrete: 50, Evento: 50, Nota: 40)
  const isNote = noteResult.score >= 40;
  const isReminder = reminderResult.score >= 50;
  const isEvent = eventResult.score >= 50;

  const noteSuggestion: IntentSuggestion | undefined = isNote
    ? {
        id: Math.random().toString(),
        type: "note",
        confidence: noteResult.score,
        matchedText: text,
        title: noteResult.entities.title,
        content: noteResult.entities.content,
        intent: "note",
        score: noteResult.score,
        entities: noteResult.entities,
      }
    : undefined;

  const reminderSuggestion: IntentSuggestion | undefined = isReminder
    ? {
        id: Math.random().toString(),
        type: "reminder",
        confidence: reminderResult.score,
        matchedText: text,
        title: reminderResult.entities.title,
        content: reminderResult.entities.content,
        dueDate: reminderResult.entities.dueDate,
        intent: "reminder",
        score: reminderResult.score,
        entities: reminderResult.entities,
      }
    : undefined;

  const eventSuggestion: IntentSuggestion | undefined = isEvent
    ? {
        id: Math.random().toString(),
        type: "event",
        confidence: eventResult.score,
        matchedText: text,
        title: eventResult.entities.title,
        content: eventResult.entities.content,
        start: eventResult.entities.start,
        end: eventResult.entities.end,
        intent: "event",
        score: eventResult.score,
        entities: eventResult.entities,
      }
    : undefined;

  // Descobre a sugestão com maior pontuação (Top Suggestion)
  let topSuggestion: IntentSuggestion | undefined = undefined;
  const allSuggestions = [noteSuggestion, reminderSuggestion, eventSuggestion].filter(
    (s): s is IntentSuggestion => s !== undefined
  );

  if (allSuggestions.length > 0) {
    allSuggestions.sort((a, b) => b.score - a.score);
    topSuggestion = allSuggestions[0];
  }

  return {
    isNote,
    isReminder,
    isEvent,
    noteSuggestion,
    reminderSuggestion,
    eventSuggestion,
    topSuggestion,
  };
}

/** Compatibilidade */
export function analyzeMessageRules(text: string): IntentSuggestion | null {
  const result = analyzeMessageMultiIntents(text);
  return result.topSuggestion || null;
}
