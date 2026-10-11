import { openPluginSession } from "../../../src/lib/plugin-session.js";
import { createPluginHelperDispatcher } from "../../../src/lib/plugin-helper-dispatcher.js";
import { createTemplateInteraction } from "../../../src/lib/template-interaction.js";

const source = `let old,bodyOwner,bodyResponse,largeResponse;
exports.templateTags=[{name:'helpers',async run(c){old=c;const r=await c.util.models.request.getById('r');const rendered=await c.util.render('nested');const sent=await c.network.sendRequest({negativeZero:-0,bytes:new Uint8Array([0,255])});return {name:r.name,rendered,negativeZero:sent.headers[0].value==='true',bytes:Array.from(c.util.models.response.getBodyBuffer(sent)),status:sent.statusCode,frozen:Object.isFrozen(c.util.models.request)};}},
{name:'stale',async run(c){try{await old.util.render('forbidden');return 'leaked';}catch(e){return e.message;}}},
{name:'held',async run(c){await c.util.models.request.getById('r');await c.util.render('forbidden');return 'leaked';}},
{name:'body',async run(c){bodyOwner=c;bodyResponse=await c.util.models.response.getLatestForRequestId('r');const b=c.util.models.response.getBodyBuffer(bodyResponse);const copy=c.util.models.response.getBodyBuffer(bodyResponse);b[0]=99;return {sync:!(b instanceof Promise),buffer:Buffer.isBuffer(b),hex:copy.toString('hex'),uint16:copy.readUInt16BE(0),status:bodyResponse.statusCode,headers:bodyResponse.headers,empty:c.util.models.response.getBodyBuffer().length,fallback:c.util.models.response.getBodyBuffer({bodyPath:'missing'},'fallback')};}},
{name:'buffer',run(){return Buffer.from('ไทย😀');}},
{name:'oldBody',run(){try{return bodyOwner.util.models.response.getBodyBuffer(bodyResponse).toString();}catch(e){return e.message;}}},
{name:'largeBody',async run(c){const r=largeResponse=await c.util.models.response.getLatestForRequestId('large');const b=c.util.models.response.getBodyBuffer(r);return {length:b.length,first:b[0],last:b[b.length-1],sync:!(b instanceof Promise)};}},
{name:'cpuTimeout',async run(c){await c.util.models.request.getById('r');while(true){};}},
{name:'heldTimeout',async run(c){await c.util.render('deadline');return 'leaked';}},
{name:'lateReply',async run(c){await c.util.render('slow');while(true){};}},
{name:'interruptedBody',async run(c){const r=await c.util.models.response.getLatestForRequestId('large');const b=c.util.models.response.getBodyBuffer(r);return Buffer.from(b.toString('base64'),'base64').length;}},
{name:'retainedBody',run(c){const b=c.util.models.response.getBodyBuffer(bodyResponse);const copy=c.util.models.response.getBodyBuffer(bodyResponse);b[0]=88;return {sync:!(b instanceof Promise),hex:copy.toString('hex'),unknown:c.util.models.response.getBodyBuffer({bodyPath:'never-admitted'},'absent')};}},
{name:'retainedLarge',run(c){const b=c.util.models.response.getBodyBuffer(largeResponse);return {length:b.length,first:b[0],last:b[b.length-1],sync:!(b instanceof Promise)};}},
{name:'retainedIsolation',run(c){return c.util.models.response.getBodyBuffer({bodyPath:'insomnium-response:res'},'not-admitted');}},
{name:'fakeWait',async run(){try{await __pluginStoreCall(JSON.stringify({generation:0,helper:__pluginValueCodec.encode({method:'interaction',args:[true]})}));return 'leaked';}catch(e){return e.message;}}}];`;
/** @type {any[]} */ const calls = [],
  records = /** @type {any[]} */ ([]);
let ownerAlive = true;
let largeBody = "";
/** @type {Awaited<ReturnType<typeof openPluginSession>>|undefined} */ let session;
/** @type {AbortController|undefined} */ let operation;
/** @type {((value:any)=>void)|undefined} */ let release;
/** @type {Promise<any>|undefined} */ let result;
/** @type {ReturnType<typeof createTemplateInteraction>|undefined} */ let interaction;
/** @type {any} */ (window).__pluginHelperFixture = {
  calls,
  records,
  prepareLarge(/** @type {number} */ size) {
    largeBody = btoa("A".repeat(size));
  },
  /** @param {string} url @param {boolean|'body'|'deadline'|'trusted'} [held] */
  async open(url, held = false) {
    session?.close();
    calls.length = 0;
    records.length = 0;
    operation = new AbortController();
    ownerAlive = true;
    release = undefined;
    interaction?.dispose();
    interaction = createTemplateInteraction();
    session = await openPluginSession(
      {
        name: "insomnia-plugin-helper-fixture",
        entry: "index.js",
        format: "commonjs",
        files: { "index.js": source },
      },
      {
        isCurrent: () => ownerAlive,
        createWorker: () => {
          const worker = new Worker(url, { type: "module" }),
            record = { terminated: false, messages: /** @type {any[]} */ ([]) };
          records.push(record);
          worker.addEventListener("message", (e) =>
            record.messages.push(e.data),
          );
          const terminate = worker.terminate.bind(worker);
          worker.terminate = () => {
            record.terminated = true;
            terminate();
          };
          return worker;
        },
      },
    );
    const signal = operation.signal;
    const dispatch = createPluginHelperDispatcher({
      plugin: "insomnia-plugin-helper-fixture",
      signal,
      isCurrent: () => ownerAlive && !signal.aborted,
      getData: () => ({
        resources: [{ _id: "r", _type: "request", name: "saved" }],
        history: [
          ...(largeBody
            ? [
                {
                  _id: "large-res",
                  requestId: "large",
                  created: 1,
                  bodyBase64: largeBody,
                },
              ]
            : []),
          {
            _id: "res",
            requestId: "r",
            created: 1,
            status: 201,
            headers: [["X-Test", "yes"]],
            bodyBase64: "AP9B",
          },
        ],
      }),
      render: async (text, _signal, path) => {
        if (path.join() !== "insomnia-plugin-helper-fixture")
          throw Error("Wrong render path");
        return "rendered:" + text;
      },
      send: async (request, extra, _signal, path) => {
        if (path.join() !== "insomnia-plugin-helper-fixture")
          throw Error("Wrong network render path");
        if (extra !== undefined) throw Error("Unexpected network options");
        return {
          _id: "sent",
          requestId: "r",
          created: 2,
          status: 202,
          headers: [
            ["Signed-Zero", String(Object.is(request.negativeZero, -0))],
          ],
          bodyBase64: btoa(String.fromCharCode(...request.bytes)),
        };
      },
      cookieJar: async () => {
        throw Error("Cookie creation is outside this bridge scenario");
      },
    });
    const invoke = (/** @type {number} */ index) =>
      session?.invoke("templateTags", index, [], {
        signal: operation?.signal,
        isCurrent: () => !operation?.signal.aborted,
        helperCall: async (call) => {
          calls.push(call);
          if (
            (["deadline", "trusted"].includes(String(held)) &&
              call.method === "util.render") ||
            (held === true && calls.length === 1) ||
            (held === "body" &&
              call.method === "models.response.readBodyChunk" &&
              !release)
          )
            return await new Promise((resolve) => {
              if (held === "trusted") interaction?.begin();
              release = resolve;
            });
          if (call.method === "util.render" && call.args[0] === "slow")
            await new Promise((resolve) => setTimeout(resolve, 2200));
          return dispatch(call);
        },
        interaction: held === "trusted" ? interaction : undefined,
      });
    /** @type {any} */ (window).__pluginHelperFixture.invoke = invoke;
  },
  start(/** @type {number} */ index = 2) {
    result = /** @type {any} */ (window).__pluginHelperFixture
      .invoke(index)
      .then(
        (/** @type {any} */ value) => ({ value }),
        (/** @type {Error} */ error) => ({
          name: error.name,
          error: String(error),
          cleanupError: /** @type {any} */ (error).cleanupError,
        }),
      );
  },
  cancel() {
    operation?.abort();
  },
  invalidate() {
    ownerAlive = false;
  },
  release() {
    release?.({ name: "late" });
  },
  result: () => result,
  async preflight() {
    if (!session) throw Error("No session");
    const errors = [];
    for (const kind of [
      "templateTagMetadata",
      "templateTagAction",
      "templateTags",
    ]) {
      try {
        await session.invoke(kind, 0, [], { helperCall: async () => null });
        errors.push("allowed");
      } catch (error) {
        errors.push(String(error));
      }
    }
    return errors;
  },
  close() {
    session?.close();
    interaction?.dispose();
  },
};
