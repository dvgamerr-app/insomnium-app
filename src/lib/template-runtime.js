import {
  createRenderDeadline,
  RENDER_ACTIVE_MS,
  PROMPT_TOTAL_MS,
} from "./template-deadline.js";
import { localTagNames, runLocalTag } from "./template-tags.js";

/**
 * Run trusted bundled Nunjucks in a fresh VM. Extensions are registered by the
 * application, never from template input. No module/file/network APIs are exposed.
 * @param {import('quickjs-emscripten-core').QuickJSWASMModule} engine
 * @param {string} engineSource
 * @param {string} text
 * @param {Record<string, any>} context
 * @param {'all'|'variables'|'tags'} [mode]
 * @param {Record<string, (args: any[]) => any | Promise<any>>} [extensions]
 * @param {{interactivePrompts?:boolean, subscribeInteraction?:(listener:(waiting:boolean)=>void)=>()=>void}} [options]
 */
export async function renderTemplateIsolated(
  engine,
  engineSource,
  text,
  context,
  mode = "all",
  extensions = {},
  options = {},
) {
  if (
    options.interactivePrompts !== undefined &&
    typeof options.interactivePrompts !== "boolean"
  )
    throw new Error("Invalid interactive template policy");
  if (
    options.subscribeInteraction &&
    (!options.interactivePrompts ||
      typeof options.subscribeInteraction !== "function")
  )
    throw new Error("Invalid shared template interaction policy");
  const limit = 20 * 1024 * 1024;
  if (!["all", "variables", "tags"].includes(mode))
    throw new Error("Unknown template render mode");
  const names = [...localTagNames, ...Object.keys(extensions)];
  if (
    names.length > 64 ||
    new Set(names).size !== names.length ||
    names.some((name) => !/^[a-z][a-z0-9_]*$/.test(name)) ||
    Object.values(extensions).some((handler) => typeof handler !== "function")
  )
    throw new Error("Invalid template extension registration");
  const payload = JSON.stringify({ text, context, mode });
  if (payload.length > limit)
    throw new Error("Template and context exceed 20 Mi characters");
  const vm = engine.newContext();
  vm.runtime.setMemoryLimit(128 * 1024 * 1024);
  vm.runtime.setMaxStackSize(512 * 1024);
  // Count elapsed time only while entering the VM, across all callbacks.
  // Awaited host work is bounded separately by the completion/worker deadlines.
  let remainingExecutionMs = 2000;
  let executionDeadline = Infinity;
  vm.runtime.setInterruptHandler(() => performance.now() >= executionDeadline);
  let alive = true;
  let calls = 0;
  let schedules = 0;
  let nextTimer = 0;
  /** @type {Set<import('quickjs-emscripten-core').QuickJSHandle>} */
  const callbacks = new Set();
  /** @type {Map<number, {timer: ReturnType<typeof setTimeout>, callback: import('quickjs-emscripten-core').QuickJSHandle}>} */
  const timers = new Map();
  /** @type {(value: string) => void} */
  let complete = () => {};
  /** @type {(reason: any) => void} */
  let fail = () => {};
  const completion = new Promise((resolve, reject) => {
    complete = resolve;
    fail = reject;
  });
  // Initialization can fail before we reach await completion.
  completion.catch(() => {});
  const deadline = createRenderDeadline(RENDER_ACTIVE_MS, () =>
    fail(new Error("Template rendering timed out")),
  );
  const hardTimeout = options.interactivePrompts
    ? setTimeout(
        () => fail(new Error("Template prompting exceeded 10 minutes")),
        PROMPT_TOTAL_MS,
      )
    : undefined;
  /** @type {(() => void) | undefined} */
  let unsubscribeInteraction;
  /** @type {(() => void) | undefined} */
  let resumeInteraction;
  /** @param {unknown} error */
  const errorMessage = (error) =>
    error instanceof Error ? error.message : String(error);
  /** @param {ReturnType<typeof vm.evalCode>} result */
  const consume = (result) => {
    if (result.error) {
      const detail = vm.dump(result.error);
      result.error.dispose();
      throw new Error(detail?.message || "Template execution failed");
    }
    result.value.dispose();
  };
  /** @param {() => ReturnType<typeof vm.evalCode>} operation */
  const execute = (operation) => {
    if (remainingExecutionMs <= 0)
      throw new Error("Template execution exceeded 2 seconds");
    const started = performance.now();
    executionDeadline = started + remainingExecutionMs;
    try {
      consume(operation());
    } finally {
      remainingExecutionMs -= performance.now() - started;
      executionDeadline = Infinity;
    }
  };
  /** @param {string} code */
  const evaluate = (code) => execute(() => vm.evalCode(code));
  /** @param {string} name @param {Parameters<typeof vm.newFunction>[1]} handler */
  const register = (name, handler) => {
    const handle = vm.newFunction(name, handler);
    try {
      vm.setProp(vm.global, name, handle);
    } finally {
      handle.dispose();
    }
  };
  try {
    unsubscribeInteraction = options.subscribeInteraction?.((waiting) => {
      if (waiting && !resumeInteraction) resumeInteraction = deadline.pause();
      else if (!waiting) {
        resumeInteraction?.();
        resumeInteraction = undefined;
      }
    });
    // Nunjucks' browser ASAP scheduler uses a timeout plus an interval fallback.
    // Each registration is one-shot: its callback cancels both registrations.
    // Guest code has no access to host timer objects.
    register("__schedule", (callback) => {
      if (vm.typeof(callback) !== "function" || ++schedules > 1000)
        return { error: vm.newError("Template callback limit exceeded") };
      const id = ++nextTimer;
      const retained = callback.dup();
      const timer = setTimeout(() => {
        if (!alive) return;
        timers.delete(id);
        try {
          execute(() => vm.callFunction(retained, vm.undefined));
        } catch (error) {
          fail(error);
        } finally {
          retained.dispose();
        }
      }, 0);
      timers.set(id, { timer, callback: retained });
      return vm.newNumber(id);
    });
    register("__cancelSchedule", (idHandle) => {
      const id = vm.getNumber(idHandle);
      const entry = timers.get(id);
      if (entry) {
        clearTimeout(entry.timer);
        entry.callback.dispose();
        timers.delete(id);
      }
    });
    evaluate(`
      globalThis.setTimeout = callback => __schedule(callback);
      globalThis.setInterval = callback => __schedule(callback);
      globalThis.clearTimeout = globalThis.clearInterval = id => __cancelSchedule(id);
    `);
    evaluate(engineSource);
    register("__finishTemplate", (error, result) => {
      if (vm.typeof(error) === "string") fail(new Error(vm.getString(error)));
      else if (vm.typeof(result) !== "string")
        fail(new Error("Template did not return text"));
      else {
        const output = vm.getString(result);
        if (output.length > limit)
          fail(new Error("Template output exceeds 20 Mi characters"));
        else complete(output);
      }
    });
    register("__runTag", (nameHandle, argsHandle, callback) => {
      try {
        if (++calls > 1000) throw new Error("Template exceeds 1000 tag calls");
        if (
          vm.typeof(nameHandle) !== "string" ||
          vm.typeof(argsHandle) !== "string" ||
          vm.typeof(callback) !== "function"
        )
          throw new Error("Invalid template tag arguments");
        const name = vm.getString(nameHandle);
        if (!names.includes(name)) throw new Error("Unknown template tag");
        const serialized = vm.getString(argsHandle);
        if (serialized.length > limit)
          throw new Error("Template tag arguments exceed 20 Mi characters");
        const envelopes = JSON.parse(serialized);
        if (
          !Array.isArray(envelopes) ||
          envelopes.length > 32 ||
          envelopes.some(
            (entry) => !entry || typeof entry.defined !== "boolean",
          )
        )
          throw new Error("Invalid template tag argument list");
        const args = envelopes.map((entry) =>
          entry.defined ? entry.value : undefined,
        );
        const retained = callback.dup();
        callbacks.add(retained);
        const resume =
          name === "prompt" && options.interactivePrompts
            ? deadline.pause()
            : () => {};
        /** @param {any} value @param {any} error */
        const deliver = (value, error) => {
          resume();
          if (!alive) return;
          /** @type {import('quickjs-emscripten-core').QuickJSHandle | undefined} */
          let resultHandle;
          /** @type {import('quickjs-emscripten-core').QuickJSHandle | undefined} */
          let errorHandle;
          try {
            let serializedResult = "{}";
            if (!error) {
              try {
                serializedResult = JSON.stringify({ value });
                if (serializedResult.length > limit)
                  throw new Error(
                    "Template tag result exceeds 20 Mi characters",
                  );
              } catch (cause) {
                error = cause;
              }
            }
            resultHandle = vm.newString(serializedResult);
            errorHandle = error ? vm.newError(errorMessage(error)) : undefined;
            const resultArgument = resultHandle;
            const errorArgument = errorHandle || vm.null;
            execute(() =>
              vm.callFunction(
                retained,
                vm.undefined,
                errorArgument,
                resultArgument,
              ),
            );
          } catch (cause) {
            fail(cause);
          } finally {
            resultHandle?.dispose();
            errorHandle?.dispose();
            callbacks.delete(retained);
            retained.dispose();
          }
        };
        Promise.resolve()
          .then(() =>
            localTagNames.includes(name)
              ? runLocalTag(name, args)
              : extensions[name](args),
          )
          .then(
            (value) => deliver(value, null),
            (error) => deliver(undefined, new Error(errorMessage(error))),
          );
      } catch (error) {
        return { error: vm.newError(errorMessage(error)) };
      }
    });
    const input = vm.newString(payload);
    try {
      vm.setProp(vm.global, "__templateInput", input);
    } finally {
      input.dispose();
    }
    evaluate(`(() => {
      const input = JSON.parse(__templateInput);
      const tags = { blockStart: '{%', blockEnd: '%}', variableStart: '{{', variableEnd: '}}', commentStart: '{#', commentEnd: '#}' };
      if (input.mode === 'variables') { tags.blockStart = '<[{[{[{[{[$%'; tags.blockEnd = '%$]}]}]}]}]>'; }
      if (input.mode === 'tags') { tags.variableStart = '<[{[{[{[{[$%'; tags.variableEnd = '%$]}]}]}]}]>'; }
      const env = new nunjucks.Environment([], { autoescape: false, throwOnUndefined: true, tags });
      for (const name of ${JSON.stringify(names)}) {
        env.addExtension(name, {
          tags: [name],
          parse(parser, nodes, lexer) {
            const token = parser.nextToken();
            const args = parser.peekToken().type === lexer.TOKEN_BLOCK_END
              ? new nodes.NodeList(token.lineno, token.colno) : parser.parseSignature(null, true);
            if (!args.children.length) args.addChild(new nodes.Literal(0, 0, '__EMPTY_NUNJUCKS_ARG__'));
            parser.advanceAfterBlockEnd(token.value);
            return new nodes.CallExtensionAsync(this, 'run', args);
          },
          run(context, ...args) {
            const callback = args.pop();
            __runTag(name, JSON.stringify(args.filter(value => value !== '__EMPTY_NUNJUCKS_ARG__').map(value => ({ defined: value !== undefined, value }))),
              (error, result) => {
                if (error) callback(error);
                else callback(null, JSON.parse(result).value);
              });
          },
        });
      }
      env.addFilter('debug', value => value);
      env.renderString(input.text, { ...input.context, _: input.context }, (error, result) =>
        __finishTemplate(error ? String(error.message || error) : null, result));
    })()`);
    return await completion;
  } finally {
    alive = false;
    deadline.dispose();
    unsubscribeInteraction?.();
    clearTimeout(hardTimeout);
    for (const entry of timers.values()) {
      clearTimeout(entry.timer);
      entry.callback.dispose();
    }
    for (const callback of callbacks) callback.dispose();
    vm.dispose();
  }
}
