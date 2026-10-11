import assert from "node:assert/strict";
import { join } from "node:path";
import { newRequest } from "../../../src/lib/model.js";
import { poll } from "./native-app.js";

export function createPluginOAuthFixture() {
  /** @type {any[]} */ const wire = [];
  let tokens = 0;
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    async fetch(request) {
      const path = new URL(request.url).pathname;
      wire.push({
        path,
        method: request.method,
        body: await request.text(),
        headers: Object.fromEntries(request.headers),
      });
      if (path === "/token")
        return Response.json({
          access_token: "owned-plugin-oauth-" + ++tokens,
          token_type: "Bearer",
          expires_in: 3600,
          scope: "owned-scope",
        });
      if (path === "/resource")
        return new Response("owned-plugin-oauth-resource");
      return new Response("Not found", { status: 404 });
    },
  });
  const base = `http://127.0.0.1:${server.port}`;
  return {
    wire,
    stop: () => server.stop(true),
    /** @param {string} helper @param {string} collection */
    source(helper, collection) {
      return `exports.templateTags.push(
        {name:'oauthhelper',async run(c){
          const workspace=await c.util.models.workspace.getById(${JSON.stringify(collection)});
          const saved=await c.util.models.request.getById(${JSON.stringify(helper)});
          if(workspace._id!==${JSON.stringify(collection)}) throw Error('Wrong OAuth helper workspace');
          saved.url='http://invalid.example/guest-edit';
          const sent=await c.network.sendRequest(saved,[{name:'payload',value:'oauth-extra'}]);
          const latest=await c.util.models.response.getLatestForRequestId(saved._id);
          if(latest._id!==sent._id) throw Error('OAuth helper history missing');
          return c.util.models.response.getBodyBuffer(sent).toString();
        }},
        {name:'oauthprompt',async run(c){return await c.app.prompt('Owned OAuth helper cancellation',{defaultValue:'must-not-exchange'});}}
      );`;
    },
    /** @param {string} collection @param {string} id */
    resources(collection, id) {
      return [
        newRequest(collection, {
          _id: id,
          name: "Plugin helper OAuth",
          method: "GET",
          url: base + "/resource",
          authentication: {
            type: "oauth2",
            grantType: "client_credentials",
            accessTokenUrl: base + "/token",
            clientId: "{% oauthhelper %}",
            clientSecret: "owned-secret",
            scope: "owned-scope",
            credentialsInBody: true,
          },
          settingSendCookies: false,
          settingStoreCookies: false,
        }),
        {
          _id: id + "_imported",
          _type: "oauth2_token",
          parentId: id,
          _oauthImported: true,
          accessToken: "owned-plugin-imported",
          tokenType: "Bearer",
          credentialKind: "access_token",
          scope: "owned-scope",
          expiresAt: Date.now() + 3600000,
          obtainedAt: Date.now(),
        },
      ];
    },
    /** @param {{page:import('playwright-core').Page,invoke:(command:string,args?:any)=>Promise<any>,output:string,id:string,helper:string,mainWire:any[]}} options */
    async exercise({ page, invoke, output, id, helper, mainWire }) {
      /** @type {string[]} */ const checks = [];
      /** @type {any[]} */ const controls = [];
      const baseline = await invoke("load_workspace");
      const imported = structuredClone(
        baseline.resources.find(
          (/** @type {any} */ row) => row._id === id + "_imported",
        ),
      );
      const childBefore = mainWire.length;
      const active = async () =>
        (await invoke("load_workspace")).resources.find(
          (/** @type {any} */ row) =>
            row.parentId === id &&
            row._type === "oauth2_token" &&
            row._oauthVersion === 1 &&
            !row._oauthImported,
        );
      await page
        .getByRole("complementary", { name: "Collections" })
        .getByRole("button", { name: "GET Plugin helper OAuth", exact: true })
        .click();
      await page.getByRole("tab", { name: "Auth", exact: true }).click();
      const fetch = page.getByRole("button", {
        name: "Fetch token",
        exact: true,
      });
      const edit = async (/** @type {string} */ value) => {
        const field = page.getByRole("textbox", {
          name: "Client ID",
          exact: true,
        });
        await field.fill(value);
        await field.blur();
        await poll(
          async () =>
            (await invoke("load_workspace")).resources.find(
              (/** @type {any} */ row) => row._id === id,
            ).authentication.clientId === value,
          "OAuth helper input persisted",
        );
      };
      const adopt = async () => {
        const select = page.getByRole("combobox", {
          name: "Saved token",
          exact: true,
        });
        if (!(await select.isVisible()))
          await page
            .getByText("Review saved or imported tokens", { exact: true })
            .click();
        await select.selectOption(id + "_imported");
        await page
          .getByRole("button", {
            name: "Use with current settings",
            exact: true,
          })
          .click();
      };
      const cancel = async (/** @type {"fetch"|"adopt"} */ action) => {
        await fetch.waitFor();
        await edit("{% oauthprompt %}");
        const before = {
          active: await active(),
          endpoint: wire.length,
          child: mainWire.length,
        };
        if (action === "fetch") await fetch.click();
        else await adopt();
        const prompt = page.getByRole("dialog", {
          name: "Owned OAuth helper cancellation",
          exact: true,
        });
        await prompt.waitFor();
        // showModal blocks pointer input; invoke the real owned Cancel handler.
        await page
          .locator(".oauth-actions")
          .getByRole("button", { name: "Cancel", exact: true })
          .evaluate((element) =>
            /** @type {HTMLButtonElement} */ (element).click(),
          );
        await prompt.waitFor({ state: "detached" });
        await fetch.waitFor();
        assert.equal(wire.length, before.endpoint);
        assert.equal(mainWire.length, before.child);
        assert.deepEqual(await active(), before.active);
        controls.push({
          action,
          noTokenWire: true,
          noHelperWire: true,
          activeTokenPreserved: true,
          cancellationMethod:
            "Programmatic real OAuth Cancel handler while showModal blocks pointer input",
        });
        await edit("{% oauthhelper %}");
      };
      try {
        await page
          .getByRole("button", { name: "Fetch token", exact: true })
          .click();
        await poll(
          async () => !!(await active()),
          "Manual OAuth helper token acquired",
          60000,
        );
        assert.equal((await active()).accessToken, "owned-plugin-oauth-1");
        await page.getByText("API token ready", { exact: true }).waitFor();
        const exchanges = wire.filter((row) => row.path === "/token");
        assert.equal(exchanges.length, 1);
        const form = new URLSearchParams(exchanges[0].body);
        assert.equal(form.get("grant_type"), "client_credentials");
        assert.equal(form.get("client_id"), "plugin-render-accepted");
        assert.equal(form.get("client_secret"), "owned-secret");
        assert.equal(form.get("scope"), "owned-scope");
        let current = await invoke("load_workspace");
        assert.equal(
          current.history.filter(
            (/** @type {any} */ row) => row.requestId === id,
          ).length,
          0,
        );
        assert.ok(
          current.history.some(
            (/** @type {any} */ row) => row.requestId === helper,
          ),
        );
        checks.push(
          "Fetch token resolves actual model/network/body/history helper before native token exchange",
        );
        await adopt();
        await poll(
          async () => (await active())?.accessToken === "owned-plugin-imported",
          "Imported token adopted with helper",
        );
        assert.equal(wire.filter((row) => row.path === "/token").length, 1);
        checks.push(
          "Use with current settings resolves helper and adopts saved token without exchange",
        );
        await page.getByRole("button", { name: "Send", exact: true }).click();
        await poll(
          async () => wire.some((row) => row.path === "/resource"),
          "Native Send uses adopted OAuth token",
        );
        assert.equal(
          wire.find((row) => row.path === "/resource").headers.authorization,
          "Bearer owned-plugin-imported",
        );
        assert.equal(wire.filter((row) => row.path === "/token").length, 1);
        current = await invoke("load_workspace");
        assert.deepEqual(
          current.resources.find(
            (/** @type {any} */ row) => row._id === id + "_imported",
          ),
          imported,
        );
        checks.push(
          "Actual resource Send uses imported token and preserves its source record",
        );
        await cancel("fetch");
        checks.push(
          "Cancel during Fetch helper prompt preserves token and denies token/helper wire",
        );
        await fetch.click();
        await poll(
          async () => (await active())?.accessToken === "owned-plugin-oauth-2",
          "Fetch helper recovers without Load",
          60000,
        );
        await page.getByText("API token ready", { exact: true }).waitFor();
        checks.push("Fetch helper recovers after Cancel without plugin Load");
        await cancel("adopt");
        checks.push(
          "Cancel during saved-token helper prompt preserves active token without wire",
        );
        await adopt();
        await poll(
          async () => (await active())?.accessToken === "owned-plugin-imported",
          "Saved-token helper recovers without Load",
        );
        await page.getByText("API token ready", { exact: true }).waitFor();
        current = await invoke("load_workspace");
        assert.deepEqual(
          current.resources.find(
            (/** @type {any} */ row) => row._id === id + "_imported",
          ),
          imported,
        );
        assert.equal(wire.filter((row) => row.path === "/token").length, 2);
        checks.push(
          "Saved-token helper recovers without Load and retains original imported source",
        );
        const settled = { endpoint: wire.length, child: mainWire.length };
        await page.waitForTimeout(750);
        assert.equal(
          wire.length,
          settled.endpoint,
          "Ready OAuth preview must not exchange again",
        );
        assert.equal(
          mainWire.length,
          settled.child,
          "Owned history must not retrigger the ready preview",
        );
        controls.push({
          action: "settled-preview",
          stableForMs: 750,
          endpointRequests: settled.endpoint,
          helperRequests: settled.child - childBefore,
          noRepeatedWire: true,
        });
        const evidence = {
          checks,
          controls,
          requestId: id,
          helperId: helper,
          wire: [...wire],
          childWire: mainWire.slice(childBefore),
          active: await active(),
          imported,
          history: current.history.filter(
            (/** @type {any} */ row) =>
              row.requestId === id || row.requestId === helper,
          ),
        };
        await Bun.write(
          join(output, "oauth-helper-acceptance.json"),
          JSON.stringify(evidence, null, 2),
        );
        return evidence;
      } finally {
        const errors = await page
          .locator(".inline-error")
          .allTextContents()
          .catch(() => []);
        await Bun.write(
          join(output, "oauth-helper-wire.json"),
          JSON.stringify(
            {
              wire,
              childWire: mainWire.slice(childBefore),
              checks,
              controls,
              errors,
            },
            null,
            2,
          ),
        );
      }
    },
  };
}
