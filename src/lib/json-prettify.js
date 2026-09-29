// Ported from Insomnium utils/prettify/json.ts (MIT); original formatter attribution: jsonlint.
const STATE_IN_NUN_VAR = "nunvar";
const STATE_IN_NUN_TAG = "nuntag";
const STATE_IN_NUN_COM = "nuncom";
const STATE_IN_STRING = "string";
const STATE_NONE = "none";
/** @type {Record<string, string | undefined>} */
const NUNJUCKS_OPEN_STATES = {
  "{{": STATE_IN_NUN_VAR,
  "{%": STATE_IN_NUN_TAG,
  "{#": STATE_IN_NUN_COM,
};
/** @type {Record<string, string | undefined>} */
const NUNJUCKS_CLOSE_STATES = {
  "}}": STATE_IN_NUN_VAR,
  "%}": STATE_IN_NUN_TAG,
  "#}": STATE_IN_NUN_COM,
};
/** Format tokens without parsing numeric values or evaluating templates.
 * @param {string | undefined} json
 */
export const jsonPrettify = (
  json,
  indentChars = "\t",
  replaceUnicode = true,
) => {
  if (!json) {
    return "";
  }
  if (json.length > 20 * 1024 * 1024)
    throw new Error("JSON formatting input exceeds 20 Mi characters");
  if (!/^[ \t]{0,16}$/.test(indentChars))
    throw new Error("Invalid JSON indentation");
  let i = 0;
  const il = json.length;
  const tab = indentChars;
  let newJson = "";
  let indentLevel = 0;
  let currentChar = null;
  let nextChar = null;
  let nextTwo = null;
  let state = STATE_NONE;
  for (; i < il; i += 1) {
    if (newJson.length > 20 * 1024 * 1024)
      throw new Error("Formatted JSON exceeds 20 Mi characters");
    currentChar = json.charAt(i);
    nextChar = json.charAt(i + 1) || "";
    nextTwo = currentChar + nextChar;
    if (state === STATE_IN_STRING) {
      if (currentChar === '"') {
        state = STATE_NONE;
        newJson += currentChar;
        continue;
      } else if (currentChar === "\\") {
        // Decode printable Unicode only inside strings. Preserve controls, escapes and surrogate code units.
        const escape = json.slice(i + 2, i + 6);
        const code = parseInt(escape, 16);
        if (
          replaceUnicode &&
          nextChar === "u" &&
          /^[0-9a-fA-F]{4}$/.test(escape) &&
          code >= 32 &&
          code !== 34 &&
          code !== 92 &&
          !(code >= 0xd800 && code <= 0xdfff)
        ) {
          newJson += String.fromCharCode(code);
          i += 5;
        } else {
          newJson += currentChar + nextChar;
          i++;
        }
        continue;
      } else {
        newJson += currentChar;
        continue;
      }
    }
    if (Object.values(NUNJUCKS_CLOSE_STATES).includes(state)) {
      const closeState = NUNJUCKS_CLOSE_STATES[nextTwo];
      if (closeState === state) {
        state = STATE_NONE;
        if (closeState === STATE_IN_NUN_COM) {
          newJson +=
            nextTwo +
            `
` +
            repeatString(tab, indentLevel);
        } else {
          newJson += nextTwo;
        }
        i++;
        continue;
      } else {
        newJson += currentChar;
        continue;
      }
    }
    const nextState = NUNJUCKS_OPEN_STATES[nextTwo];
    if (nextState) {
      state = nextState;
      newJson += nextTwo;
      i++;
      continue;
    }
    switch (currentChar) {
      case ",":
        newJson +=
          currentChar +
          `
` +
          repeatString(tab, indentLevel);
        continue;
      case "{":
        if (nextChar === "}") {
          newJson += currentChar + nextChar;
          i++;
        } else {
          indentLevel++;
          newJson +=
            currentChar +
            `
` +
            repeatString(tab, indentLevel);
        }
        continue;
      case "[":
        if (nextChar === "]") {
          newJson += currentChar + nextChar;
          i++;
        } else {
          indentLevel++;
          newJson +=
            currentChar +
            `
` +
            repeatString(tab, indentLevel);
        }
        continue;
      case "}":
        indentLevel--;
        newJson +=
          `
` +
          repeatString(tab, indentLevel) +
          currentChar;
        continue;
      case "]":
        indentLevel--;
        newJson +=
          `
` +
          repeatString(tab, indentLevel) +
          currentChar;
        continue;
      case ":":
        newJson += ": ";
        continue;
      case '"':
        state = STATE_IN_STRING;
        newJson += currentChar;
        continue;
      case " ":
      case `
`:
      case "\t":
      case "\r":
        continue;
      default:
        newJson += currentChar;
        continue;
    }
  }
  if (newJson.length > 20 * 1024 * 1024)
    throw new Error("Formatted JSON exceeds 20 Mi characters");
  return newJson.replace(/^\s*\n/gm, "");
};
/** @param {string} str @param {number} count */
const repeatString = (str, count) => {
  if (count < 0 || count > 256)
    throw new Error("JSON formatting nesting must be between 0 and 256");
  return str.repeat(count);
};
