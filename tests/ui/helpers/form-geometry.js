import assert from "node:assert/strict";

/** Actual mounted form geometry; temporary root overrides always restore value/priority.
 * @param {import('playwright-core').Page} page
 * @param {string} [scope]
 * @param {string[]} [required] */
export async function assertFormGeometry(
  page,
  scope = "body",
  required = [
    "input",
    "textarea",
    "select",
    "checkbox",
    "stacked",
    "inline",
    "file",
    "fileInline",
  ],
) {
  const result = await page.evaluate((scope) => {
    const root = document.documentElement;
    const overrides = {
      "--control-padding-block": "6px",
      "--control-padding-inline": "17px",
      "--control-line-height": "1.65",
      "--checkbox-size": "17px",
      "--field-gap": "11px",
      "--field-inline-gap": "14px",
      "--file-control-padding": "6px 15px",
      "--file-control-max-width": "150px",
    };
    const prior = Object.keys(overrides).map((key) => ({
      key,
      value: root.style.getPropertyValue(key),
      priority: root.style.getPropertyPriority(key),
    }));
    const selectors = {
      input: '.ui-input[data-ui-variant="default"]',
      textarea: ".ui-textarea",
      select: '.ui-select[data-ui-variant="default"]',
      checkbox: ".ui-checkbox",
      stacked: ".ui-field-stacked",
      inline: ".ui-field-inline",
      file: ".ui-file-picker-inline input, .ui-file-picker-dropzone input",
      fileInline: ".ui-file-picker-inline input",
      fixed:
        '.ui-input:not([data-ui-variant="default"]), .ui-select[data-ui-variant="method"], .ui-select[data-ui-variant="protocol"], .ui-file-picker-compact',
    };
    const elements = Object.fromEntries(
      Object.entries(selectors).map(([kind, selector]) => [
        kind,
        [...document.querySelectorAll(scope)]
          .flatMap((parent) => [...parent.querySelectorAll(selector)])
          .filter(
            (el) =>
              el.getBoundingClientRect().width > 0 &&
              el.getBoundingClientRect().height > 0,
          ),
      ]),
    );
    const measure = () =>
      Object.fromEntries(
        Object.entries(elements).map(([kind, elements]) => [
          kind,
          elements.map((el) => {
            const s = getComputedStyle(el);
            return {
              name: el.getAttribute("aria-label") || el.id || el.tagName,
              padding: [
                s.paddingTop,
                s.paddingRight,
                s.paddingBottom,
                s.paddingLeft,
              ],
              lineHeight: parseFloat(s.lineHeight) / parseFloat(s.fontSize),
              width: s.width,
              height: s.height,
              maxWidth: s.maxWidth,
              gap: s.gap,
            };
          }),
        ]),
      );
    const before = measure();
    let changed;
    try {
      for (const [key, value] of Object.entries(overrides))
        root.style.setProperty(key, value);
      changed = measure();
    } finally {
      for (const { key, value, priority } of prior) {
        if (value) root.style.setProperty(key, value, priority);
        else root.style.removeProperty(key);
      }
    }
    return {
      theme: root.dataset.theme,
      width: innerWidth,
      scope,
      before,
      changed,
      restored: measure(),
    };
  }, scope);
  for (const kind of required)
    assert.ok(result.before[kind]?.length, kind + " must be mounted");
  const profiles =
    /** @type {Array<['before'|'changed',string,string,number,string,string,string,string,string]>} */ ([
      ["before", "8px", "11px", 1.4, "13px", "7px", "10px", "10px", "130px"],
      ["changed", "6px", "17px", 1.65, "17px", "11px", "14px", "15px", "150px"],
    ]);
  for (const [
    state,
    block,
    inline,
    lineHeight,
    size,
    gap,
    inlineGap,
    fileInline,
    maxWidth,
  ] of profiles) {
    const values = result[state];
    for (const kind of ["input", "textarea", "select"])
      for (const el of values[kind]) {
        const end = kind === "select" ? "28px" : inline;
        assert.deepEqual(
          el.padding,
          [block, end, block, inline],
          el.name + " " + state + " padding",
        );
        assert.ok(
          Math.abs(el.lineHeight - lineHeight) < 0.01,
          el.name + " " + state + " line-height",
        );
      }
    for (const el of values.checkbox)
      assert.deepEqual(
        [el.width, el.height],
        [size, size],
        el.name + " " + state + " checkbox",
      );
    for (const el of values.stacked)
      assert.equal(el.gap, gap, el.name + " " + state + " field gap");
    for (const el of values.inline)
      assert.equal(
        el.gap,
        inlineGap,
        el.name + " " + state + " inline field gap",
      );
    for (const el of values.file)
      assert.deepEqual(
        el.padding,
        [block, fileInline, block, fileInline],
        el.name + " " + state + " file padding",
      );
    for (const el of values.fileInline)
      assert.equal(
        el.maxWidth,
        maxWidth,
        el.name + " " + state + " file width",
      );
  }
  assert.deepEqual(
    result.changed.fixed.map((el) => el.padding),
    result.before.fixed.map((el) => el.padding),
    "Explicit compact/variant padding stays with its owner",
  );
  assert.deepEqual(
    result.restored,
    result.before,
    "Every prior token value and priority restored",
  );
  return result;
}
