/** @typedef {"idle"|"reserved"|"running"|"recovery"|"recovering"} PersistencePhase */
/** Serializes workspace writes and reserves an exclusive transition boundary.
 * Callers must block live mutations and apply authoritative state inside callbacks.
 * This queue is not a native journal or a resource mutation lock.
 * @param {(snapshot:any)=>Promise<void>} write */
export function createPersistenceQueue(write) {
  /** @type {Promise<unknown>} */
  let tail = Promise.resolve();
  let generation = 0;
  /** @type {PersistencePhase} */
  let phase = "idle";
  /** @type {Set<(phase:PersistencePhase)=>void>} */
  const listeners = new Set();
  /** @param {PersistencePhase} next */
  function setPhase(next) {
    phase = next;
    for (const listener of [...listeners]) {
      if (!listeners.has(listener)) continue;
      try {
        listener(phase);
      } catch {
        console.error("Workspace persistence phase observer failed.");
      }
    }
  }
  /** Observers receive current state synchronously; they must not drive transitions.
   * @param {(phase:PersistencePhase)=>void} listener */
  function subscribe(listener) {
    listeners.add(listener);
    try {
      listener(phase);
    } catch (error) {
      listeners.delete(listener);
      throw error;
    }
    return () => {
      listeners.delete(listener);
    };
  }

  /** @param {unknown} data */
  function save(data) {
    if (phase !== "idle")
      return Promise.reject(
        new Error(
          "Workspace transition is active; saving is blocked until it completes or recovers.",
        ),
      );
    const capturedGeneration = generation;
    const snapshot = JSON.parse(JSON.stringify(data));
    tail = tail
      .catch(() => {})
      .then(async () => {
        if (capturedGeneration !== generation)
          throw new Error("Workspace save belongs to an expired generation.");
        await write(snapshot);
      });
    return tail;
  }

  /** Callback must include native transition AND applying its authoritative result.
   * A failure after callback starts keeps saves blocked until explicit recovery.
   * @template T @param {()=>Promise<T>} operation @returns {Promise<T>} */
  function exclusive(operation) {
    if (phase !== "idle")
      return Promise.reject(
        new Error("A workspace transition or recovery is already active."),
      );
    setPhase("reserved");
    const result = tail.then(
      async () => {
        setPhase("running");
        try {
          const value = await operation();
          generation++;
          setPhase("idle");
          return value;
        } catch (error) {
          setPhase("recovery");
          throw error;
        }
      },
      (error) => {
        // Nothing was submitted: preserve the failed save as the reason for refusal.
        setPhase("idle");
        throw error;
      },
    );
    tail = result;
    return result;
  }

  /** Recovery must load/validate native state and apply it before returning.
   * Calling ordinary save from inside either callback is deliberately rejected.
   * @template T @param {()=>Promise<T>} operation @returns {Promise<T>} */
  function recover(operation) {
    if (phase !== "recovery")
      return Promise.reject(
        new Error("No failed workspace transition is awaiting recovery."),
      );
    setPhase("recovering");
    const result = tail
      .catch(() => {})
      .then(async () => {
        try {
          const value = await operation();
          generation++;
          setPhase("idle");
          return value;
        } catch (error) {
          setPhase("recovery");
          throw error;
        }
      });
    tail = result;
    return result;
  }

  return {
    save,
    subscribe,
    exclusive,
    recover,
    get phase() {
      return phase;
    },
    get generation() {
      return generation;
    },
  };
}
