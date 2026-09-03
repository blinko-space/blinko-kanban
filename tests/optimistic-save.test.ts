import { describe, expect, it, vi } from "vitest";
import { LatestEntityWriter, type VersionedRecord } from "../ui/optimistic-save";

type Record = VersionedRecord<{ value: string }>;
const record = (value: string, version = 1): Record => ({
  id: "board-1", data: { value }, version, updatedAt: "2026-01-01T00:00:00.000Z",
});

const deferred = <T>() => {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((ok, fail) => { resolve = ok; reject = fail; });
  return { promise, resolve, reject };
};

describe("LatestEntityWriter", () => {
  it("publishes immediately and serializes follow-up changes against the confirmed version", async () => {
    const first = deferred<Record>();
    const second = deferred<Record>();
    const persist = vi.fn()
      .mockImplementationOnce(() => first.promise)
      .mockImplementationOnce(() => second.promise);
    const optimistic: string[] = [];
    const confirmed: string[] = [];
    const saving: boolean[] = [];
    const writer = new LatestEntityWriter(record("original"), persist, {
      onOptimistic: (item) => optimistic.push(item.data.value),
      onConfirmed: (item) => confirmed.push(item.data.value),
      onFailure: vi.fn(),
      onSavingChange: (value) => saving.push(value),
    });

    writer.enqueue({ value: "moved" });
    writer.enqueue({ value: "moved again" });

    expect(optimistic).toEqual(["moved", "moved again"]);
    expect(persist).toHaveBeenCalledTimes(1);
    expect(persist).toHaveBeenNthCalledWith(1, "board-1", { value: "moved" }, 1);

    first.resolve(record("moved", 2));
    await vi.waitFor(() => expect(persist).toHaveBeenCalledTimes(2));
    expect(persist).toHaveBeenNthCalledWith(2, "board-1", { value: "moved again" }, 2);
    expect(confirmed).toEqual([]);

    second.resolve(record("moved again", 3));
    await vi.waitFor(() => expect(saving).toEqual([true, false]));
    expect(confirmed).toEqual(["moved again"]);
  });

  it("rolls back to the last confirmed record and drops queued writes after failure", async () => {
    const first = deferred<Record>();
    const persist = vi.fn(() => first.promise);
    const failures: Record[] = [];
    const writer = new LatestEntityWriter(record("original"), persist, {
      onOptimistic: vi.fn(), onConfirmed: vi.fn(),
      onFailure: (item) => failures.push(item), onSavingChange: vi.fn(),
    });

    writer.enqueue({ value: "moved" });
    writer.enqueue({ value: "queued" });
    first.reject(new Error("VERSION_CONFLICT"));

    await vi.waitFor(() => expect(failures).toEqual([record("original")]));
    expect(persist).toHaveBeenCalledTimes(1);
  });
});
