import { exerciseSplit } from "./helpers/split-pane.js";
import { assertGraphqlSegmented } from "./helpers/graphql-segmented.js";
import {
  registerResourceProbeCollection,
  withResourceProbePreserved,
} from "./helpers/resource-manager-cases.js";
import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { buildSchema, introspectionFromSchema } from "graphql";
import { preserveNativeProfile } from "./helpers/native-profile-preservation.js";
import { withNativeApp, poll, selectedNativeProbeIdentifier, integrationProbeIdentifier } from "./helpers/native-app.js";
import {withComponentFixture} from './helpers/component-fixture.js';

if(process.env.INSOMNIUM_GRAPHQL_NAVIGATION==='1'){
  await withComponentFixture('graphql-navigation',async(page,output)=>{
    const variables=page.locator('.shared-code-editor').filter({has:page.locator('textarea[aria-label="GraphQL variables"]')}).locator('.CodeMirror');
    await variables.waitFor();
    await variables.evaluate(element=>{
      const editor=/** @type {any} */(element).CodeMirror;
      editor.focus();editor.setCursor(editor.posFromIndex(editor.getValue().length));
    });
    await page.keyboard.press('Control+Space');
    await page.locator('.CodeMirror-hints').waitFor();
    await variables.evaluate(element=>{
      const editor=/** @type {any} */(element).CodeMirror;
      editor.fixtureCompletion=editor.state.completionActive;
    });
    await page.keyboard.type('i');
    assert.ok(await variables.evaluate(element=>{
      const editor=/** @type {any} */(element).CodeMirror;
      return !!editor.fixtureCompletion && editor.state.completionActive===editor.fixtureCompletion;
    }),'Variables-only edit retains the original completion session without automatic reopening');
    await page.keyboard.press('Escape');
    const jumpErrors=/** @type {string[]} */([]);page.on('pageerror',error=>jumpErrors.push(String(error)));
    const physicalQuery=page.locator('.shared-code-editor').filter({has:page.locator('textarea[aria-label="GraphQL query"]')}).locator('.CodeMirror');
    const authoredQuery=await physicalQuery.evaluate(element=>/** @type {any} */(element).CodeMirror.getValue());
    await page.evaluate(()=>/** @type {any} */(window).setNavigationCompletionDelay(250));
    await physicalQuery.evaluate(element=>{const cm=/** @type {any} */(element).CodeMirror;cm.setValue('query { u');cm.focus();cm.setCursor(cm.posFromIndex(cm.getValue().length));});
    await page.keyboard.type('s');
    await page.evaluate(()=>/** @type {any} */(window).refreshNavigationSchema());
    await page.waitForTimeout(400);assert.equal(await page.locator('.CodeMirror-hints').count(),0,'Retired schema input timer must not reopen completion');
    await page.keyboard.type('e');await page.locator('.CodeMirror-hints').waitFor();assert.match(await page.locator('.CodeMirror-hints').innerText(),/user/);await page.keyboard.press('Escape');
    await physicalQuery.evaluate(element=>{const cm=/** @type {any} */(element).CodeMirror;cm.setValue('query { u');cm.focus();cm.setCursor(cm.posFromIndex(cm.getValue().length));});
    await page.keyboard.type('s');
    await page.evaluate(()=>/** @type {any} */(window).setNavigationCompletionDelay(0));
    await page.waitForTimeout(400);assert.equal(await page.locator('.CodeMirror-hints').count(),0,'Disabling automatic completion retires a queued input timer');
    await page.evaluate(()=>/** @type {any} */(window).setNavigationCompletionDelay(250));
    await physicalQuery.evaluate(element=>{const cm=/** @type {any} */(element).CodeMirror;cm.setValue('query { u');cm.focus();cm.setCursor(cm.posFromIndex(cm.getValue().length));});
    await page.keyboard.type('s');
    await physicalQuery.evaluate(element=>{const cm=/** @type {any} */(element).CodeMirror;cm.setValue('query { u');cm.setCursor(cm.posFromIndex(cm.getValue().length));});
    await page.waitForTimeout(400);assert.equal(await page.locator('.CodeMirror-hints').count(),0,'Programmatic body replacement cancels pending input completion');
    await page.keyboard.type('s');await page.locator('.CodeMirror-hints').waitFor();assert.match(await page.locator('.CodeMirror-hints').innerText(),/user/);await page.keyboard.press('Escape');
    await page.evaluate(()=>/** @type {any} */(window).setNavigationCompletionDelay(0));
    await physicalQuery.evaluate((element,value)=>{/** @type {any} */(element).CodeMirror.setValue(value);},authoredQuery);
    await physicalQuery.locator('span.cm-property').filter({hasText:/^user$/}).hover();
    await page.keyboard.down('Control');
    try{
      await physicalQuery.locator('.CodeMirror-jump-token').waitFor();
      await physicalQuery.locator('.CodeMirror-jump-token').click();
      await page.locator('.schema-member-reference').waitFor();
    }finally{await page.keyboard.up('Control');}
    await page.waitForTimeout(50);assert.deepEqual(jumpErrors,[],'Ctrl-click navigation/unmount then modifier release must not retain document callbacks');
    await page.getByRole('button',{name:'Back in schema navigation'}).click();
    await physicalQuery.locator('span.cm-property').filter({hasText:/^user$/}).hover();
    await page.keyboard.down('Control');
    try{
      await physicalQuery.locator('.CodeMirror-jump-token').waitFor();
      await physicalQuery.evaluate(element=>{const cm=/** @type {any} */(element).CodeMirror;cm.fixtureOldJump=cm.state.jump;});
      await page.evaluate(()=>/** @type {any} */(window).refreshNavigationSchema());
      await poll(async()=>physicalQuery.evaluate(element=>{const cm=/** @type {any} */(element).CodeMirror;return cm.state.jump!==cm.fixtureOldJump;}),'Schema refresh retires active gesture owner');
      assert.ok(await physicalQuery.evaluate(element=>{const cm=/** @type {any} */(element).CodeMirror;return !cm.fixtureOldJump.marker&&!cm.fixtureOldJump.destination;}),'Retired schema gesture releases its mark/reference');
    }finally{await page.keyboard.up('Control');}
    await page.waitForTimeout(50);assert.deepEqual(jumpErrors,[],'Schema replacement during Ctrl hold leaves no retired key-up callback');
    assert.equal(await physicalQuery.evaluate(element=>/** @type {any} */(element).CodeMirror.getValue()),'query Find($id: ID) { user(id: $id) { id } }','Jump gestures preserve authored query');
    for(const [kind,expected] of [['field','user'],['argument','id'],['enum','ADMIN'],['directiveArgument','level']]){
      await page.getByRole('button',{name:'Query',exact:true}).click();
      const query=page.locator('.shared-code-editor').filter({has:page.locator('textarea[aria-label="GraphQL query"]')}).locator('.CodeMirror');
      await query.waitFor();
      await query.evaluate((element,kind)=>{
        const options=/** @type {any} */(element).CodeMirror.getOption('jump'),schema=options.schema;
        const type=schema.getQueryType(),field=type.getFields().user;
        options.onClick(kind==='field'?{kind:'Field',type,field}
          :kind==='argument'?{kind:'Argument',type,field,argument:field.args[0]}
          :kind==='enum'?{kind:'EnumValue',type:schema.getType('Role'),value:schema.getType('Role').getValues()[0]}
          :{kind:'Argument',directive:schema.getDirective('trace'),argument:schema.getDirective('trace').args[0]});
      },kind);
      const mark=page.locator('.schema-member-reference');
      await mark.waitFor();assert.equal(await mark.textContent(),expected);
      if(kind==='field'){
        await page.getByRole('navigation',{name:'Referenced schema types'}).getByRole('button',{name:'User',exact:true}).click();
        await mark.waitFor({state:'detached'});
        await page.getByRole('button',{name:'Back in schema navigation'}).click();
        await mark.waitFor();assert.equal(await mark.textContent(),'user','Back restores the exact field target');
      }
      await page.getByRole('button',{name:'Back in schema navigation'}).click();
      await mark.waitFor({state:'detached'});
    }
    const query=page.locator('.shared-code-editor').filter({has:page.locator('textarea[aria-label="GraphQL query"]')}).locator('.CodeMirror');
    await query.waitFor();
    await query.evaluate(element=>{
      const options=/** @type {any} */(element).CodeMirror.getOption('jump');
      options.onClick({kind:'Type',type:options.schema.getType('__Type')});
    });
    const types=page.getByRole('listbox',{name:'Schema types',exact:true});
    await page.waitForFunction(()=>/** @type {HTMLSelectElement|null} */(document.querySelector('select[aria-label="Schema types"]'))?.value==='__Type');
    assert.match(await page.locator('.schema-definition').innerText(),/type __Type/);
    await page.getByRole('navigation',{name:'Referenced schema types'}).getByRole('button',{name:'__Field',exact:true}).click();
    assert.equal(await types.inputValue(),'__Field');
    assert.match(await page.locator('.schema-definition').innerText(),/type __Field/);
    await page.getByRole('button',{name:'Back in schema navigation'}).click();
    assert.equal(await types.inputValue(),'__Type');
    await page.getByRole('button',{name:'Back in schema navigation'}).click();
    await page.getByRole('button',{name:'Schema',exact:true}).click();
    assert.equal(await types.locator('option[value^="__"]').count(),0,'Default list hides introspection types after returning');
    const search=page.getByRole('textbox',{name:'Search schema types and fields',exact:true});
    await search.fill('__Type');
    await types.locator('option[value="__Type"]').waitFor({state:'attached'});
    await search.fill('');
    await search.fill('Query');
    await page.getByRole('navigation',{name:'Referenced schema types'}).getByRole('button',{name:'User',exact:true}).click();
    assert.equal(await search.inputValue(),'');
    assert.match(await page.locator('.schema-definition').innerText(),/type User/);
    const back=page.getByRole('button',{name:'Back in schema navigation'});
    await back.focus();
    await back.press('Enter');
    assert.equal(await search.evaluate(element=>element===document.activeElement),true,'Last Back restores keyboard focus to schema search');
    assert.equal(await search.inputValue(),'Query');
    assert.match(await page.locator('.schema-definition').innerText(),/type Query/);
    await page.getByRole('navigation',{name:'Referenced schema types'}).getByRole('button',{name:'User',exact:true}).click();
    await page.evaluate(()=>/** @type {any} */(window).replaceNavigationSchema());
    await page.getByRole('button',{name:'Back in schema navigation'}).waitFor({state:'detached'});
    for(const outcome of ['success','failure','clear']){
      if(outcome==='clear')await page.getByRole('button',{name:'Clear schema',exact:true}).click();
      /** @type {import('playwright-core').Route|undefined} */ let pending;
      await page.route('**/held-schema',route=>{pending=route;});
      try{
        await page.getByRole('button',{name:'Fetch schema',exact:true}).click();
        await poll(async()=>!!pending,'Owned introspection request reached held route');
        await page.evaluate(()=>/** @type {any} */(window).replaceNavigationSchema());
        if(outcome==='clear')await page.getByRole('button',{name:'Clear schema',exact:true}).click();
        assert.ok(pending);
        if(outcome!=='failure')await pending.fulfill({status:200,contentType:'application/json',body:JSON.stringify({data:introspectionFromSchema(buildSchema('type Query { stale: String }'))})});
        else await pending.abort('failed');
        await page.waitForFunction(()=>Array.from(document.querySelectorAll('button')).some(button=>button.textContent?.trim()==='Fetch schema'&&!button.disabled));
        if(outcome==='clear')await page.getByText('No schema loaded',{exact:true}).waitFor();
        else{
          await page.getByRole('listbox',{name:'Schema types',exact:true}).selectOption('Query');
          assert.match(await page.locator('.schema-definition').innerText(),/next: String/);
        }
        assert.equal(await page.getByRole('alert').count(),0,'Retired fetch must not publish stale errors');
      }finally{await pending?.abort().catch(()=>{});await page.unroute('**/held-schema');}
    }
    assert.deepEqual(jumpErrors,[],'No jump lifecycle page errors across navigation/replacement/fetch flows');
    await Bun.write(output+'/result.json',JSON.stringify({status:'passed',headless:true,checks:['queued completion rejects retired schema, disabled autocomplete or replaced text; new input still completes','schema replacement while Ctrl held retires marker/reference/listeners','physical Ctrl-click survives query-editor unmount and modifier release','variables-only typing preserves completion session with automatic completion disabled','reference navigation','Back restores search and definition','keyboard Back restores search focus','schema replacement clears history','held fetch success/failure preserve replacement schema'],limits:'Real component/workflow/preview transport with held Playwright route; no native IPC or external server'},null,2));
  });
  process.exit(0);
}

const completionNative=process.env.INSOMNIUM_GRAPHQL_COMPLETION_OWNER_NATIVE==='1';
const jumpNative=process.env.INSOMNIUM_GRAPHQL_JUMP_NATIVE==='1';
assert.ok(!completionNative||!jumpNative,'Native focuses are exclusive');
const focusedNative=completionNative||jumpNative;
if(focusedNative){assert.equal(selectedNativeProbeIdentifier(),integrationProbeIdentifier);assert.ok(process.env.INSOMNIUM_UI_BUILD_STATE,'Explicit native build required');}
process.env.INSOMNIUM_UI_BUILD_STATE ||=
  "artifacts/native-nocturne-controls-probe/build-state.json";
const sdl = `
  enum Role { ADMIN READER }
  input Filter { role: Role, limit: Int }
  """A fixture user"""
  type User { id: ID!, name: String! }
  type Query { users(filter: Filter!): [User!]!, user(id: ID!): User }
`;
const schema = buildSchema(sdl);
const query =
  "query Find($filter: Filter!) { users(filter: $filter) { id name } }";
/** @type {Array<{method:string, body:Record<string, any>, authorization:string|null}>} */
const events = [];
const server = Bun.serve({
  hostname: "127.0.0.1",
  port: 0,
  async fetch(request) {
    const body = await request.json();
    events.push({
      method: request.method,
      body,
      authorization: request.headers.get("authorization"),
    });
    return Response.json(
      body.operationName === "IntrospectionQuery"
        ? { data: introspectionFromSchema(schema) }
        : { data: { users: [{ id: "1", name: "GraphQL native fixture" }] } },
    );
  },
});
const runNative=()=>withResourceProbePreserved(async () => {
  try {
    await withNativeApp(completionNative?"graphql-completion-owner":jumpNative?"graphql-jump":"graphql-editor", async ({ page, invoke, output }) => {
      if(completionNative){const data=await invoke('load_workspace');data.settings.autocompleteDelay=1000;await invoke('save_workspace',{data});await page.reload();await page.locator('.app-shell').waitFor();}
      const name = "GraphQL editor " + Date.now();
      const original = {
        query,
        variables: { filter: { role: "ADMIN" } },
        operationName: "Find",
      };
      const resources = [
        {
          _id: "wrk_graphql_probe",
          _type: "workspace",
          parentId: null,
          name,
          scope: "collection",
        },
        {
          _id: "req_graphql_probe",
          _type: "request",
          parentId: "wrk_graphql_probe",
          name,
          method: "POST",
          url: "http://127.0.0.1:" + server.port + "/graphql",
          headers: [],
          parameters: [],
          authentication: { type: "bearer", token: "graphql-fixture" },
          body: {
            mimeType: "application/graphql",
            text: JSON.stringify(original),
          },
        },
      ];
      await page
        .getByRole("button", { name: "Import collection", exact: true })
        .click();
      const dialog = page.getByRole("dialog");
      await dialog
        .getByLabel("Import collection or cURL commands", { exact: true })
        .fill(JSON.stringify({ resources }));
      await dialog
        .getByRole("button", { name: "Review import", exact: true })
        .click();
      await dialog.getByRole("button", { name: "Import", exact: true }).click();
      await dialog.waitFor({ state: "detached" });
      const select = () =>
        page
          .getByRole("complementary", { name: "Collections" })
          .getByRole("button", { name: "GQL " + name, exact: true })
          .click();
      await select();
      const actualImported = await invoke("load_workspace");
      const importedCollection = actualImported.resources.find(
        (/** @type {Record<string,any>} */ item) =>
          item._id === actualImported.activeWorkspaceId &&
          item._type === "workspace",
      );
      assert.ok(
        importedCollection && importedCollection.name === name,
        "Actual imported fixture collection identity",
      );
      registerResourceProbeCollection(
        importedCollection._id,
        importedCollection.name,
      );
      await Bun.write(
        output + "/owned-collection.json",
        JSON.stringify(
          { id: importedCollection._id, name: importedCollection.name },
          null,
          2,
        ),
      );
      const panel = page.locator(".graphql-panel");
      await panel.waitFor();
      if(!focusedNative)await Bun.write(
        output + "/graphql-segmented.json",
        JSON.stringify(await assertGraphqlSegmented(page, panel), null, 2),
      );
      const saved = async () =>
        (await invoke("load_workspace")).resources.find(
          (/** @type {Record<string, any>} */ r) =>
            r.name === name && r._type === "request",
        );
      await panel
        .getByRole("button", { name: "Fetch schema", exact: true })
        .click();
      await panel.getByLabel("Schema types", { exact: true }).waitFor();
      if(!jumpNative)await exerciseSplit(page, "Schema types and documentation size");
      assert.equal(events.length, 1);
      assert.equal(events[0].method, "POST");
      assert.equal(events[0].body.operationName, "IntrospectionQuery");
      assert.equal(events[0].authorization, "Bearer graphql-fixture");
      assert.deepEqual(JSON.parse((await saved()).body.text), original);
      if(completionNative){
        const errors=/** @type {string[]} */([]);page.on('pageerror',error=>errors.push(String(error)));
        const before=await invoke('load_workspace');await panel.getByRole('button',{name:'Query',exact:true}).click();
        const cm=panel.locator('.shared-code-editor').filter({has:page.locator('textarea[aria-label="GraphQL query"]')}).locator('.CodeMirror');await cm.waitFor();
        await cm.evaluate(element=>{const editor=/** @type {any} */(element).CodeMirror;editor.focus();editor.setCursor(editor.posFromIndex(editor.getValue().length));});
        await page.keyboard.type(' ');await page.keyboard.press('Control+Shift+F');
        await poll(async()=>cm.evaluate(element=>/** @type {any} */(element).CodeMirror.getValue().includes('\n')),'Actual GraphQL format shortcut replaced text');
        const formatted=await cm.evaluate(element=>{const editor=/** @type {any} */(element).CodeMirror,value=editor.getValue();editor.setCursor(editor.posFromIndex(value.indexOf('users')+1));editor.focus();return value;});
        await page.waitForTimeout(1250);assert.equal(await page.locator('.CodeMirror-hints').count(),0,'Native format retires queued automatic completion');
        await cm.evaluate(element=>{const editor=/** @type {any} */(element).CodeMirror,index=editor.getValue().indexOf('users');editor.setSelection(editor.posFromIndex(index),editor.posFromIndex(index+5));});
        await page.keyboard.type('us');await page.locator('.CodeMirror-hints').waitFor();assert.match(await page.locator('.CodeMirror-hints').innerText(),/users/);await page.keyboard.press('Escape');
        await cm.evaluate((element,value)=>{/** @type {any} */(element).CodeMirror.setValue(value);},formatted);
        await poll(async()=>JSON.parse((await saved()).body.text).query===formatted,'Formatted query persisted');
        const body=JSON.parse((await saved()).body.text);assert.deepEqual(body.variables,original.variables);assert.equal(body.operationName,original.operationName);assert.equal(events.length,1);assert.deepEqual((await invoke('load_workspace')).history,before.history);
        const resource=await saved();await page.reload();await select();await panel.waitFor();assert.deepEqual(await saved(),resource);assert.equal(events.length,1);assert.deepEqual((await invoke('load_workspace')).history,before.history);assert.deepEqual(errors,[]);
        await Bun.write(join(output,'acceptance.json'),JSON.stringify({passed:true,checks:['native real typing schedules delayed completion','Format shortcut replaces query and retires queued timer','no delayed popup after1250ms','new typing still opens automatic completion','variables/operation preserved','one authenticated introspection only','history/reload without resend'],events,errors,resource,formatted,delayMs:1000,quietMs:1250,limits:'Windows hidden WebView2 Format/document-change timer cancellation and new-input control only; schema/request/mode/environment/disabled-setting ownership variants retain separate browser or open native gates.'},null,2));return;
      }
      if(jumpNative){
        const errors=/** @type {string[]} */([]);page.on('pageerror',error=>errors.push(String(error)));
        const before=await invoke('load_workspace');
        const cm=panel.locator('.shared-code-editor').filter({has:page.locator('textarea[aria-label="GraphQL query"]')}).locator('.CodeMirror');
        for(const refresh of [false,true]){
          await panel.getByRole('button',{name:'Query',exact:true}).click();
          await cm.locator('span.cm-property').filter({hasText:/^users$/}).hover();
          await page.keyboard.down('Control');
          try{
            await cm.locator('.CodeMirror-jump-token').waitFor();
            if(refresh){
              await panel.getByRole('button',{name:'Fetch schema',exact:true}).click();
              await poll(async()=>events.length===2,'Second native introspection');
              await panel.getByLabel('Schema types',{exact:true}).waitFor();
            }else{
              await cm.locator('.CodeMirror-jump-token').click();
              await panel.locator('.schema-member-reference').waitFor();
              assert.equal(await panel.locator('.schema-member-reference').innerText(),'users');
              await panel.getByRole('button',{name:'Back in schema navigation'}).waitFor();
            }
          }finally{await page.keyboard.up('Control');}
          await page.waitForTimeout(50);assert.deepEqual(errors,[],'Native modifier release after editor unmount');
          if(!refresh)await panel.getByRole('button',{name:'Back in schema navigation'}).click();
          assert.deepEqual(JSON.parse((await saved()).body.text),original);
        }
        assert.equal(events.length,2);assert.ok(events.every(e=>e.body.operationName==='IntrospectionQuery'&&e.authorization==='Bearer graphql-fixture'));
        assert.deepEqual((await invoke('load_workspace')).history,before.history,'Schema/jump actions never dispatch the user query');
        const resource=await saved();await page.reload();await select();await panel.waitFor();assert.deepEqual(await saved(),resource);assert.equal(events.length,2,'Reload does not fetch or execute');assert.deepEqual((await invoke('load_workspace')).history,before.history);assert.deepEqual(errors,[]);
        await Bun.write(join(output,'acceptance.json'),JSON.stringify({passed:true,checks:['native physical Ctrl-click/unmount/release','native schema refresh while Ctrl held','query variables operation preserved','two authenticated introspections only','history/reload without resend'],events,errors,resource,limits:'Windows hidden WebView2 physical keyboard/mouse via saved scenario; not real OS modifier/window-blur or full GraphQL acceptance.'},null,2));
        return;
      }
      await panel
        .getByLabel("Schema types", { exact: true })
        .selectOption("User");
      assert.match(
        await panel.locator(".schema-definition").innerText(),
        /name: String!/,
      );
      const checks = [
        "native introspection with auth",
        "schema fetch preserves user body",
        "schema type browser",
      ];

      await panel.getByRole("button", { name: "Query", exact: true }).click();
      /** @param {string} label */
      const editor = (label) =>
        panel.locator(".shared-code-editor").filter({
          has: page.locator('textarea[aria-label="' + label + '"]'),
        });
      /** @param {string} label @param {string} text */
      const edit = async (label, text) => {
        const host = editor(label);
        await host.locator(".CodeMirror").click();
        await page.keyboard.press("Control+A");
        await page.keyboard.insertText(text);
        await page.keyboard.press("Escape");
        await poll(async () => {
          const body = JSON.parse((await saved()).body.text);
          return (
            (label === "GraphQL query" ? body.query : body.variables) === text
          );
        }, "GraphQL editor persisted " + label);
      };
      await edit("GraphQL query", "query { us");
      await page.keyboard.press("Control+Space");
      const hints = page.locator(".CodeMirror-hints");
      await hints.waitFor();
      assert.match(await hints.innerText(), /users/);
      const assertCompletionTokens = async () => {
        const item = hints.locator(".CodeMirror-hint").first();
        const metrics = () =>
          hints.evaluate((el) => {
            const popup = getComputedStyle(el);
            const node = el.querySelector(".CodeMirror-hint");
            if (!node) throw Error("Completion option must be present");
            const option = getComputedStyle(node);
            return {
              padding: popup.padding,
              itemPadding: option.padding,
              shadow: popup.boxShadow,
              radius: popup.borderRadius,
              itemRadius: option.borderRadius,
              font: popup.fontSize,
            };
          });
        const defaults = await metrics();
        assert.equal(defaults.padding, "2px");
        assert.equal(defaults.itemPadding, "0px 4px");
        assert.equal(defaults.shadow, "rgba(0, 0, 0, 0.2) 2px 3px 5px 0px");
        assert.equal(defaults.radius, "3px");
        assert.equal(defaults.itemRadius, "2px");
        try {
          await page.evaluate(() => {
            const root = document.documentElement.style;
            root.setProperty("--space-2", "6px");
            root.setProperty("--space-4", "9px");
            root.setProperty(
              "--editor-completion-shadow",
              "0 1px 7px rgb(1, 2, 3)",
            );
          });
          const changed = await metrics();
          assert.equal(
            changed.padding,
            "6px",
            "Completion popup must follow shared spacing",
          );
          assert.equal(changed.itemPadding, "0px 9px");
          assert.equal(changed.shadow, "rgb(1, 2, 3) 0px 1px 7px 0px");
          assert.equal(changed.radius, defaults.radius);
          assert.equal(changed.itemRadius, defaults.itemRadius);
          assert.equal(changed.font, defaults.font);
          await item.waitFor();
        } finally {
          await page.evaluate(() => {
            for (const name of [
              "--space-2",
              "--space-4",
              "--editor-completion-shadow",
            ])
              document.documentElement.style.removeProperty(name);
          });
        }
        assert.deepEqual(await metrics(), defaults);
      };
      await assertCompletionTokens();
      await page.keyboard.press("Escape");
      checks.push("schema query completion");
      await edit("GraphQL query", query);
      await edit("GraphQL variables", '{ "');
      await page.keyboard.press("Control+Space");
      await hints.waitFor();
      assert.match(await hints.innerText(), /filter/);
      await page.keyboard.press("Escape");
      checks.push("operation variable completion");
      await edit("GraphQL variables", '{ "filter": { "');
      await page.keyboard.press("Control+Space");
      await hints.waitFor();
      assert.match(await hints.innerText(), /role/);
      assert.match(await hints.innerText(), /limit/);
      await page.keyboard.press("Escape");
      checks.push("nested input completion");
      await edit("GraphQL variables", '{"filter":{"role":"');
      await page.keyboard.press("Control+Space");
      await hints.waitFor();
      assert.match(await hints.innerText(), /ADMIN/);
      assert.match(await hints.innerText(), /READER/);
      await page.keyboard.press("Escape");
      checks.push("enum completion");
      await edit("GraphQL variables", "[]");
      await editor("GraphQL variables")
        .locator(".CodeMirror-lint-mark-error")
        .first()
        .waitFor();
      checks.push("non-object variable lint");
      await edit("GraphQL variables", '{"filter":{"role":"ADMIN"}}');
      await panel
        .getByRole("button", { name: "Validate", exact: true })
        .click();
      await panel.getByRole("status").waitFor();
      assert.match(
        await panel.getByRole("status").innerText(),
        /Query and variables match the loaded schema/,
      );
      checks.push("rendered query validation");
      await editor("GraphQL query")
        .locator(".CodeMirror-code")
        .getByText("users", { exact: true })
        .hover();
      const info = page.getByRole("dialog", {
        name: "GraphQL schema information",
        exact: true,
      });
      await info.waitFor();
      assert.equal(
        await info.evaluate((el) => getComputedStyle(el).borderRadius),
        "4px",
      );
      assert.equal(
        await info.evaluate((el) => getComputedStyle(el).boxShadow),
        "rgba(0, 0, 0, 0.333) 0px 4px 18px 0px",
      );
      try {
        await page.evaluate(() => {
          document.documentElement.style.setProperty("--radius-group", "9px");
          document.documentElement.style.setProperty(
            "--editor-popup-shadow",
            "0px 2px 6px rgb(1, 2, 3)",
          );
          document.documentElement.style.setProperty("--font-size-12", "14px");
        });
        assert.equal(
          await info.evaluate((el) => getComputedStyle(el).borderRadius),
          "9px",
        );
        assert.equal(
          await info.evaluate((el) => getComputedStyle(el).boxShadow),
          "rgb(1, 2, 3) 0px 2px 6px 0px",
        );
        assert.equal(
          await editor("GraphQL query")
            .locator(".CodeMirror")
            .evaluate((el) => getComputedStyle(el).fontSize),
          "14px",
        );
      } finally {
        await page.evaluate(() => {
          for (const token of [
            "--radius-group",
            "--editor-popup-shadow",
            "--font-size-12",
          ])
            document.documentElement.style.removeProperty(token);
        });
      }
      // Restoring typography changes the hover target's geometry. Reopen the real
      // documentation popup before capturing its final, restored appearance.
      await editor("GraphQL query")
        .locator(".CodeMirror-code")
        .getByText("users", { exact: true })
        .hover();
      await info.waitFor();
      await info.screenshot({ path: join(output, "editor-popup-tokens.png") });
      checks.push(
        "native editor and schema popup foundation token propagation",
      );
      await info.getByRole("link", { name: "User", exact: true }).click();
      await panel.getByLabel("Schema types", { exact: true }).waitFor();
      assert.equal(
        await panel.getByLabel("Schema types", { exact: true }).inputValue(),
        "User",
      );
      assert.equal(await info.count(), 0);
      checks.push("hover type navigation and popup cleanup");
      await panel.getByRole("button", { name: "Query", exact: true }).click();
      await edit(
        "GraphQL query",
        "query Find($filter: Filter!) { users(filter: $filter) { missing } }",
      );
      await panel
        .getByRole("button", { name: "Validate", exact: true })
        .click();
      await panel.getByRole("alert").waitFor();
      assert.match(
        await panel.getByRole("alert").innerText(),
        /Cannot query field.*missing/,
      );
      checks.push("schema-invalid field diagnostic");
      await edit(
        "GraphQL query",
        query + " query Other($id: ID!) { user(id: $id) { id } }",
      );
      await panel
        .getByLabel("GraphQL operation name", { exact: true })
        .fill("Other");
      await edit("GraphQL variables", '{ "');
      await page.keyboard.press("Control+Space");
      await hints.waitFor();
      assert.match(await hints.innerText(), /id/);
      assert.doesNotMatch(await hints.innerText(), /filter/);
      await page.keyboard.press("Escape");
      await panel
        .getByLabel("GraphQL operation name", { exact: true })
        .fill("Find");
      await editor("GraphQL variables").locator(".CodeMirror").click();
      await page.keyboard.press("Control+End");
      await page.keyboard.press("Control+Space");
      await hints.waitFor();
      assert.match(await hints.innerText(), /filter/);
      assert.doesNotMatch(await hints.innerText(), /"id"/);
      await page.keyboard.press("Escape");
      checks.push("multiple-operation variable completion switches scope");
      await edit("GraphQL variables", '{"filter":{"role":"ADMIN"}}');

      await edit("GraphQL query", query);

      await page.getByRole("button", { name: "Send", exact: true }).click();
      await poll(async () => events.length === 2, "native GraphQL send");
      await poll(
        async () =>
          !(await page
            .getByRole("button", { name: "Cancel", exact: true })
            .count()),
        "native GraphQL settled",
      );
      assert.deepEqual(events[1].body, {
        query,
        variables: { filter: { role: "ADMIN" } },
        operationName: "Find",
      });
      assert.match(
        await page.locator("body").innerText(),
        /GraphQL native fixture/,
      );
      checks.push("native request body and response");

      await page.reload();
      await select();
      assert.equal(
        await panel
          .getByLabel("GraphQL operation name", { exact: true })
          .inputValue(),
        "Find",
      );
      assert.equal(JSON.parse((await saved()).body.text).query, query);
      await panel.getByRole("button", { name: "Schema", exact: true }).click();
      assert.match(await panel.innerText(), /No schema loaded/);
      checks.push("reload preserves query but clears session schema");

      await panel.locator('input[type="file"]').setInputFiles({
        name: "fixture.graphql",
        mimeType: "text/plain",
        buffer: Buffer.from(sdl),
      });
      await panel.getByLabel("Schema types", { exact: true }).waitFor();
      await panel
        .getByLabel("Schema types", { exact: true })
        .selectOption("Filter");
      assert.match(
        await panel.locator(".schema-definition").innerText(),
        /role: Role/,
      );
      checks.push("local SDL schema import");
      await panel.getByRole("button", { name: "Query", exact: true }).click();
      // Network schema identity includes settings; local SDL remains valid across theme changes.
      for (const theme of ["light", "dark"]) {
        if ((await page.locator("html").getAttribute("data-theme")) !== theme)
          await page
            .getByRole("button", { name: "Toggle theme", exact: true })
            .click();
        await page.waitForFunction(
          (value) => document.documentElement.dataset.theme === value,
          theme,
        );
        await poll(
          async () => (await invoke("load_workspace")).settings.theme === theme,
          "Completion theme persisted " + theme,
        );
        await edit("GraphQL query", "query { us");
        await page.keyboard.press("Control+Space");
        await hints.waitFor();
        assert.match(await hints.innerText(), /users/);
        assert.equal(
          await hints.evaluate((el) => getComputedStyle(el).backgroundColor),
          theme === "dark" ? "rgb(38, 38, 38)" : "rgb(243, 244, 246)",
        );
        await assertCompletionTokens();
        await hints.screenshot({
          path: join(output, `completion-${theme}.png`),
        });
        await page.keyboard.press("Escape");
      }
      await edit("GraphQL query", query);
      checks.push(
        "native completion spacing/shadow token propagation and restoration with network schema and local SDL in both themes",
      );
      await writeFile(
        join(output, "acceptance.json"),
        JSON.stringify({ checks, events }, null, 2),
      );
    });
  } finally {
    server.stop(true);
  }
}, {expectedIdentifier:selectedNativeProbeIdentifier()});
if(focusedNative)await preserveNativeProfile(runNative);else await runNative();
