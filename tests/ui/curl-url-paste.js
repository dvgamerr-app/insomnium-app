import assert from "node:assert/strict";
import { withPreview } from "./helpers/preview-app.js";

const BS = String.fromCharCode(92);
const NL = String.fromCharCode(10);
const bash = [
  "curl 'https://api.example.com/items?x=1' " + BS,
  "  -H 'Accept: */*' " + BS,
  `  --data-raw '{"a":1}'`,
].join(NL);
const cmd = [
  'curl ^"https://api.example.com/items?x=1^" ^',
  '  -H ^"Accept: */*^" ^',
  `  --data-raw ^"^{^${BS}^"a^${BS}^":1^}^"`,
].join(NL);
const powershell = [
  'curl.exe "https://api.example.com/items?x=1" `',
  '  -H "Accept: */*" `',
  `  -d "{${BS}"a${BS}":1}"`,
].join(NL);

await withPreview("curl-url-paste", async (page) => {
  const url = page.getByRole("textbox", { name: "Request URL", exact: true });
  const method = page.getByLabel("HTTP method", { exact: true });
  await url.waitFor();
  for (const [name, text] of [
    ["bash", bash],
    ["cmd", cmd],
    ["powershell", powershell],
  ]) {
    await url.fill("");
    // Real paste: the browser would otherwise strip newlines from the input.
    await url.evaluate((el, value) => {
      el.focus();
      const data = new DataTransfer();
      data.setData("text/plain", value);
      el.dispatchEvent(
        new ClipboardEvent("paste", {
          clipboardData: data,
          bubbles: true,
          cancelable: true,
        }),
      );
    }, text);
    await page.waitForTimeout(150);
    assert.equal(
      await url.inputValue(),
      "https://api.example.com/items?x=1",
      name,
    );
    assert.equal(await method.inputValue(), "POST", name);
  }
  // Typing/filling single-line text is parsed too.
  await url.fill("curl -X DELETE https://api.example.com/items/9");
  await page.waitForTimeout(150);
  assert.equal(await url.inputValue(), "https://api.example.com/items/9");
  assert.equal(await method.inputValue(), "DELETE");
});
