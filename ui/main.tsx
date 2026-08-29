import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { customViewPresentation, getCustomViewHost, type CustomViewHost } from "@blinko-cloud/cli/custom-view";
import "./styles.css";
import {
  BOARD_TYPE_KEY,
  MAX_COLUMNS,
  addCard,
  addColumn,
  createBoard,
  createCard,
  deleteCard,
  deleteColumn,
  findCard,
  flattenCardText,
  moveCard,
  parseBoard,
  renameColumn,
  serializeBoard,
  updateCard,
  type KanbanBoard,
  type Priority,
} from "./model";

type BoardData = { title: string; cardText: string; document: string; createdAt: string; updatedAt: string };
type EntityRecord<T = unknown> = {
  id: string; typeKey: string; data: T; version: number; trashedAt: string | null;
  createdAt: string; updatedAt: string;
};
type Entities = {
  create<T>(input: { typeKey: string; data: T; idempotencyKey?: string }): Promise<EntityRecord<T>>;
  query<T>(query: { typeKey: string; status?: "active" | "trashed" | "all"; sort?: { field: string; direction: "asc" | "desc" }; cursor?: string; limit?: number }): Promise<{ items: EntityRecord<T>[]; nextCursor: string | null }>;
  update<T>(id: string, input: { data: T; baseVersion: number }): Promise<EntityRecord<T>>;
  trash(id: string, baseVersion: number): Promise<EntityRecord>;
};
type KanbanHost = CustomViewHost & { entities: Entities };
type CardDialog = { columnId: string; cardId?: string; title: string; details: string; priority: Priority; dueDate: string };
type ColumnDialog = { columnId?: string; title: string };
type ConfirmDialog = { kind: "board" | "card" | "column"; id: string; title: string };

type Copy = Record<string, string>;
const COPY: Record<string, Copy> = {
  en: {
    app:"Blinko Kanban", search:"Search boards and tasks", newBoard:"New board", untitledBoard:"Untitled board", boardName:"Board name", createBoard:"Create board", renameBoard:"Rename board", save:"Save", cancel:"Cancel", loading:"Loading boards…", retry:"Retry", loadFailed:"Boards could not be loaded.", noBoards:"Make space for your work", noBoardsBody:"Create a board, add tasks, and move each card forward as work progresses.", noResults:"No boards match your search.", addTask:"Add task", addColumn:"Add column", columnName:"Column name", renameColumn:"Rename column", taskTitle:"Task title", details:"Details", detailsHint:"Add context, links, or acceptance notes", priority:"Priority", priorityNone:"No priority", priorityLow:"Low", priorityMedium:"Medium", priorityHigh:"High", dueDate:"Due date", editTask:"Edit task", createTask:"Create task", deleteTask:"Delete task", deleteColumn:"Delete column", deleteBoard:"Delete board", delete:"Delete", boardDeleteTitle:"Delete this board?", boardDeleteBody:"The board moves to Blinko trash and can be restored through account data tools.", cardDeleteTitle:"Delete this task?", cardDeleteBody:"This task will be removed from the board.", columnDeleteTitle:"Delete this column?", columnDeleteBody:"Its tasks will move to the first remaining column.", saving:"Saving…", saved:"Saved", saveFailed:"Could not save this change.", conflict:"This board changed elsewhere. Reload the latest version before continuing.", reload:"Reload latest", tooLarge:"This board is too large.", columnLimit:"A board can have up to eight columns.", moveLeft:"Move left", moveRight:"Move right", edit:"Edit", tasks:"tasks", overdue:"Overdue", today:"Today", openBoards:"Open boards", closeBoards:"Close boards", emptyColumn:"Drop a task here", dragTask:"Drag task", invalidBoard:"A board could not be opened.", required:"Enter a title.", dismiss:"Dismiss"
  },
  "zh-CN": {
    app:"Blinko 看板", search:"搜索看板和任务", newBoard:"新建看板", untitledBoard:"未命名看板", boardName:"看板名称", createBoard:"创建看板", renameBoard:"重命名看板", save:"保存", cancel:"取消", loading:"正在加载看板…", retry:"重试", loadFailed:"无法加载看板。", noBoards:"为工作留出清晰空间", noBoardsBody:"创建一个看板、添加任务，并随着进展把每张卡片向前移动。", noResults:"没有匹配的看板。", addTask:"添加任务", addColumn:"添加列", columnName:"列名称", renameColumn:"重命名列", taskTitle:"任务标题", details:"说明", detailsHint:"补充背景、链接或验收说明", priority:"优先级", priorityNone:"无优先级", priorityLow:"低", priorityMedium:"中", priorityHigh:"高", dueDate:"截止日期", editTask:"编辑任务", createTask:"创建任务", deleteTask:"删除任务", deleteColumn:"删除列", deleteBoard:"删除看板", delete:"删除", boardDeleteTitle:"删除这个看板？", boardDeleteBody:"看板会移入 Blinko 回收站，可通过账号数据工具恢复。", cardDeleteTitle:"删除这个任务？", cardDeleteBody:"这个任务将从看板中移除。", columnDeleteTitle:"删除这一列？", columnDeleteBody:"其中的任务会移动到第一个保留的列。", saving:"正在保存…", saved:"已保存", saveFailed:"无法保存这次更改。", conflict:"这个看板已在其他地方更新，请先载入最新版本。", reload:"载入最新版本", tooLarge:"这个看板太大了。", columnLimit:"每个看板最多可以有八列。", moveLeft:"向左移动", moveRight:"向右移动", edit:"编辑", tasks:"个任务", overdue:"已逾期", today:"今天", openBoards:"打开看板列表", closeBoards:"关闭看板列表", emptyColumn:"把任务拖到这里", dragTask:"拖动任务", invalidBoard:"无法打开这个看板。", required:"请输入标题。", dismiss:"关闭"
  },
  "zh-TW": {
    app:"Blinko 看板", search:"搜尋看板和任務", newBoard:"新增看板", untitledBoard:"未命名看板", boardName:"看板名稱", createBoard:"建立看板", renameBoard:"重新命名看板", save:"儲存", cancel:"取消", loading:"正在載入看板…", retry:"重試", loadFailed:"無法載入看板。", noBoards:"為工作留出清晰空間", noBoardsBody:"建立一個看板、新增任務，並隨著進度把每張卡片向前移動。", noResults:"沒有符合的看板。", addTask:"新增任務", addColumn:"新增欄位", columnName:"欄位名稱", renameColumn:"重新命名欄位", taskTitle:"任務標題", details:"說明", detailsHint:"補充背景、連結或驗收說明", priority:"優先順序", priorityNone:"無優先順序", priorityLow:"低", priorityMedium:"中", priorityHigh:"高", dueDate:"截止日期", editTask:"編輯任務", createTask:"建立任務", deleteTask:"刪除任務", deleteColumn:"刪除欄位", deleteBoard:"刪除看板", delete:"刪除", boardDeleteTitle:"刪除這個看板？", boardDeleteBody:"看板會移到 Blinko 垃圾桶，可透過帳戶資料工具還原。", cardDeleteTitle:"刪除這個任務？", cardDeleteBody:"這個任務將從看板中移除。", columnDeleteTitle:"刪除這個欄位？", columnDeleteBody:"其中的任務會移到第一個保留的欄位。", saving:"正在儲存…", saved:"已儲存", saveFailed:"無法儲存這次變更。", conflict:"這個看板已在其他地方更新，請先載入最新版本。", reload:"載入最新版本", tooLarge:"這個看板太大了。", columnLimit:"每個看板最多可以有八個欄位。", moveLeft:"向左移動", moveRight:"向右移動", edit:"編輯", tasks:"個任務", overdue:"已逾期", today:"今天", openBoards:"開啟看板列表", closeBoards:"關閉看板列表", emptyColumn:"把任務拖到這裡", dragTask:"拖動任務", invalidBoard:"無法開啟這個看板。", required:"請輸入標題。", dismiss:"關閉"
  },
};

const presentation = customViewPresentation();
const locale = presentation.locale.toLowerCase().startsWith("zh")
  ? (/-(tw|hk|mo)|hant/.test(presentation.locale.toLowerCase()) ? "zh-TW" : "zh-CN") : "en";
const t = (key: string) => COPY[locale]?.[key] || COPY.en![key] || key;
const host = getCustomViewHost() as KanbanHost;

const paths: Record<string, ReactNode> = {
  board:<><rect x="3" y="4" width="18" height="16" rx="3"/><path d="M9 4v16M15 4v16"/></>, plus:<><path d="M12 5v14M5 12h14"/></>, search:<><circle cx="11" cy="11" r="6"/><path d="m16 16 4 4"/></>, menu:<><path d="M4 7h16M4 12h16M4 17h16"/></>, close:<><path d="m6 6 12 12M18 6 6 18"/></>, pencil:<><path d="m4 20 4-1 11-11a2 2 0 0 0-3-3L5 16l-1 4Z"/></>, trash:<><path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13"/></>, left:<><path d="m15 18-6-6 6-6"/></>, right:<><path d="m9 18 6-6-6-6"/></>, calendar:<><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M8 3v4M16 3v4M3 10h18"/></>, grip:<><circle cx="9" cy="7" r="1" fill="currentColor" stroke="none"/><circle cx="15" cy="7" r="1" fill="currentColor" stroke="none"/><circle cx="9" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="15" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="9" cy="17" r="1" fill="currentColor" stroke="none"/><circle cx="15" cy="17" r="1" fill="currentColor" stroke="none"/></>, reload:<><path d="M20 7v5h-5M4 17v-5h5"/><path d="M18 12a6 6 0 0 0-10-4L5 11M6 12a6 6 0 0 0 10 4l3-3"/></>, chevron:<><path d="m9 18 6-6-6-6"/></>, check:<><path d="m5 12 4 4L19 6"/></>, alert:<><path d="M12 9v4M12 17h.01"/><path d="M10.3 3.7 2.5 17.2A2 2 0 0 0 4.2 20h15.6a2 2 0 0 0 1.7-2.8L13.7 3.7a2 2 0 0 0-3.4 0Z"/></>,
};
function Icon({ name, size = 18 }: { name: keyof typeof paths; size?: number }) {
  return <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

const boardData = (board: KanbanBoard, createdAt: string): BoardData => {
  const updatedAt = new Date().toISOString();
  return { title: board.title, cardText: flattenCardText(board), document: serializeBoard(board), createdAt, updatedAt };
};
const cardCount = (board: KanbanBoard) => board.columns.reduce((total, column) => total + column.cards.length, 0);
const relativeDate = (value: string) => {
  const date = new Date(`${value}T00:00:00`); const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const days = Math.round((date.getTime() - start.getTime()) / 86_400_000);
  if (days === 0) return t("today");
  if (days < 0) return t("overdue");
  return new Intl.DateTimeFormat(presentation.locale, { month: "short", day: "numeric" }).format(date);
};

function App() {
  const [records, setRecords] = useState<EntityRecord<BoardData>[]>([]);
  const [activeId, setActiveId] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [notice, setNotice] = useState("");
  const [query, setQuery] = useState("");
  const [mobileList, setMobileList] = useState(false);
  const [draggedCard, setDraggedCard] = useState<string>();
  const [boardDialog, setBoardDialog] = useState<{ mode: "create" | "rename"; title: string }>();
  const [columnDialog, setColumnDialog] = useState<ColumnDialog>();
  const [cardDialog, setCardDialog] = useState<CardDialog>();
  const [confirm, setConfirm] = useState<ConfirmDialog>();
  const [formError, setFormError] = useState("");
  const activeRef = useRef<EntityRecord<BoardData>>();

  const recordsById = useMemo(() => new Map(records.map((record) => [record.id, record])), [records]);
  const activeRecord = activeId ? recordsById.get(activeId) : undefined;
  let activeBoard: KanbanBoard | undefined;
  try { activeBoard = activeRecord ? parseBoard(activeRecord.data.document) : undefined; } catch { activeBoard = undefined; }
  activeRef.current = activeRecord;
  const filtered = useMemo(() => {
    const value = query.trim().toLocaleLowerCase(presentation.locale);
    return value ? records.filter((record) => `${record.data.title}\n${record.data.cardText}`.toLocaleLowerCase(presentation.locale).includes(value)) : records;
  }, [query, records]);

  const load = async (preferredId?: string) => {
    setLoading(true); setLoadError(false); setConflict(false); setNotice("");
    try {
      const items: EntityRecord<BoardData>[] = []; let cursor: string | undefined;
      for (let page = 0; page < 10; page += 1) {
        const result = await host.entities.query<BoardData>({ typeKey: BOARD_TYPE_KEY, status: "active", sort: { field: "updatedAt", direction: "desc" }, ...(cursor ? { cursor } : {}), limit: 100 });
        items.push(...result.items); if (!result.nextCursor) break; cursor = result.nextCursor;
      }
      setRecords(items);
      setActiveId((current) => preferredId && items.some((item) => item.id === preferredId) ? preferredId : current && items.some((item) => item.id === current) ? current : items[0]?.id);
    } catch { setLoadError(true); }
    finally { setLoading(false); }
  };

  useEffect(() => { document.title = t("app"); void load(); }, []);

  const saveBoard = async (next: KanbanBoard) => {
    const record = activeRef.current; if (!record || busy) return false;
    setBusy(true); setNotice("");
    try {
      const updated = await host.entities.update<BoardData>(record.id, { data: boardData(next, record.data.createdAt), baseVersion: record.version });
      setRecords((items) => items.map((item) => item.id === updated.id ? updated : item)); setConflict(false); return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (message.includes("VERSION_CONFLICT")) setConflict(true);
      setNotice(message.includes("BOARD_TOO_LARGE") ? t("tooLarge") : t("saveFailed")); return false;
    } finally { setBusy(false); }
  };

  const submitBoard = async () => {
    const title = boardDialog?.title.trim(); if (!boardDialog || !title) { setFormError(t("required")); return; }
    setBusy(true); setFormError("");
    try {
      if (boardDialog.mode === "create") {
        const board = createBoard(title, [locale === "en" ? "Backlog" : locale === "zh-TW" ? "待處理" : "待处理", locale === "en" ? "In progress" : locale === "zh-TW" ? "進行中" : "进行中", locale === "en" ? "Done" : "已完成"]);
        const now = new Date().toISOString();
        const created = await host.entities.create<BoardData>({ typeKey: BOARD_TYPE_KEY, data: boardData(board, now), idempotencyKey: `kanban:${crypto.randomUUID()}` });
        setRecords((items) => [created, ...items]); setActiveId(created.id); setMobileList(false);
      } else if (activeBoard) {
        const next = { ...activeBoard, title }; setBusy(false);
        if (!await saveBoard(next)) return;
      }
      setBoardDialog(undefined);
    } catch { setNotice(t("saveFailed")); }
    finally { setBusy(false); }
  };

  const submitColumn = async () => {
    if (!activeBoard || !columnDialog?.title.trim()) { setFormError(t("required")); return; }
    try {
      const next = columnDialog.columnId ? renameColumn(activeBoard, columnDialog.columnId, columnDialog.title) : addColumn(activeBoard, columnDialog.title);
      if (await saveBoard(next)) setColumnDialog(undefined);
    } catch (error) { setFormError(error instanceof Error && error.message === "COLUMN_LIMIT" ? t("columnLimit") : t("saveFailed")); }
  };

  const submitCard = async () => {
    if (!activeBoard || !cardDialog?.title.trim()) { setFormError(t("required")); return; }
    const input = { title: cardDialog.title, details: cardDialog.details, priority: cardDialog.priority, dueDate: cardDialog.dueDate };
    const next = cardDialog.cardId ? updateCard(activeBoard, cardDialog.cardId, input) : addCard(activeBoard, cardDialog.columnId, createCard(input));
    if (await saveBoard(next)) setCardDialog(undefined);
  };

  const executeDelete = async () => {
    if (!confirm || !activeRecord || !activeBoard || busy) return;
    if (confirm.kind === "board") {
      setBusy(true);
      try {
        await host.entities.trash(activeRecord.id, activeRecord.version);
        const next = records.filter((item) => item.id !== activeRecord.id); setRecords(next); setActiveId(next[0]?.id); setConfirm(undefined);
      } catch { setNotice(t("saveFailed")); }
      finally { setBusy(false); }
      return;
    }
    const next = confirm.kind === "card" ? deleteCard(activeBoard, confirm.id) : deleteColumn(activeBoard, confirm.id);
    if (await saveBoard(next)) setConfirm(undefined);
  };

  const move = async (cardId: string, columnId: string, index?: number) => {
    if (!activeBoard || busy) return;
    const next = moveCard(activeBoard, cardId, columnId, index);
    if (next !== activeBoard) await saveBoard(next);
    setDraggedCard(undefined);
  };

  const moveSide = (cardId: string, direction: -1 | 1) => {
    if (!activeBoard) return;
    const found = findCard(activeBoard, cardId); if (!found) return;
    const sourceIndex = activeBoard.columns.findIndex((column) => column.id === found.column.id);
    const target = activeBoard.columns[sourceIndex + direction]; if (target) void move(cardId, target.id);
  };

  const openCard = (columnId: string, cardId?: string) => {
    const found = cardId && activeBoard ? findCard(activeBoard, cardId) : undefined;
    setFormError(""); setCardDialog({ columnId, ...(cardId ? { cardId } : {}), title: found?.card.title ?? "", details: found?.card.details ?? "", priority: found?.card.priority ?? "none", dueDate: found?.card.dueDate ?? "" });
  };

  const confirmCopy = confirm?.kind === "board" ? [t("boardDeleteTitle"), t("boardDeleteBody")] : confirm?.kind === "column" ? [t("columnDeleteTitle"), t("columnDeleteBody")] : [t("cardDeleteTitle"), t("cardDeleteBody")];

  return <main className="app-shell">
    <aside className={`board-list ${mobileList ? "mobile-open" : ""}`}>
      <div className="brand"><span className="brand-mark"><Icon name="board" /></span><strong>{t("app")}</strong><button className="icon-button mobile-close" onClick={() => setMobileList(false)} aria-label={t("closeBoards")}><Icon name="close" /></button></div>
      <button className="primary-button" onClick={() => { setFormError(""); setBoardDialog({ mode: "create", title: "" }); }}><Icon name="plus" />{t("newBoard")}</button>
      <label className="search-field"><Icon name="search" size={16}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("search")} aria-label={t("search")}/></label>
      <div className="board-rows">
        {loading ? <div className="list-state" role="status">{t("loading")}</div> : loadError ? <button className="list-state retry" onClick={() => void load()}>{t("retry")}</button> : filtered.length ? filtered.map((record) => {
          let count = 0; try { count = cardCount(parseBoard(record.data.document)); } catch { /* keep invalid count at zero */ }
          return <button key={record.id} className={`board-row ${record.id === activeId ? "active" : ""}`} onClick={() => { setActiveId(record.id); setMobileList(false); setConflict(false); setNotice(""); }}><span className="row-icon"><Icon name="board" size={16}/></span><span><strong>{record.data.title}</strong><small>{count} {t("tasks")}</small></span><Icon name="chevron" size={14}/></button>;
        }) : <div className="list-state">{query ? t("noResults") : t("noBoards")}</div>}
      </div>
    </aside>
    {mobileList && <button className="scrim" aria-label={t("closeBoards")} onClick={() => setMobileList(false)}/>} 
    <section className="workspace">
      <header className="workspace-bar">
        <button className="icon-button mobile-menu" onClick={() => setMobileList(true)} aria-label={t("openBoards")}><Icon name="menu"/></button>
        <div className="workspace-title"><strong>{activeBoard?.title ?? t("app")}</strong>{activeBoard && <span>{cardCount(activeBoard)} {t("tasks")}</span>}</div>
        {busy && <span className="save-status" role="status"><i className="spinner"/>{t("saving")}</span>}
        <div className="toolbar">
          {activeBoard && <><button className="secondary-button optional" disabled={busy || activeBoard.columns.length >= MAX_COLUMNS} onClick={() => { setFormError(""); setColumnDialog({ title: "" }); }}><Icon name="plus" size={16}/>{t("addColumn")}</button><button className="icon-button" disabled={busy} onClick={() => { setFormError(""); setBoardDialog({ mode: "rename", title: activeBoard!.title }); }} aria-label={t("renameBoard")} title={t("renameBoard")}><Icon name="pencil"/></button><button className="icon-button danger" disabled={busy} onClick={() => setConfirm({ kind: "board", id: activeRecord!.id, title: activeBoard!.title })} aria-label={t("deleteBoard")} title={t("deleteBoard")}><Icon name="trash"/></button></>}
        </div>
      </header>
      {conflict && <div className="conflict-banner" role="alert"><Icon name="alert" size={16}/><span>{t("conflict")}</span><button onClick={() => void load(activeId)}><Icon name="reload" size={15}/>{t("reload")}</button></div>}
      {notice && <div className="notice" role="alert"><span>{notice}</span><button onClick={() => setNotice("")} aria-label={t("dismiss")}><Icon name="close" size={15}/></button></div>}
      <div className="board-area">
        {loading ? <div className="empty" role="status">{t("loading")}</div> : loadError ? <div className="empty"><span className="empty-icon danger"><Icon name="alert" size={30}/></span><h1>{t("loadFailed")}</h1><button className="secondary-button" onClick={() => void load()}>{t("retry")}</button></div> : !records.length ? <div className="empty"><span className="empty-icon"><Icon name="board" size={32}/></span><h1>{t("noBoards")}</h1><p>{t("noBoardsBody")}</p><button className="primary-button" onClick={() => setBoardDialog({ mode: "create", title: "" })}><Icon name="plus"/>{t("createBoard")}</button></div> : !activeBoard ? <div className="empty" role="alert">{t("invalidBoard")}</div> : <div className="columns">
          {activeBoard.columns.map((column, columnIndex) => <section key={column.id} className="column" onDragOver={(event) => { if (draggedCard) event.preventDefault(); }} onDrop={(event) => { event.preventDefault(); if (draggedCard) void move(draggedCard, column.id); }}>
            <header className="column-head"><button className="column-title" disabled={busy} onClick={() => { setFormError(""); setColumnDialog({ columnId: column.id, title: column.title }); }} title={t("renameColumn")}>{column.title}</button><span>{column.cards.length}</span><button className="icon-button subtle" disabled={busy || activeBoard!.columns.length <= 1} onClick={() => setConfirm({ kind: "column", id: column.id, title: column.title })} aria-label={t("deleteColumn")} title={t("deleteColumn")}><Icon name="trash" size={15}/></button></header>
            <div className="cards">
              {column.cards.map((card, cardIndex) => <article key={card.id} className={`task-card priority-${card.priority} ${draggedCard === card.id ? "dragging" : ""}`} draggable={!busy} onDragStart={(event) => { setDraggedCard(card.id); event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/plain", card.id); }} onDragEnd={() => setDraggedCard(undefined)} onDragOver={(event) => { if (draggedCard) { event.preventDefault(); event.stopPropagation(); } }} onDrop={(event) => { event.preventDefault(); event.stopPropagation(); if (draggedCard) void move(draggedCard, column.id, cardIndex); }}>
                <div className="card-top"><span className="drag-handle" aria-label={t("dragTask")}><Icon name="grip" size={16}/></span><button className="card-title" onClick={() => openCard(column.id, card.id)} disabled={busy}>{card.title}</button><button className="icon-button subtle" onClick={() => openCard(column.id, card.id)} disabled={busy} aria-label={t("edit")}><Icon name="pencil" size={15}/></button></div>
                {card.details && <p>{card.details}</p>}
                <footer><div className="card-meta">{card.priority !== "none" && <span className={`priority priority-${card.priority}`}>{t(`priority${card.priority[0]!.toUpperCase()}${card.priority.slice(1)}`)}</span>}{card.dueDate && <span className={`due ${new Date(`${card.dueDate}T23:59:59`).getTime() < Date.now() ? "late" : ""}`}><Icon name="calendar" size={13}/>{relativeDate(card.dueDate)}</span>}</div><div className="move-actions"><button disabled={busy || columnIndex === 0} onClick={() => moveSide(card.id, -1)} aria-label={t("moveLeft")} title={t("moveLeft")}><Icon name="left" size={15}/></button><button disabled={busy || columnIndex === activeBoard!.columns.length - 1} onClick={() => moveSide(card.id, 1)} aria-label={t("moveRight")} title={t("moveRight")}><Icon name="right" size={15}/></button><button className="danger" disabled={busy} onClick={() => setConfirm({ kind: "card", id: card.id, title: card.title })} aria-label={t("deleteTask")} title={t("deleteTask")}><Icon name="trash" size={14}/></button></div></footer>
              </article>)}
              {!column.cards.length && <div className="column-empty">{t("emptyColumn")}</div>}
            </div>
            <button className="add-task" disabled={busy} onClick={() => openCard(column.id)}><Icon name="plus" size={16}/>{t("addTask")}</button>
          </section>)}
        </div>}
      </div>
    </section>

    {boardDialog && <Dialog title={boardDialog.mode === "create" ? t("createBoard") : t("renameBoard")} onClose={() => setBoardDialog(undefined)}><label>{t("boardName")}<input autoFocus maxLength={160} value={boardDialog.title} onChange={(event) => setBoardDialog({ ...boardDialog, title: event.target.value })} onKeyDown={(event) => { if (event.key === "Enter") void submitBoard(); }}/></label>{formError && <p className="form-error">{formError}</p>}<DialogActions onCancel={() => setBoardDialog(undefined)} onSave={() => void submitBoard()} saveLabel={boardDialog.mode === "create" ? t("createBoard") : t("save")} busy={busy}/></Dialog>}
    {columnDialog && <Dialog title={columnDialog.columnId ? t("renameColumn") : t("addColumn")} onClose={() => setColumnDialog(undefined)}><label>{t("columnName")}<input autoFocus maxLength={80} value={columnDialog.title} onChange={(event) => setColumnDialog({ ...columnDialog, title: event.target.value })} onKeyDown={(event) => { if (event.key === "Enter") void submitColumn(); }}/></label>{formError && <p className="form-error">{formError}</p>}<DialogActions onCancel={() => setColumnDialog(undefined)} onSave={() => void submitColumn()} saveLabel={t("save")} busy={busy}/></Dialog>}
    {cardDialog && <Dialog title={cardDialog.cardId ? t("editTask") : t("createTask")} onClose={() => setCardDialog(undefined)} wide><label>{t("taskTitle")}<input autoFocus maxLength={240} value={cardDialog.title} onChange={(event) => setCardDialog({ ...cardDialog, title: event.target.value })}/></label><label>{t("details")}<textarea maxLength={8000} placeholder={t("detailsHint")} value={cardDialog.details} onChange={(event) => setCardDialog({ ...cardDialog, details: event.target.value })}/></label><div className="form-grid"><label>{t("priority")}<select value={cardDialog.priority} onChange={(event) => setCardDialog({ ...cardDialog, priority: event.target.value as Priority })}><option value="none">{t("priorityNone")}</option><option value="low">{t("priorityLow")}</option><option value="medium">{t("priorityMedium")}</option><option value="high">{t("priorityHigh")}</option></select></label><label>{t("dueDate")}<input type="date" value={cardDialog.dueDate} onChange={(event) => setCardDialog({ ...cardDialog, dueDate: event.target.value })}/></label></div>{formError && <p className="form-error">{formError}</p>}<DialogActions onCancel={() => setCardDialog(undefined)} onSave={() => void submitCard()} saveLabel={t("save")} busy={busy}/></Dialog>}
    {confirm && <Dialog title={confirmCopy[0]!} onClose={() => setConfirm(undefined)}><p className="dialog-copy">{confirmCopy[1]}</p><div className="dialog-actions"><button className="secondary-button" onClick={() => setConfirm(undefined)}>{t("cancel")}</button><button className="delete-button" disabled={busy} onClick={() => void executeDelete()}>{busy ? t("saving") : t("delete")}</button></div></Dialog>}
  </main>;
}

function Dialog({ title, children, onClose, wide = false }: { title: string; children: ReactNode; onClose: () => void; wide?: boolean }) {
  return <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className={`dialog ${wide ? "wide" : ""}`} role="dialog" aria-modal="true" aria-label={title}><header><h2>{title}</h2><button className="icon-button" onClick={onClose} aria-label={t("cancel")}><Icon name="close"/></button></header><div className="dialog-body">{children}</div></section></div>;
}
function DialogActions({ onCancel, onSave, saveLabel, busy }: { onCancel: () => void; onSave: () => void; saveLabel: string; busy: boolean }) {
  return <div className="dialog-actions"><button className="secondary-button" onClick={onCancel}>{t("cancel")}</button><button className="primary-button" disabled={busy} onClick={onSave}>{busy ? t("saving") : saveLabel}</button></div>;
}

createRoot(document.getElementById("root")!).render(<App/>);
