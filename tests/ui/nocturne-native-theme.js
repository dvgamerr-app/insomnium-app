import { assertButtonPadding } from "./helpers/button-padding.js";
import { assertFormGeometry } from "./helpers/form-geometry.js";
import { assertFocusSurface } from "./helpers/focus-surface.js";
import { assertSelectGeometry } from "./helpers/select-geometry.js";
import assert from "node:assert/strict";
import { withNativeApp, poll } from "./helpers/native-app.js";
import { assertDialogTokens } from "./helpers/dialog-theme.js";
import { withIpcFailure } from "./helpers/ipc-failure.js";
import { gitCollection } from "./helpers/git-fixture.js";
import { assertSurfaceHover } from "./helpers/select.js";
import {
  assertCaptionTypography,
  assertPickerTypography,
} from "./helpers/typography.js";

process.env.INSOMNIUM_UI_BUILD_STATE ||=
  "artifacts/native-unified-diff-probe/build-state.json";
await withNativeApp(
  "nocturne-native-theme",
  async ({ page, invoke, output }) => {
    const buttonPadding = /** @type {Array<Record<string,any>>} */ ([]);
    const formGeometry = /** @type {Array<Record<string,any>>} */ ([]);
    const focusSurfaces = /** @type {Array<Record<string,any>>} */ ([]);
    const selectGeometry = /** @type {Array<Record<string,any>>} */ ([]);
    await page.emulateMedia({ reducedMotion: "reduce" });
    const fixture = await gitCollection({ page, invoke });
    const recoveryBranch = "theme-visual-recovery";
    await invoke("git_repository_create_branch", {
      repositoryId: fixture.repositoryId,
      input: {
        name: recoveryBranch,
        expectedBranch: "main",
        expectedHeadOid: fixture.oid,
        authorName: fixture.author.name,
        authorEmail: fixture.author.email,
        verifyOnly: false,
      },
    });
    const authorBaseline = await invoke("load_workspace");
    await page
      .getByRole("navigation", { name: "Main navigation" })
      .getByRole("button", { name: "Preferences", exact: true })
      .click();
    const preferences = page.getByRole("region", {
      name: "Preferences",
      exact: true,
    });
    await preferences
      .getByRole("tablist", { name: "Preference pages", exact: true })
      .getByRole("tab", { name: "Git", exact: true })
      .click();
    const name = preferences.getByRole("textbox", {
      name: "Author name",
      exact: true,
    });
    const email = preferences.getByRole("textbox", {
      name: "Author email",
      exact: true,
    });
    const authorControls =
      /** @type {[import('playwright-core').Locator,string][]} */ ([
        [name, "git-author-name"],
        [email, "git-author-email"],
      ]);
    for (const [control, id] of authorControls) {
      assert.equal(await control.getAttribute("id"), id);
      assert.equal(
        await control.evaluate(
          (el) => /** @type {HTMLInputElement} */ (el).required,
        ),
        true,
      );
    }
    const originalName = await name.inputValue();
    const originalEmail = await email.inputValue();
    await name.fill("");
    assert.equal(
      await name.evaluate(
        (el) => /** @type {HTMLInputElement} */ (el).validity.valueMissing,
      ),
      true,
    );
    assert.equal(
      await preferences
        .getByRole("button", { name: "Save author", exact: true })
        .isDisabled(),
      true,
    );
    await name.fill(originalName);
    await email.fill("invalid-email");
    assert.equal(
      await email.evaluate(
        (el) => /** @type {HTMLInputElement} */ (el).validity.typeMismatch,
      ),
      true,
    );
    const invalidSave = await withIpcFailure(
      page,
      "save_workspace",
      false,
      async () => {
        await preferences
          .getByRole("button", { name: "Save author", exact: true })
          .click();
      },
    );
    assert.equal(
      invalidSave.calls,
      0,
      "Native browser validation must stop invalid author before persistence IPC",
    );
    assert.deepEqual(await invoke("load_workspace"), authorBaseline);
    await email.fill(originalEmail);
    await preferences
      .getByRole("button", { name: "Close Preferences", exact: true })
      .click();
    const captures = [];
    const dialogCases = /** @type {Array<Record<string,any>>} */ ([]);
    for (const theme of ["dark", "light"]) {
      if ((await page.locator("html").getAttribute("data-theme")) !== theme)
        await page
          .getByRole("button", { name: "Toggle theme", exact: true })
          .click();
      await page.waitForFunction(
        (t) => document.documentElement.dataset.theme === t,
        theme,
      );
      await page.evaluate(() => document.fonts.ready);
      await page
        .getByRole("complementary", { name: "Collections", exact: true })
        .getByRole("button", {
          name: "GET Preserved local request",
          exact: true,
        })
        .click();
      await page
        .getByRole("navigation", { name: "Main navigation" })
        .getByRole("button", { name: "Preferences", exact: true })
        .click();
      await preferences
        .getByRole("tab", { name: "Editor", exact: true })
        .click();
      const formBaseline = await invoke("load_workspace");
      for (const width of [1440, 900, 760]) {
        await page.setViewportSize({ width, height: 900 });
        formGeometry.push(
          await assertFormGeometry(page, ".settings-panel", [
            "input",
            "select",
            "checkbox",
            "stacked",
            "inline",
          ]),
        );
        focusSurfaces.push(
          await assertFocusSurface(
            page,
            ".settings-panel :is(input,select,button)",
          ),
        );
      }
      assert.deepEqual(
        await invoke("load_workspace"),
        formBaseline,
        "Geometry measurement must preserve all workspace data",
      );
      await preferences
        .getByRole("button", { name: "Close Preferences", exact: true })
        .click();
      const urlFocusBaseline = await invoke("load_workspace");
      for (const width of [1440, 900, 760]) {
        await page.setViewportSize({ width, height: 900 });
        focusSurfaces.push(
          await assertFocusSurface(
            page,
            ".request-url-fields :is(input,select), .send-button",
          ),
        );
        await page.locator(".request-url-fields .ui-input").focus();
        await page.screenshot({
          path: output + "/" + theme + "-url-focus-" + width + ".png",
        });
      }
      assert.deepEqual(
        await invoke("load_workspace"),
        urlFocusBaseline,
        "Focus measurement preserves full request/workspace state",
      );
      await page.setViewportSize({ width: 1440, height: 900 });
      assert.equal(
        await page.evaluate(() =>
          [...document.fonts].some(
            (f) => f.family === "Inter Variable" && f.status === "loaded",
          ),
        ),
        true,
      );
      await page.locator(".new-request-menu summary").click();
      await page
        .getByRole("button", { name: "HTTP Request", exact: true })
        .click();
      await page
        .getByLabel("Body type", { exact: true })
        .selectOption("application/graphql");
      await page.locator(".CodeMirror").first().waitFor();
      await assertPickerTypography(page);
      for (const width of [1440, 900, 760]) {
        await page.setViewportSize({ width, height: 900 });
        selectGeometry.push(await assertSelectGeometry(page));
      }
      await page.setViewportSize({ width: 1440, height: 900 });
      await assertCaptionTypography(page, [
        ".status-save",
        ".version",
        ".search-input kbd",
        ".graphql-editor-column",
      ]);
      await page
        .locator(".CodeMirror")
        .first()
        .evaluate((el) => {
          const editor = /** @type {any} */ (el).CodeMirror;
          editor.focus();
          editor.showHint({
            completeSingle: false,
            hint: () => ({
              list: ["query", "mutation"],
              from: editor.getCursor(),
              to: editor.getCursor(),
            }),
          });
        });
      await page.locator(".CodeMirror-hints").waitFor();
      assert.equal(
        await page
          .locator(".CodeMirror-hints")
          .evaluate((el) => getComputedStyle(el).backgroundColor),
        theme === "dark" ? "rgb(38, 38, 38)" : "rgb(243, 244, 246)",
      );
      await page.screenshot({
        path: output + "/" + theme + "-native-completion.png",
      });
      await page.keyboard.press("Escape");
      captures.push(theme + " native completion popup");
      for (const width of [1440, 900]) {
        await page.setViewportSize({ width, height: 900 });
        await page.getByRole("button", { name: "Git", exact: true }).click();
        const panel = page.getByRole("region", {
          name: "Source Control",
          exact: true,
        });
        await panel.getByRole("heading", { name: /^Changes/ }).waitFor();
        await assertCaptionTypography(page, [".git-panel .count"]);
        assert.equal(
          await panel.evaluate((el) => el.scrollWidth <= el.clientWidth),
          true,
          "Git panel overflow",
        );
        await page.screenshot({
          path: output + "/" + theme + "-git-" + width + ".png",
        });
        await panel
          .getByRole("button", { name: /^(Set up remote|Remote)$/ })
          .click();
        const dialog = page.getByRole("dialog");
        const remoteGeometry = await assertDialogTokens(dialog);
        dialogCases.push({ theme, kind: "remote", ...remoteGeometry });
        await dialog
          .getByRole("combobox", { name: /^Remote authentication/ })
          .selectOption("basic");
        await dialog
          .getByRole("textbox", { name: "Git username", exact: true })
          .scrollIntoViewIfNeeded();
        await page.screenshot({
          path: output + "/" + theme + "-git-remote-" + width + ".png",
        });
        await page.keyboard.press("Escape");
        await panel
          .getByRole("button", { name: /^View changes for / })
          .first()
          .click();
        await panel.locator(".ui-unified-diff .CodeMirror").waitFor();
        await page.screenshot({
          path: output + "/" + theme + "-git-diff-" + width + ".png",
        });
        await page
          .getByRole("button", { name: "Close Source Control", exact: true })
          .click();
        captures.push(theme + " Git/remote/diff " + width);
      }
      await page.setViewportSize({ width: 900, height: 900 });
      await page.getByRole("button", { name: "Cookies", exact: true }).click();
      const dialog = page.getByRole("dialog");
      const cookieFocusBaseline = await invoke("load_workspace");
      for (const width of [1440, 900, 760]) {
        await page.setViewportSize({ width, height: 900 });
        buttonPadding.push(
          await assertButtonPadding(
            page,
            "dialog.modal .resource-tools > button.ui-button, dialog.modal .modal-actions > button.ui-button",
            ".send-button, .icon-button",
          ),
        );
        formGeometry.push(
          await assertFormGeometry(page, "dialog.modal", [
            "input",
            "textarea",
            "stacked",
          ]),
        );
        focusSurfaces.push(
          await assertFocusSurface(
            page,
            "dialog.modal :is(input,textarea,button)",
          ),
        );
      }
      assert.deepEqual(
        await invoke("load_workspace"),
        cookieFocusBaseline,
        "Cookie focus measurement preserves all workspace data",
      );
      await page.setViewportSize({ width: 900, height: 900 });
      const cookieGeometry = await assertDialogTokens(dialog);
      dialogCases.push({ theme, kind: "cookie", ...cookieGeometry });
      await dialog
        .getByLabel("Cookie URL", { exact: true })
        .fill("https://theme.example.invalid/");
      await dialog
        .getByLabel("Set-Cookie value", { exact: true })
        .fill("theme_" + theme + "=sample; Path=/; Secure; HttpOnly");
      await dialog
        .getByRole("button", { name: "Add cookie", exact: true })
        .click();
      await dialog.getByText("Cookies saved.", { exact: true }).waitFor();
      await dialog
        .getByRole("button", { name: new RegExp("^theme_" + theme) })
        .click();
      assert.equal(
        await dialog
          .getByLabel("Set-Cookie value", { exact: true })
          .inputValue()
          .then((t) => t.includes("sample")),
        true,
      );
      await page.screenshot({
        path: output + "/" + theme + "-native-cookies.png",
      });
      assert.equal(
        await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth),
        true,
        "Cookie dialog overflow",
      );
      await dialog
        .getByRole("button", { name: "Clear all…", exact: true })
        .click();
      await page.screenshot({
        path: output + "/" + theme + "-cookie-confirm.png",
      });
      await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
      await page
        .getByRole("button", { name: "Close dialog", exact: true })
        .click();
      captures.push(theme + " cookie edit/confirm");
      await page.locator(".new-request-menu summary").click();
      await page
        .getByRole("button", { name: "gRPC Request", exact: true })
        .click();
      await page.getByRole("tab", { name: "Proto Files", exact: true }).click();
      if (theme === "dark") {
        await page.getByLabel("Import files", { exact: true }).setInputFiles({
          name: "theme.proto",
          mimeType: "text/plain",
          buffer: Buffer.from(
            'syntax = "proto3"; package theme; message Input { string name = 1; } service Sample { rpc Echo (Input) returns (Input); }',
          ),
        });
        await page
          .getByRole("button", { name: "Import 1 files", exact: true })
          .click();
      }
      await page
        .getByRole("button", { name: "theme.proto", exact: true })
        .click();
      await page
        .getByRole("textbox", { name: "Proto source", exact: true })
        .waitFor();
      await assertSurfaceHover(
        page,
        page.getByRole("button", { name: "theme.proto", exact: true }),
      );
      assert.equal(
        await page
          .getByRole("button", { name: "theme.proto", exact: true })
          .evaluate((el) => getComputedStyle(el).flexGrow),
        "1",
        "proto name fills the tree row",
      );
      await page.screenshot({
        path: output + "/" + theme + "-proto-source.png",
      });
      await page
        .getByRole("button", { name: "Remove theme.proto", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Keep files", exact: true })
        .waitFor();
      await page.screenshot({
        path: output + "/" + theme + "-proto-confirm.png",
      });
      await page
        .getByRole("button", { name: "Keep files", exact: true })
        .click();
      captures.push(theme + " proto source/confirm");
      await page.getByRole("button", { name: "Git", exact: true }).click();
      await page
        .getByRole("region", { name: "Source Control", exact: true })
        .getByRole("button", { name: "Branches", exact: true })
        .click();
      await page
        .getByRole("combobox", { name: /^Switch branch/ })
        .selectOption(recoveryBranch);
      const branchGeometry = await assertDialogTokens(
        page.getByRole("dialog", { name: "Branches", exact: true }),
      );
      dialogCases.push({ theme, kind: "branch", ...branchGeometry });
      const fault = await withIpcFailure(
        page,
        "git_repository_checkout",
        false,
        async () => {
          await page
            .getByRole("button", { name: "Switch branch", exact: true })
            .click();
          const recovery = page.getByRole("dialog", {
            name: "Recover checkout",
            exact: true,
          });
          await recovery.waitFor();
          const recoveryGeometry = await assertDialogTokens(recovery);
          dialogCases.push({ theme, kind: "recovery", ...recoveryGeometry });
          await page.keyboard.press("Escape");
          assert.equal(
            await recovery.isVisible(),
            true,
            "recovery cannot be dismissed by Escape",
          );
          assert.equal(
            await page.locator(".app-shell").getAttribute("inert"),
            "",
          );
          await page.screenshot({
            path: output + "/" + theme + "-checkout-recovery.png",
          });
        },
      );
      assert.equal(fault.calls, 1);
      assert.equal(fault.completed, 0);
      await page
        .getByRole("dialog", { name: "Recover checkout", exact: true })
        .getByRole("button", { name: "Retry recovery", exact: true })
        .click();
      await page
        .getByRole("dialog", { name: "Recover checkout", exact: true })
        .waitFor({ state: "detached" });
      // Source Control keeps its branch settings while the global recovery dialog owns focus.
      await page
        .getByRole("dialog", { name: "Branches", exact: true })
        .waitFor();
      await page.keyboard.press("Escape");
      await page.getByRole("dialog").waitFor({ state: "detached" });
      await page
        .getByRole("button", { name: "Collections", exact: true })
        .click();
      captures.push(theme + " checkout recovery");
      await poll(
        async () =>
          !(await invoke("load_workspace")).resources.every(
            (/** @type {any} */ r) => r._type !== "proto_file",
          ),
        "native proto persisted",
      );
    }
    const info = await invoke("git_repository_info", {
      repositoryId: fixture.repositoryId,
    });
    assert.equal(
      info.headOid,
      fixture.oid,
      "Theme inspection must not change Git HEAD",
    );
    await Bun.write(
      output + "/acceptance.json",
      JSON.stringify(
        {
          passed: true,
          captures,
          fonts: "loaded native",
          typography:
            "dense shell/GraphQL/Git captions and actual select picker token propagation/restoration in both themes",
          gitHeadUnchanged: true,
          dialogCases,
          dialogGeometry:
            "Default/override/restored radius, variant width, viewport gutter, height cap and shadow on mounted remote/cookie/branch/recovery dialogs in both themes; remote at1440/900.",
          selectGeometry,
          buttonPadding,
          formGeometry,
          focusSurfaces,
          authorFieldContext:
            "inherited IDs/required, empty-name refusal and malformed-email native validation before persistence IPC, exact full workspace preserved",
        },
        null,
        2,
      ),
    );
  },
);
