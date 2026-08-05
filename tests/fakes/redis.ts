// In-memory Redis fake for the tsx tests.
//
// It exists to cover the one thing `@devvit/test`'s own Redis mock cannot: **a WATCH
// conflict.** That mock records `watchedKeys` on `Watch` and never reads them again —
// `Exec` runs every queued command unconditionally — so a compare-and-set loop tested
// only there is a loop whose conflict branch has never executed once. The two layers
// are not redundant and neither is optional (`GAME_DESIGN.md` § The Devvit Redis rule).
//
// **The one thing you must not break: `exec()` must FAIL if a watched key was written
// after `watch()`.** That conflict semantic is the whole reason this file exists, and
// every lost-update test rests on it.
//
// It also deliberately reproduces two Devvit behaviours rather than raw Redis's, so a
// test passing here means something about production:
//
//  - **`set` with `nx` returns a string either way.** An NX miss is NOT detectable
//    from the return value, which is exactly how the one-run-per-day guard was once
//    silently disarmed. Server code must use `incrBy` or a distinct 'OK' check.
//  - **A conflicted `exec()` resolves to `[]`, not `null`.** Raw Redis answers nil and
//    every CAS example online therefore tests truthiness; Devvit maps command results
//    into a plain array, so the empty array IS the conflict and `Array.isArray` reports
//    it as success.

interface QueuedSet {
  key: string;
  value: string;
}

export interface FakeTx {
  multi(): Promise<void>;
  set(key: string, value: string): Promise<void>;
  /** `[]` on conflict — see the header. Never null: that is raw Redis, not Devvit. */
  exec(): Promise<unknown[]>;
  discard(): Promise<void>;
  unwatch(): Promise<void>;
}

export class FakeRedis {
  private strings = new Map<string, string>();
  /** Bumped on every string write; `watch()` snapshots it and `exec()` compares. */
  private writeGeneration = new Map<string, number>();

  /** Every `expire()` call, recorded so a test can assert the TTL was set. */
  expireCalls: { key: string; seconds: number }[] = [];

  /** Expirations passed to `set`. Recorded rather than enforced — nothing here has a
   *  clock, and a key that vanished mid-test would be a source of flake rather than a
   *  source of truth. A test that cares asserts on this. */
  setExpirations = new Map<string, Date>();

  /** Test hook: runs at the START of every `exec()`, before the conflict check.
   *  Inject a competing write here to force a CAS retry deterministically, rather than
   *  hoping for a race that a single-threaded test can never actually have. */
  beforeExec: (() => Promise<void> | void) | null = null;

  /** How many transactions have reached `exec()`. A CAS test needs to prove the loop
   *  RETRIED, not merely that the final value is right — a mutator that happened to be
   *  idempotent would pass the value check on its own. */
  execCount = 0;

  private bump(key: string): void {
    this.writeGeneration.set(key, (this.writeGeneration.get(key) ?? 0) + 1);
  }

  // ---- strings ----

  async get(key: string): Promise<string | undefined> {
    return this.strings.get(key);
  }

  /** Both option shapes Devvit's own `set` takes, because both are used against it:
   *  `nx` by the one-run-per-day claim and `expiration` by the settled-run summaries. */
  async set(
    key: string,
    value: string,
    options?: { nx?: boolean; expiration?: Date },
  ): Promise<string> {
    if (options?.nx && this.strings.has(key)) return '';
    if (options?.expiration) this.setExpirations.set(key, options.expiration);
    this.strings.set(key, value);
    this.bump(key);
    return 'OK';
  }

  async del(...keys: string[]): Promise<void> {
    for (const key of keys) {
      this.strings.delete(key);
      this.bump(key);
    }
  }

  async incrBy(key: string, value: number): Promise<number> {
    const next = (Number(this.strings.get(key)) || 0) + value;
    this.strings.set(key, String(next));
    this.bump(key);
    return next;
  }

  async expire(key: string, seconds: number): Promise<void> {
    this.expireCalls.push({ key, seconds });
  }

  // ---- WATCH / MULTI / EXEC ----

  async watch(...keys: string[]): Promise<FakeTx> {
    const snapshot = new Map(keys.map((key) => [key, this.writeGeneration.get(key) ?? 0]));
    const queued: QueuedSet[] = [];
    let active = true;

    const conflicted = (): boolean =>
      [...snapshot.entries()].some(([key, gen]) => (this.writeGeneration.get(key) ?? 0) !== gen);

    return {
      multi: async () => {
        // The queue phase begins; queued commands apply atomically on exec.
      },
      set: async (key: string, value: string) => {
        queued.push({ key, value });
      },
      exec: async (): Promise<unknown[]> => {
        this.execCount++;
        if (this.beforeExec) await this.beforeExec();
        if (!active) return [];
        active = false;
        if (conflicted()) return []; // a watched key changed → the transaction aborts
        for (const q of queued) {
          this.strings.set(q.key, q.value);
          this.bump(q.key);
        }
        return queued.map(() => 'OK');
      },
      discard: async () => {
        active = false;
      },
      unwatch: async () => {
        active = false;
      },
    };
  }
}
