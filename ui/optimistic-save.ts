export type VersionedRecord<T> = {
  id: string;
  data: T;
  version: number;
  updatedAt: string;
};

type WriterCallbacks<T, R extends VersionedRecord<T>> = {
  onOptimistic(record: R): void;
  onConfirmed(record: R): void;
  onFailure(record: R, error: unknown): void;
  onSavingChange(saving: boolean): void;
};

/**
 * Makes local changes visible immediately while preserving the server's
 * optimistic-concurrency version. Repeated changes are coalesced to the newest
 * complete snapshot and written serially against the last confirmed version.
 */
export class LatestEntityWriter<T, R extends VersionedRecord<T>> {
  private confirmed: R;
  private queued: T | undefined;
  private running = false;

  constructor(
    initial: R,
    private readonly persist: (id: string, data: T, baseVersion: number) => Promise<R>,
    private readonly callbacks: WriterCallbacks<T, R>,
  ) {
    this.confirmed = initial;
  }

  enqueue(data: T): void {
    this.queued = data;
    this.callbacks.onOptimistic({
      ...this.confirmed,
      data,
      updatedAt: new Date().toISOString(),
    });
    if (!this.running) void this.drain();
  }

  private async drain(): Promise<void> {
    this.running = true;
    this.callbacks.onSavingChange(true);
    try {
      while (this.queued !== undefined) {
        const data = this.queued;
        this.queued = undefined;
        try {
          this.confirmed = await this.persist(this.confirmed.id, data, this.confirmed.version);
        } catch (error) {
          this.queued = undefined;
          this.callbacks.onFailure(this.confirmed, error);
          return;
        }
        if (this.queued === undefined) this.callbacks.onConfirmed(this.confirmed);
      }
    } finally {
      this.running = false;
      this.callbacks.onSavingChange(false);
    }
  }
}
