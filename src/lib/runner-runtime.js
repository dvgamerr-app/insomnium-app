import { runnerTestCount } from "./runner-suite.js";
import { pluginBufferSource } from './generated/plugin-buffer.js';
/** @typedef {import('./runner-suite.js').RunnerTest} RunnerTest */
/** Node validates callbacks before converting delay with ToNumber. Number()
 * would incorrectly accept BigInt, and wrapping first hides callback errors.
 * @param {boolean} [owned] */
function timerGlobals(owned=false) {
  return [false,true].map(repeat=>
    'globalThis.'+(repeat?'setInterval':'setTimeout')+'=(fn,ms=0,...args)=>{'+
    'if(typeof fn!=="function")throw Object.assign(new TypeError("Timer callback must be a function"),{code:"ERR_INVALID_ARG_TYPE"});'+
    'return __scheduleRunner(()=>fn(...args),+ms,'+(repeat?1:0)+(owned?',1':'')+');};',
  ).join('');
}
/**
 * Real Mocha/Chai in a fresh VM; caller owns transport and cancellation.
 * @param {import('quickjs-emscripten-core').QuickJSWASMModule} engine
 * @param {{mocha:string,chai:string}} sources
 * @param {import('./runner-suite.js').RunnerSuite} suite
 * @param {(requestId:string,signal:AbortSignal)=>Promise<any>} send
 * @param {{signal?:AbortSignal,timeoutMs?:number,bail?:boolean,filter?:string}} [options]
 */
export async function runSuiteIsolated(
  engine,
  sources,
  suite,
  send,
  options = {},
) {
  const timeout = options.timeoutMs ?? 60000;
  if (!Number.isInteger(timeout) || timeout < 1 || timeout > 600000)
    throw new Error("Runner timeout must be between 1 and 600000 ms");
  const testCount = runnerTestCount(suite);
  const snapshot = JSON.stringify(suite);
  if (snapshot.length > 2 * 1024 * 1024)
    throw new Error("Runner source exceeds 2 Mi characters");
  if (options.signal?.aborted) throw new Error("Runner cancelled");
  const vm = engine.newContext();
  vm.runtime.setMemoryLimit(128 * 1024 * 1024);
  vm.runtime.setMaxStackSize(1024 * 1024);
  let alive = true;
  let sequence = 0;
  let calls = 0;
  let entryDeadline = Infinity;
  /** @type {Map<number,{handle:import('quickjs-emscripten-core').QuickJSHandle,timer:ReturnType<typeof setTimeout>,repeat:boolean,owner?:AbortSignal}>} */
  const timers = new Map();
  /** @type {Set<import('quickjs-emscripten-core').QuickJSDeferredPromise>} */
  const promises = new Set();
  let testController = new AbortController();
  /** @type {(value:any)=>void} */
  let finish = () => {};
  /** @type {(reason:any)=>void} */
  let fail = () => {};
  const completion = new Promise((resolve, reject) => {
    finish = resolve;
    fail = reject;
  });
  completion.catch(() => {});
  const cancel = () => fail(new Error("Runner cancelled"));
  options.signal?.addEventListener("abort", cancel, { once: true });
  const watchdog = setTimeout(
    () => fail(new Error("Runner deadline exceeded")),
    Math.min(2147483647, (testCount + 1) * timeout + 10000),
  );
  vm.runtime.setInterruptHandler(
    () => performance.now() >= entryDeadline || !!options.signal?.aborted,
  );
  /** @param {any} result */
  function consume(result) {
    if (result.error) {
      const detail = vm.dump(result.error);
      result.error.dispose();
      throw new Error(detail?.message || "Runner execution failed");
    }
    result.value?.dispose?.();
  }
  /** @param {()=>void} fn */
  function enter(fn) {
    entryDeadline = performance.now() + Math.min(timeout, 2000);
    try {
      fn();
    } finally {
      entryDeadline = Infinity;
    }
  }
  function pump() {
    enter(() => consume(vm.runtime.executePendingJobs(100)));
  }
  /** @param {string} name @param {Parameters<typeof vm.newFunction>[1]} fn */
  function register(name, fn) {
    const handle = vm.newFunction(name, fn);
    try {
      vm.setProp(vm.global, name, handle);
    } finally {
      handle.dispose();
    }
  }
  /** @param {number} id */
  function clearTimer(id) {
    const entry = timers.get(id);
    if (!entry) return;
    if (entry.repeat) clearInterval(entry.timer);
    else clearTimeout(entry.timer);
    timers.delete(id);
    entry.handle.dispose();
  }
  const jobPump = setInterval(() => {
    if (!alive) return;
    try {
      pump();
    } catch (error) {
      fail(error);
    }
  }, 1);
  try {
    register("__scheduleRunner", (callback, delay, repeat, owned) => {
      if (vm.typeof(callback) !== "function" || timers.size >= 1000)
        return { error: vm.newError("Runner timer limit exceeded") };
      const id = ++sequence;
      const handle = callback.dup();
      const repeating = vm.getNumber(repeat) === 1;
      const owner =
        owned && vm.typeof(owned) === "number" && vm.getNumber(owned) === 1
          ? testController.signal
          : undefined;
      // Legacy scripts used Node timers: out-of-range/non-finite delays become
      // 1 ms, rather than a 24-day timer that only the runner deadline can stop.
      const requested = vm.getNumber(delay);
      const ms = requested >= 1 && requested <= 2147483647 ? Math.trunc(requested) : 1;
      const fire = () => {
        if (!alive || !timers.has(id)) return;
        const current = handle.dup();
        if (!repeating) clearTimer(id);
        try {
          enter(() => consume(vm.callFunction(current, vm.undefined)));
          pump();
        } catch (error) {
          fail(error);
        } finally {
          current.dispose();
        }
      };
      timers.set(id, {
        handle,
        // Let the host own interval cadence. Starting another timeout after
        // the callback would add guest execution time to every period.
        timer: repeating ? setInterval(fire, ms) : setTimeout(fire, ms),
        repeat: repeating,
        owner,
      });
      return vm.newNumber(id);
    });
    register("__clearRunner", (id) => {
      // Node looks up primitive numeric/string IDs without ToNumber-coercing
      // arbitrary objects, booleans, symbols or BigInts into another timer.
      const type = vm.typeof(id);
      if (type !== "number" && type !== "string") return;
      const number = vm.getNumber(id);
      if (type === "string" && vm.getString(id) !== String(number)) return;
      clearTimer(number);
    });
    register("__runnerBoundary", () => {
      testController.abort();
      for (const [id, entry] of timers)
        if (entry.owner?.aborted) clearTimer(id);
      testController = new AbortController();
    });
    register("__runnerSend", (request) => {
      if (vm.typeof(request) !== "string" || !vm.getString(request))
        return { error: vm.newError("No selected request") };
      if (++calls > 10000 || promises.size >= 100)
        return { error: vm.newError("Runner request limit exceeded") };
      const requestId = vm.getString(request);
      const signal = testController.signal;
      const deferred = vm.newPromise();
      promises.add(deferred);
      Promise.resolve()
        .then(() => {
          if (!alive || signal.aborted)
            throw new Error("Runner request cancelled");
          return send(requestId, signal);
        })
        .then((value) => {
          if (!alive) return;
          if (signal.aborted) return;
          const json = JSON.stringify(value);
          if (json === undefined || json.length > 20 * 1024 * 1024)
            throw new Error("Runner response exceeds serialization limit");
          enter(() => {
            const result = vm.evalCode(
              "JSON.parse(" + JSON.stringify(json) + ")",
            );
            if (result.error) {
              consume(result);
              return;
            }
            try {
              deferred.resolve(result.value);
            } finally {
              result.value.dispose();
            }
          });
        })
        .catch((error) => {
          if (!alive || signal.aborted) return;
          const handle = vm.newError(
            error instanceof Error ? error.message : String(error),
          );
          try {
            deferred.reject(handle);
          } finally {
            handle.dispose();
          }
        })
        .finally(() => {
          if (!alive) return;
          promises.delete(deferred);
          deferred.dispose();
          try {
            pump();
          } catch (error) {
            fail(error);
          }
        });
      return deferred.handle.dup();
    });
    register("__runnerDone", (value) => {
      const json = vm.getString(value);
      if (json.length > 20 * 1024 * 1024)
        fail(new Error("Runner results exceed 20 Mi characters"));
      else finish(JSON.parse(json));
    });
    enter(() =>
      consume(
        vm.evalCode(
          timerGlobals() +
            "globalThis.clearTimeout=globalThis.clearInterval=__clearRunner;" +
            "globalThis.location={search:''};globalThis.console={log(){},warn(){},error(){},info(){},debug(){}};",
        ),
      ),
    );
    enter(() => consume(vm.evalCode(pluginBufferSource,'runner-buffer.js')));
    enter(() => consume(vm.evalCode(sources.mocha)));
    enter(() => consume(vm.evalCode(sources.chai)));
    // Legacy scripts ran as CommonJS under Node. Expose only the data/assertion
    // modules already available inside this VM; no host module resolver.
    enter(()=>consume(vm.evalCode(
      "const runnerBufferModule=Object.freeze({Buffer:globalThis.Buffer});"+
      "globalThis.require=(name)=>{if(name==='chai')return globalThis.chai;if(name==='buffer'||name==='node:buffer')return runnerBufferModule;throw Error('Unsupported runner module: '+String(name));};",
      'runner-modules.js',
    )));
    // Mocha captured its own scheduler; user timers belong to the current test.
    enter(() =>
      consume(
        vm.evalCode(
          timerGlobals(true),
        ),
      ),
    );
    const program = runnerProgram(
      JSON.parse(snapshot),
      timeout,
      !!options.bail,
      options.filter || "",
    );
    enter(() => consume(vm.evalCode(program, "insomnium-runner.js")));
    return await completion;
  } finally {
    alive = false;
    testController.abort();
    clearTimeout(watchdog);
    clearInterval(jobPump);
    options.signal?.removeEventListener("abort", cancel);
    for (const id of timers.keys()) clearTimer(id);
    for (const deferred of promises) deferred.dispose();
    promises.clear();
    vm.dispose();
  }
}

/** @param {import('./runner-suite.js').RunnerSuite} suite @param {number} timeout
 * @param {boolean} bail @param {string} filter */
function runnerProgram(suite, timeout, bail, filter) {
  /** @param {import('./runner-suite.js').RunnerSuite} current @returns {string} */
  function defineSuite(current) {
    const tests = current.tests
    .map(
      (test) =>
        "it(" +
        JSON.stringify(test.name) +
        ",async()=>{insomnia.setActiveRequestId(" +
        JSON.stringify(test.requestId || null) +
        ");\n" +
        test.code +
        "\n});",
    )
    .join("\n");
    return "describe(" + JSON.stringify(current.name) + ",()=>{" +
      (current.suites || []).map(defineSuite).join("\n") + "\n" + tests + "\n});";
  }
  return [
    "globalThis.expect=chai.expect;",
    "globalThis.insomnia={activeRequestId:null,activeEnvironmentId:null,sendRequest:async(id)=>await __runnerSend(id),setActiveRequestId(id){this.activeRequestId=id;},clearActiveRequest(){this.activeRequestId=null;},async send(id=null){id=id||this.activeRequestId;if(!id)throw Error('No selected request');return await this.sendRequest(id);}};",
    "function clean(test){const error=test.err||{},err={};for(const key of Object.getOwnPropertyNames(error))err[key]=error[key];const seen=new Set();const safe=JSON.parse(JSON.stringify(err,(_,value)=>{if(typeof value==='bigint')return String(value);if(value&&typeof value==='object'){if(seen.has(value))return String(value);seen.add(value);}return value;}));return {state:test.state,pending:test.pending,title:test.title,fullTitle:test.fullTitle(),file:test.file,duration:test.duration,currentRetry:test.currentRetry(),err:safe};}",
    "function reporter(runner){const tests=[],passes=[],failures=[],pending=[];runner.on('test',()=>__runnerBoundary());runner.on('test end',test=>{tests.push(test);__runnerBoundary();});runner.on('pass',test=>passes.push(test));runner.on('fail',(test,error)=>{test.err=error;failures.push(test);});runner.on('pending',test=>pending.push(test));runner.once('end',()=>__runnerDone(JSON.stringify({stats:runner.stats,tests:tests.map(clean),passes:passes.map(clean),failures:failures.map(clean),pending:pending.map(clean)})));}",
    "mocha.setup({ui:'bdd',timeout:" +
      timeout +
      ",bail:" +
      bail +
      ",reporter});",
    "mocha.fgrep(" + JSON.stringify(filter) + ");",
    "beforeEach(()=>insomnia.clearActiveRequest());",
    defineSuite(suite) + "mocha.run();",
  ].join("\n");
}
