import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { parseExtensionManifest } from "@blinko-cloud/cli/sdk";
import {
  BOARD_TYPE_KEY,
  addCard,
  addColumn,
  createBoard,
  createCard,
  deleteColumn,
  flattenCardText,
  moveCard,
  parseBoard,
  serializeBoard,
  updateCard,
} from "../ui/model";

const root = resolve(import.meta.dirname, "..");
const blinko = resolve(root, "../../packages/cli/dist/blinko.mjs");
const runCli = (command: "validate" | "build") => execFileSync(process.execPath, [blinko, "extension", command, "."], { cwd: root, encoding: "utf8" });

describe("Blinko Kanban App", () => {
  it("declares a localized sidebar board with owned persistence and lexical search", () => {
    const source = JSON.parse(readFileSync(resolve(root, "blinko.app.json"), "utf8"));
    const manifest = parseExtensionManifest(source);
    expect(manifest).toMatchObject({
      appId: "cloud.blinko.kanban",
      permissions: { required: ["data:own:read", "data:own:write", "search:index:lexical"] },
      dataTypes: [expect.objectContaining({ typeKey: BOARD_TYPE_KEY })],
      contributes: { items: [expect.objectContaining({ surface: "sidebar", viewId: "kanban.workspace" })] },
    });
    expect(source.dataTypes[0].search.lexical).toEqual(expect.arrayContaining(["title", "cardText"]));
    expect(runCli("validate")).toContain("Valid cloud.blinko.kanban");
  });

  it("creates, sanitizes, serializes, and indexes boards", () => {
    let board = createBoard("Launch <script>", ["Todo", "Doing", "Done"]);
    const card = createCard({ title: "Ship <b>beta", details: "Tell\ncustomers", priority: "high", dueDate: "2026-09-01" });
    board = addCard(board, board.columns[0]!.id, card);
    const parsed = parseBoard(serializeBoard(board));
    expect(parsed.title).toBe("Launch script");
    expect(parsed.columns[0]!.cards[0]).toMatchObject({ title: "Ship b beta", priority: "high", dueDate: "2026-09-01" });
    expect(flattenCardText(parsed)).toContain("Tell\ncustomers\nhigh\n2026-09-01");
  });

  it("moves and edits cards without changing their identity", () => {
    let board = createBoard("Roadmap", ["Todo", "Done"]);
    const card = createCard({ title: "Draft", details: "", priority: "none", dueDate: "" });
    board = addCard(board, board.columns[0]!.id, card);
    board = moveCard(board, card.id, board.columns[1]!.id, 0);
    board = updateCard(board, card.id, { title: "Published", details: "Ready", priority: "medium", dueDate: "" });
    expect(board.columns[0]!.cards).toHaveLength(0);
    expect(board.columns[1]!.cards[0]).toMatchObject({ id: card.id, title: "Published", priority: "medium" });
  });

  it("moves cards out of a removed column and preserves at least one column", () => {
    let board = createBoard("Work", ["One", "Two"]);
    board = addCard(board, board.columns[1]!.id, createCard({ title: "Keep me", details: "", priority: "low", dueDate: "" }));
    board = deleteColumn(board, board.columns[1]!.id);
    expect(board.columns).toHaveLength(1);
    expect(board.columns[0]!.cards[0]!.title).toBe("Keep me");
    expect(() => deleteColumn(board, board.columns[0]!.id)).toThrow("LAST_COLUMN");
    expect(addColumn(board, "Review").columns).toHaveLength(2);
  });

  it("bundles a self-contained React Custom View", () => {
    runCli("build");
    const index = JSON.parse(readFileSync(resolve(root, "dist/resource-index.json"), "utf8"));
    const resource = index.resources.find((item: { id: string }) => item.id === "ui.kanban.workspace");
    expect(resource).toMatchObject({ kind: "document", mimeType: "text/html" });
    const html = readFileSync(resolve(root, "dist", resource.path), "utf8");
    expect(html).toContain("Blinko Kanban");
    expect(html).toContain(BOARD_TYPE_KEY);
    expect(html).toContain("blinkoCustomUi");
    const shell = html.replace(/(<script\b[^>]*>)[\s\S]*?<\/script>/gi, "$1</script>");
    expect(shell).not.toMatch(/<script\b[^>]*\bsrc\s*=/i);
    expect(shell).not.toMatch(/<link\b[^>]*\brel=["']?stylesheet/i);
  }, 30_000);
});
