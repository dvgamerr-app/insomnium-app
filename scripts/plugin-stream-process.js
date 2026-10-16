// Realm-local scheduling for readable-stream. Jobs stay inside QuickJS's
// bounded pending-job pump; no host timers, process or filesystem are exposed.
export function nextTick(callback, ...args) {
  Promise.resolve().then(() => callback(...args));
}
export const env=Object.freeze({});
export const stdout=null, stderr=null;
export default Object.freeze({nextTick,env,stdout,stderr});
