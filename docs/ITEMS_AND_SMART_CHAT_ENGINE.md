# 📝 Arquitetura & Implementação: Núcleo Integrado de Items (Notas, Lembretes, Eventos) e Conversa Inteligente

Este documento descreve detalhadamente a arquitetura, modelo de dados, fluxos de conversão, integração nativa e motor de inteligência de conversa em 3 camadas implementados no Superapp.

---

## 🌟 1. Visão Geral

O Superapp adota o conceito de **Núcleo Comum (Unified Item Engine)**. Em vez de isolar Notas, Lembretes e Eventos em sistemas totalmente fechados, todos derivam da entidade central **`Item`**, permitindo:
- **Conversão nativa em 1 toque**: Nota ➔ Lembrete ➔ Evento e Evento ➔ Nota de Reunião.
- **Busca global unificada**: Pesquisa local/remota trazendo todos os tipos com filtros por aba.
- **Sugestões automáticas no Chat**: Leitura inteligente do contexto das conversas para sugerir criação de itens sem esforço do usuário.

---

## 🗄️ 2. Modelo de Dados & Schema

### 2.1 Tipagem TypeScript (`mobile/types/item.ts`)
```ts
export type ItemType = 'note' | 'reminder' | 'event';
export type Priority = 'none' | 'low' | 'medium' | 'high';
export type RepeatPattern = 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom';

export interface BaseItem {
  id: string;
  type: ItemType;
  title: string;
  content?: string;
  color?: string;
  pinned: boolean;
  archived: boolean;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
  syncedAt?: string | null;
}

export interface NoteItem extends BaseItem {
  type: 'note';
  noteType: 'text' | 'checklist' | 'drawing';
  checklist?: { id: string; text: string; completed: boolean }[];
}

export interface ReminderItem extends BaseItem {
  type: 'reminder';
  dueDate?: string;
  completed: boolean;
  completedAt?: string | null;
  priority: Priority;
  repeat: RepeatPattern;
  notificationId?: string | null;
}

export interface EventItem extends BaseItem {
  type: 'event';
  start: string;
  end: string;
  allDay: boolean;
  location?: string;
  participants: string[];
  repeat: RepeatPattern;
  deviceCalendarEventId?: string | null;
}
```

### 2.2 Tabelas SQLite (`mobile/services/database.ts`) e Postgres (`backend/migrations/079_create_items_unified.sql`)
- `items`: id, user_id, type, title, content, color, pinned, archived, tags_json, created_at, updated_at, deleted_at.
- `note_details`: item_id, note_type, checklist_json.
- `reminder_details`: item_id, due_date, completed, completed_at, priority, repeat_pattern, location_trigger_json, notification_id.
- `event_details`: item_id, start_at, end_at, all_day, location, participants_json, repeat_pattern, device_calendar_event_id.

---

## ⚡ 3. Sincronização & Integrações Nativas

1. **Notificações Locais (`mobile/services/itemNotificationService.ts`)**:
   - Utiliza `expo-notifications` para agendar alarmes no horário exato de vencimento/início, funcionando mesmo offline ou com o aplicativo fechado.

2. **Calendário do Celular (`mobile/services/deviceCalendarService.ts`)**:
   - Integração opcional (`syncWithDeviceCalendar`) via `expo-calendar`.
   - Injeta eventos no Google Calendar (Android) ou Apple Calendar (iOS).

---

## 🤖 4. Conversa Inteligente & Motor de Intenção (3 Detectores Independentes)

Localizado em [`mobile/services/chatIntentEngine.ts`](file:///home/primer/Documents/zapi/mobile/services/chatIntentEngine.ts).

### 4.1 Arquitetura dos 3 Detectores Isolados
Em vez de um único regex monolítico, o sistema é divido em **3 detectores independentes**:
1. `detectNoteIntent(message)`
2. `detectReminderIntent(message)`
3. `detectEventIntent(message)`

Cada detector retorna a pontuação de intenção (`score`) e as entidades extraídas (`title`, `content`, `dueDate`, `start`, `end`).

### 4.2 Tabela de Pesos e Regras por Tipo

| Tipo | Categoria | Palavras / Regras | Peso (Pontos) |
|---|---|---|---|
| **📝 Nota** | **Palavras** | `anota`, `anote`, `escreve`, `lista`, `compra`, `comprar`, `guardar`, `salvar`, `adiciona`, `coloca na lista` | **+30** |
| | **Categorias** | Produtos de supermercado, farmácia e casa | **+10 por item** |
| | **Estrutura** | Formatado em marcadores (`-`, `•`, `1.`) ou 3+ linhas curtas | **+40 / +30** |
| **⏰ Lembrete** | **Verbos** | `lembra`, `lembrar`, `me lembra`, `não esquece`, `preciso`, `tenho que`, `devo`, `não posso esquecer` | **+40** |
| | **Ações** | `pagar`, `buscar`, `ligar`, `enviar`, `mandar`, `comprar`, `estudar`, `cancelar`, `resolver`, `renovar` | **+20** |
| | **Data / Hora** | `amanhã`, `sexta`, `hoje`, `14h`, `18:30`, `às 15` | **+30 cada** |
| **📅 Evento** | **Verbos / Tipo**| `vamos`, `marcar`, `encontrar`, `reunir`, `reunião`, `almoçar`, `jantar`, `tomar café`, `viajar`, `consulta`, `aniversário` | **+35** |
| | **Confirmação**| `fechado`, `combinado`, `beleza`, `ok`, `pode ser`, `confirmado`, `bora`, `vamos sim` | **+20** |
| | **Data / Hora** | `amanhã`, `sexta`, `hoje`, `14h`, `18:30`, `às 15` | **+30 cada** |

---

## 🎨 5. Componentes de UI & Experiência Minimalista

- **Ações Minimalistas no Balão (`mobile/components/MessageBubble.tsx`)**:
  - Renderizadas **centralizadas** logo abaixo do balão da mensagem.
  - Exibe dinamicamente 1 ou mais chips (`[📝 Nota]`, `[⏰ Lembrete]`, `[📅 Evento]`) se o score do respectivo detector atingir o limite mínimo.
- **Bottom Sheet Modal de Edição (`mobile/components/ItemEditBottomSheet.tsx`)**:
  - Modal expansível por gesto de arraste (PanResponder de 65% a 90% da altura da tela).
  - Cabeçalho minimalista com botão de fechar (`X`) à esquerda, título ao centro e checkmark verde (`✓`) à direita (estilo *DrawingCanvasModal*).
- **Submenu no Menu da Mensagem (`mobile/components/ChatMessageOptionsModal.tsx`)**:
  - Opção **`Mais...`** posicionada logo abaixo de *Apagar*.
  - Ao clicar, substitui a tela de opções pelo submenu de criação (*Criar Nota*, *Criar Lembrete*, *Criar Evento* e *Voltar*).
- **Central de Items & Editor Dedicado**:
  - `/items`: Lista unificada com abas de filtro (*Todos*, *Notas*, *Lembretes*, *Eventos*).
  - `/item-editor`: Tela dedicada para criação/edição.
