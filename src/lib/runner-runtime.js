/** @typedef {{name:string, code:string, requestId?:string|null}} RunnerTest */
/**
 * Real Mocha/Chai in a fresh VM; caller owns transport and cancellation.
 * @param {import('quickjs-emscripten-core').QuickJSWASMModule} engine
 * @param {{mocha:string,chai:string}} sources
 * @param {{name:string,tests:RunnerTest[]}} suite
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
  if (
    !suite ||
    typeof suite.name !== "string" ||
    !Array.isArray(suite.tests) ||
    suite.tests.length > 1000 ||
    suite.tests.some(
      (t) =>
        !t ||
        typeof t.name !== "string" ||
        typeof t.code !== "string" ||
        (t.requestId != null && typeof t.requestId !== "string"),
    )
  )
    throw new Error("Invalid runner suite");
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
    Math.min(2147483647, (suite.tests.length + 1) * timeout + 10000),
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
    clearTimeout(entry.timer);
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
      const ms = Math.min(2147483647, Math.max(0, vm.getNumber(delay) || 0));
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
        const entry = timers.get(id);
        if (repeating && entry) entry.timer = setTimeout(fire, ms);
      };
      timers.set(id, {
        handle,
        timer: setTimeout(fire, ms),
        repeat: repeating,
        owner,
      });
      return vm.newNumber(id);
    });
    register("__clearRunner", (id) => {
      clearTimer(vm.getNumber(id));
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
          "globalThis.setTimeout=(fn,ms=0,...args)=>__scheduleRunner(()=>fn(...args),Number(ms),0);" +
            "globalThis.setInterval=(fn,ms=0,...args)=>__scheduleRunner(()=>fn(...args),Number(ms),1);" +
            "globalThis.clearTimeout=globalThis.clearInterval=__clearRunner;" +
            "globalThis.location={search:''};globalThis.console={log(){},warn(){},error(){},info(){},debug(){}};",
        ),
      ),
    );
    enter(() => consume(vm.evalCode(sources.mocha)));
    enter(() => consume(vm.evalCode(sources.chai)));
    // Mocha captured its own scheduler; user timers belong to the current test.
    enter(() =>
      consume(
        vm.evalCode(
          "globalThis.setTimeout=(fn,ms=0,...args)=>__scheduleRunner(()=>fn(...args),Number(ms),0,1);" +
            "globalThis.setInterval=(fn,ms=0,...args)=>__scheduleRunner(()=>fn(...args),Number(ms),1,1);",
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

/** @param {{name:string,tests:RunnerTest[]}} suite @param {number} timeout
 * @param {boolean} bail @param {string} filter */
function runnerProgram(suite, timeout, bail, filter) {
  const tests = suite.tests
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
    "describe(" +
      JSON.stringify(suite.name) +
      ",()=>{" +
      tests +
      "});mocha.run();",
  ].join("\n");
}
