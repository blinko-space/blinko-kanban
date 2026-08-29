export const BOARD_TYPE_KEY = "kanban.board";
export const MAX_COLUMNS = 8;
export const MAX_CARDS = 500;

export type Priority = "none" | "low" | "medium" | "high";

export type KanbanCard = {
  id: string;
  title: string;
  details: string;
  priority: Priority;
  dueDate?: string;
  createdAt: string;
  updatedAt: string;
};

export type KanbanColumn = {
  id: string;
  title: string;
  cards: KanbanCard[];
};

export type KanbanBoard = {
  title: string;
  columns: KanbanColumn[];
};

const clean = (value: unknown, max: number) => String(value ?? "")
  .replace(/[<>\u0000-\u001f]/g, " ")
  .replace(/\s+/g, " ")
  .trim()
  .slice(0, max);

const cleanDetails = (value: unknown) => String(value ?? "")
  .replace(/[<>\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, " ")
  .trim()
  .slice(0, 8_000);

const id = (prefix: string) => `${prefix}_${crypto.randomUUID().replaceAll("-", "")}`;
const timestamp = () => new Date().toISOString();

export function createBoard(title: string, columnTitles = ["Backlog", "In progress", "Done"]): KanbanBoard {
  const names = columnTitles.map((value) => clean(value, 80)).filter(Boolean).slice(0, MAX_COLUMNS);
  return {
    title: clean(title, 160) || "Untitled board",
    columns: (names.length ? names : ["Backlog", "In progress", "Done"])
      .map((name) => ({ id: id("column"), title: name, cards: [] })),
  };
}

export function createCard(input: Pick<KanbanCard, "title" | "details" | "priority" | "dueDate">): KanbanCard {
  const now = timestamp();
  const dueDate = /^\d{4}-\d{2}-\d{2}$/.test(input.dueDate ?? "") ? input.dueDate : undefined;
  return {
    id: id("card"),
    title: clean(input.title, 240) || "Untitled task",
    details: cleanDetails(input.details),
    priority: ["none", "low", "medium", "high"].includes(input.priority) ? input.priority : "none",
    ...(dueDate ? { dueDate } : {}),
    createdAt: now,
    updatedAt: now,
  };
}

export function parseBoard(value: string): KanbanBoard {
  const source = JSON.parse(value) as Partial<KanbanBoard>;
  if (!source || !Array.isArray(source.columns)) throw new Error("INVALID_BOARD");
  const seen = new Set<string>();
  let cardCount = 0;
  const columns = source.columns.slice(0, MAX_COLUMNS).map((raw) => {
    const candidate = raw as Partial<KanbanColumn>;
    const columnId = clean(candidate.id, 120);
    if (!columnId || seen.has(columnId) || !Array.isArray(candidate.cards)) throw new Error("INVALID_BOARD");
    seen.add(columnId);
    const cards = candidate.cards.map((rawCard) => {
      const item = rawCard as Partial<KanbanCard>;
      const cardId = clean(item.id, 120);
      if (!cardId || seen.has(cardId)) throw new Error("INVALID_BOARD");
      seen.add(cardId); cardCount += 1;
      if (cardCount > MAX_CARDS) throw new Error("BOARD_TOO_LARGE");
      const createdAt = Number.isFinite(Date.parse(String(item.createdAt))) ? String(item.createdAt) : timestamp();
      const updatedAt = Number.isFinite(Date.parse(String(item.updatedAt))) ? String(item.updatedAt) : createdAt;
      const priority = ["none", "low", "medium", "high"].includes(String(item.priority)) ? item.priority as Priority : "none";
      const dueDate = /^\d{4}-\d{2}-\d{2}$/.test(String(item.dueDate ?? "")) ? String(item.dueDate) : undefined;
      return {
        id: cardId,
        title: clean(item.title, 240) || "Untitled task",
        details: cleanDetails(item.details),
        priority,
        ...(dueDate ? { dueDate } : {}),
        createdAt,
        updatedAt,
      };
    });
    return { id: columnId, title: clean(candidate.title, 80) || "Untitled column", cards };
  });
  if (!columns.length) throw new Error("INVALID_BOARD");
  return { title: clean(source.title, 160) || "Untitled board", columns };
}

export function serializeBoard(board: KanbanBoard): string {
  const value = JSON.stringify(board);
  if (value.length > 780_000) throw new Error("BOARD_TOO_LARGE");
  return value;
}

export function flattenCardText(board: KanbanBoard): string {
  return board.columns.flatMap((column) => [
    column.title,
    ...column.cards.flatMap((card) => [card.title, card.details, card.priority, card.dueDate ?? ""]),
  ]).filter(Boolean).join("\n").slice(0, 300_000);
}

export function findCard(board: KanbanBoard, cardId: string) {
  for (const column of board.columns) {
    const index = column.cards.findIndex((card) => card.id === cardId);
    if (index >= 0) return { column, card: column.cards[index]!, index };
  }
  return undefined;
}

export function addCard(board: KanbanBoard, columnId: string, card: KanbanCard): KanbanBoard {
  if (board.columns.reduce((total, column) => total + column.cards.length, 0) >= MAX_CARDS) throw new Error("BOARD_TOO_LARGE");
  return { ...board, columns: board.columns.map((column) => column.id === columnId ? { ...column, cards: [...column.cards, card] } : column) };
}

export function updateCard(board: KanbanBoard, cardId: string, input: Pick<KanbanCard, "title" | "details" | "priority" | "dueDate">): KanbanBoard {
  const replacement = createCard(input);
  return {
    ...board,
    columns: board.columns.map((column) => ({
      ...column,
      cards: column.cards.map((card) => card.id === cardId ? {
        ...replacement, id: card.id, createdAt: card.createdAt, updatedAt: timestamp(),
      } : card),
    })),
  };
}

export function deleteCard(board: KanbanBoard, cardId: string): KanbanBoard {
  return { ...board, columns: board.columns.map((column) => ({ ...column, cards: column.cards.filter((card) => card.id !== cardId) })) };
}

export function moveCard(board: KanbanBoard, cardId: string, destinationColumnId: string, destinationIndex?: number): KanbanBoard {
  const found = findCard(board, cardId);
  if (!found || !board.columns.some((column) => column.id === destinationColumnId)) return board;
  const without = board.columns.map((column) => ({ ...column, cards: column.cards.filter((card) => card.id !== cardId) }));
  const destination = without.find((column) => column.id === destinationColumnId)!;
  const index = Math.max(0, Math.min(destination.cards.length, destinationIndex ?? destination.cards.length));
  destination.cards.splice(index, 0, found.card);
  return { ...board, columns: without };
}

export function addColumn(board: KanbanBoard, title: string): KanbanBoard {
  if (board.columns.length >= MAX_COLUMNS) throw new Error("COLUMN_LIMIT");
  return { ...board, columns: [...board.columns, { id: id("column"), title: clean(title, 80) || "Untitled column", cards: [] }] };
}

export function renameColumn(board: KanbanBoard, columnId: string, title: string): KanbanBoard {
  return { ...board, columns: board.columns.map((column) => column.id === columnId ? { ...column, title: clean(title, 80) || column.title } : column) };
}

export function deleteColumn(board: KanbanBoard, columnId: string): KanbanBoard {
  if (board.columns.length <= 1) throw new Error("LAST_COLUMN");
  const source = board.columns.find((column) => column.id === columnId);
  if (!source) return board;
  const destination = board.columns.find((column) => column.id !== columnId)!;
  return {
    ...board,
    columns: board.columns.filter((column) => column.id !== columnId).map((column) =>
      column.id === destination.id ? { ...column, cards: [...column.cards, ...source.cards] } : column),
  };
}
