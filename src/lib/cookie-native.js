import { invoke } from '@tauri-apps/api/core';
import { flushData } from './persistence.js';

/** Saved collection identity must precede cookie namespace admission.
 * @param {string} command @param {Record<string,any>} args @param {AbortSignal} [signal] */
export async function invokeCookie(command, args, signal) {
  signal?.throwIfAborted();
  // A failed save leaves existing saved owners usable. Native admission rejects
  // an unsaved/new owner; the last save error must not hide an existing jar.
  await flushData().catch(() => {});
  signal?.throwIfAborted();
  return invoke(command, args);
}
