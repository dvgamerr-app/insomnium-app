import assert from "node:assert/strict";
import { withPreview } from "./helpers/preview-app.js";
import {createSvelteUiFixturePlugin} from './helpers/component-fixture.js';

await withPreview("plugin-oauth-preview", async (page, output) => {
  const bundle = await Bun.build({
    entrypoints: ["tests/ui/fixtures/plugin-oauth-preview.js"],
    target: "browser",
    format: "iife",
    define: { "import.meta.url": JSON.stringify(page.url()) },
    plugins:[createSvelteUiFixturePlugin()],
  });
  assert.equal(bundle.success, true, bundle.logs.map(String).join("\n"));
  await page.evaluate(await bundle.outputs[0].text());
  const checks = await page.evaluate(() => {
    const f = /** @type {any} */ (window).__pluginOAuthPreviewFixture;
    const guard = f.createOAuthPreviewHistoryGuard();
    /** @type {string[]} */ const rows = [];
    const history = [
      { _id: "old-a", requestId: "a", bodyBase64: "QQ==" },
      { _id: "old-b", requestId: "b", bodyBase64: "Qg==" },
    ];
    const base = guard.key(history);
    const check = (
      /** @type {boolean} */ pass,
      /** @type {string} */ label,
    ) => {
      if (!pass) throw Error(label);
      rows.push(label);
    };
    check(
      guard.key(structuredClone(history)) === base,
      "detached identical history retains source key",
    );
    const appended = [
      { _id: "owned", requestId: "child", bodyBase64: "T1dORUQ=" },
      ...history,
    ];
    guard.record(appended, base);
    check(
      guard.key(appended) === base,
      "exact owned history append does not retrigger preview",
    );
    const evicted = [
      { _id: "owned-next", requestId: "child", bodyBase64: "TkVYVA==" },
      appended[0],
    ];
    guard.record(evicted, base);
    check(
      guard.key(evicted) === base,
      "owned history eviction preserves source key without suppressing writes",
    );
    const external = [
      { _id: "external", requestId: "a", bodyBase64: "Q0hBTkdFRA==" },
      ...evicted,
    ];
    const externalKey = guard.key(external);
    check(
      externalKey !== base,
      "external native response changes invalidate preview",
    );
    const edit = structuredClone(external);
    edit[0].bodyBase64 = "RURJVA==";
    check(
      guard.key(edit) !== externalKey,
      "external response body replacement invalidates preview",
    );
    const next = [
      { _id: "owned-new-origin", requestId: "child", bodyBase64: "T1dORUQ=" },
      ...external,
    ];
    guard.record(next, externalKey);
    check(
      guard.key(next) === externalKey,
      "new preview origin preserves its external response inputs",
    );
    const data = f.initialData();
    const request = f.newRequest(data.activeWorkspaceId, {
      authentication: { type: "oauth2", clientId: "{% oauthhelper %}" },
    });
    data.resources.push(request);
    const source = f.oauthSourceContext(data, request);
    data.resources.push({
      _id: "owned-token",
      _type: "oauth2_token",
      parentId: request._id,
      accessToken: "owned",
    });
    check(
      f.oauthSourceContext(data, request) === source,
      "token-only updates preserve resolved helper source",
    );
    request.authentication.clientId = "changed";
    check(
      f.oauthSourceContext(data, request) !== source,
      "OAuth input edits invalidate resolved helper source",
    );
    return rows;
  });
  assert.equal(checks.length, 8);
  await page.evaluate(()=>/** @type {any} */(window).__pluginOAuthPreviewFixture.mountEditor());
  const editor=page.getByRole('region',{name:'Owned OAuth preview',exact:true});
  try{
    await editor.getByText('API token ready',{exact:true}).waitFor();
    const token=editor.getByLabel('Access token',{exact:true});
    assert.equal(await token.inputValue(),'owned-preview-token');
    await page.evaluate(()=>/** @type {any} */(window).__pluginOAuthPreviewFixture.pause());
    await page.waitForFunction(()=>/** @type {any} */(window).__pluginOAuthPreviewFixture.phase()==='paused');
    assert.equal(await token.inputValue(),'owned-preview-token');
    assert.equal(await editor.getByText('Checking token…',{exact:true}).count(),0);
    await page.evaluate(()=>/** @type {any} */(window).__pluginOAuthPreviewFixture.resume());
    await page.waitForFunction(()=>/** @type {any} */(window).__pluginOAuthPreviewFixture.phase()==='idle');
    await editor.getByText('API token ready',{exact:true}).waitFor();
    assert.equal(await token.inputValue(),'owned-preview-token');
    checks.push('actual OAuthEditor retains resolved token across workspace pause/resume');
  }finally{await page.evaluate(()=>/** @type {any} */(window).__pluginOAuthPreviewFixture.dispose());}
  await Bun.write(
    output + "/result.json",
    JSON.stringify(
      {
        status: "passed",
        headless: true,
        checks,
        limits:
          "Actual history/source guard and mounted literal OAuth preview pause/resume; no provider/native IPC or held-render-failure coverage.",
      },
      null,
      2,
    ),
  );
});
