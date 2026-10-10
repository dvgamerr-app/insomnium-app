/** Capture native/browser JavaScript CPU evidence inside saved scenarios.
 * Does not patch application functions or change scheduling.
 * @param {import('playwright-core').Page} page
 * @param {string} output */
export async function startCpuProfile(page, output) {
  const session = await page.context().newCDPSession(page);
  await session.send("Debugger.enable");
  await session.send("Profiler.enable");
  await session.send("Profiler.setSamplingInterval", { interval: 1000 });
  await session.send("Profiler.start");
  return async () => {
    try {
      const { profile } = await session.send("Profiler.stop");
      await Bun.write(
        output + "/collection-switch.cpuprofile",
        JSON.stringify(profile),
      );
      const nodes = /** @type {any[]} */ (profile.nodes);
      const byId = new Map(nodes.map((node) => [node.id, node]));
      const parents = new Map();
      for (const node of nodes)
        for (const child of node.children || []) parents.set(child, node.id);
      const self = new Map();
      const inclusive = new Map();
      const samples = profile.samples || [];
      const deltas = profile.timeDeltas || [];
      if (samples.length !== deltas.length)
        throw Error("CPU sample/delta mismatch");
      for (let i = 0; i < samples.length; i++) {
        let id = samples[i];
        const ms = deltas[i] / 1000;
        self.set(id, (self.get(id) || 0) + ms);
        while (id !== undefined) {
          inclusive.set(id, (inclusive.get(id) || 0) + ms);
          id = parents.get(id);
        }
      }
      /** @param {Map<number,number>} values */
      const top = (values) =>
        [...values]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 25)
          .map(([id, ms]) => ({ id, ms, ...byId.get(id).callFrame }));
      const scripts = /** @type {Record<string,any>} */ ({});
      for (const node of nodes) {
        const frame = node.callFrame;
        if (
          !frame.url.startsWith("http://tauri.localhost/") ||
          scripts[frame.scriptId]
        )
          continue;
        const { scriptSource } = await session.send(
          "Debugger.getScriptSource",
          { scriptId: frame.scriptId },
        );
        scripts[frame.scriptId] = { url: frame.url, scriptSource };
      }
      await Bun.write(
        output + "/collection-switch-scripts.json",
        JSON.stringify(scripts),
      );
      const summary = {
        samplingIntervalUs: 1000,
        durationMs: (profile.endTime - profile.startTime) / 1000,
        topSelf: top(self),
        topInclusive: top(inclusive),
      };
      await Bun.write(
        output + "/collection-switch-profile.json",
        JSON.stringify(summary, null, 2),
      );
      return summary;
    } finally {
      await session.detach();
    }
  };
}
