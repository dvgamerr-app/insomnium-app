import { createPluginTagMetadata } from "./plugin-tag-metadata.js";
// Authoring metadata from the preserved Insomnium definitions; rendering and
// action implementations remain separate. No legacy run/action code is copied.
/** @type {Record<string,any>[]} */
const recipes = [
  {
    name: "base64",
    displayName: "Base64",
    description: "encode or decode values",
    args: [
      {
        displayName: "Action",
        type: "enum",
        options: [
          { displayName: "Encode", value: "encode" },
          { displayName: "Decode", value: "decode" },
        ],
      },
      {
        displayName: "Kind",
        type: "enum",
        options: [
          { displayName: "Normal", value: "normal" },
          { displayName: "URL", value: "url" },
        ],
      },
      {
        displayName: "Value",
        type: "string",
        placeholder: "My text",
      },
    ],
  },
  {
    name: "now",
    displayName: "Timestamp",
    description: "get the current time",
    args: [
      {
        displayName: "Timestamp Format",
        type: "enum",
        options: [
          { displayName: "ISO-8601", value: "iso-8601" },
          { displayName: "Milliseconds", value: "millis" },
          { displayName: "Unix", value: "unix" },
          { displayName: "Custom Format", value: "custom" },
        ],
      },
      {
        help: "date-fns format string",
        displayName: "Custom Format Template",
        type: "string",
        placeholder: "MMMM Do YYYY, h:mm:ss a",
        hide: (/** @type {any[]} */ args) => args[0].value !== "custom",
      },
    ],
  },
  {
    displayName: "UUID",
    name: "uuid",
    description: "generate v1 or v4 UUIDs",
    args: [
      {
        displayName: "Version",
        type: "enum",
        options: [
          { displayName: "Version 4", value: "v4" },
          { displayName: "Version 1", value: "v1" },
        ],
      },
    ],
  },
  {
    displayName: "OS",
    name: "os",
    description: "get OS info",
    args: [
      {
        displayName: "Function",
        type: "enum",
        options: [
          { displayName: "arch", value: "arch" },
          { displayName: "cpus", value: "cpus" },
          { displayName: "freemem", value: "freemem" },
          { displayName: "hostname", value: "hostname" },
          { displayName: "platform", value: "platform" },
          { displayName: "release", value: "release" },
          { displayName: "userInfo", value: "userInfo" },
        ],
      },
      {
        displayName: "JSONPath Filter",
        help: "Some OS functions return objects. Use JSONPath queries to extract desired values.",
        hide: (/** @type {any[]} */ args) =>
          !["userInfo", "cpus"].includes(args[0].value + ""),
        type: "string",
      },
    ],
  },
  {
    name: "hash",
    displayName: "Hash",
    description: "apply hash to a value",
    args: [
      {
        displayName: "Algorithm",
        type: "enum",
        options: [
          { displayName: "MD5", value: "md5" },
          { displayName: "SHA1", value: "sha1" },
          { displayName: "SHA256", value: "sha256" },
          { displayName: "SHA512", value: "sha512" },
        ],
      },
      {
        displayName: "Digest Encoding",
        description: "The encoding of the output",
        type: "enum",
        options: [
          { displayName: "Hexadecimal", value: "hex" },
          { displayName: "Base64", value: "base64" },
        ],
      },
      {
        displayName: "Input",
        type: "string",
        placeholder: "Value to hash",
      },
    ],
  },
  {
    name: "file",
    displayName: "File",
    description: "read contents from a file",
    args: [
      {
        displayName: "Choose File",
        type: "file",
      },
    ],
  },
  {
    displayName: "JSONPath",
    name: "jsonpath",
    description: "pull data from JSON strings with JSONPath",
    args: [
      {
        displayName: "JSON string",
        type: "string",
      },
      {
        displayName: "JSONPath Filter",
        encoding: "base64",
        type: "string",
      },
    ],
  },
  {
    name: "cookie",
    displayName: "Cookie",
    description: "reference a cookie value from the cookie jar",
    args: [
      {
        type: "string",
        displayName: "Cookie Url",
        description: "fully qualified URL (e.g. https://domain.tld/path)",
      },
      {
        type: "string",
        displayName: "Cookie Name",
      },
    ],
  },
  {
    displayName: "Prompt",
    name: "prompt",
    description: "prompt user for input",
    disablePreview: (/** @type {any[]} */ args) =>
      Boolean(args[4]) && args[4].value === true,
    args: [
      {
        displayName: "Title",
        type: "string",
        help: "Title is a unique string used to identify the prompt value",
        validate: (/** @type {string} */ v) => (v ? "" : "Required"),
      },
      {
        displayName: "Label",
        type: "string",
      },
      {
        displayName: "Default Value",
        type: "string",
        help:
          "This value is used to pre-populate the prompt dialog, but is ALSO used " +
          "when the app renders preview values (like the one below). This is to prevent the " +
          "prompt from displaying too frequently during general app use.",
      },
      {
        displayName: "Storage Key",
        type: "string",
        help:
          "If this is set, the value will be stored in memory under this key until the app is " +
          "closed. To force this tag to re-prompt the user, simply change this key's value to " +
          "something else.",
      },
      {
        displayName: "Mask Text",
        type: "boolean",
        help: "If this is enabled, the value when input will be masked like a password field.",
        defaultValue: false,
      },
      {
        displayName: "Default to Last Value",
        type: "boolean",
        help:
          "If this is enabled, the input field will be pre-filled with this value. This option is " +
          "ignored when the storage key is set.",
        defaultValue: true,
      },
    ],
    actions: [{ name: "Clear", icon: "fa fa-trash" }],
  },
  {
    name: "response",
    displayName: "Response",
    description: "reference values from other request's responses",
    args: [
      {
        displayName: "Attribute",
        type: "enum",
        options: [
          {
            displayName: "Body Attribute",
            description: "value of response body",
            value: "body",
          },
          {
            displayName: "Raw Body",
            description: "entire response body",
            value: "raw",
          },
          {
            displayName: "Header",
            description: "value of response header",
            value: "header",
          },
          {
            displayName: "Request URL",
            description: "Url of initiating request",
            value: "url",
          },
        ],
      },
      {
        displayName: "Request",
        type: "model",
        model: "Request",
      },
      {
        type: "string",
        encoding: "base64",
        hide: (/** @type {any[]} */ args) =>
          !(args[0].value !== "raw" && args[0].value !== "url"),
        displayName: (/** @type {any[]} */ args) => {
          switch (args[0].value) {
            case "body":
              return "Filter (JSONPath or XPath)";
            case "header":
              return "Header Name";
            default:
              return "Filter";
          }
        },
      },
      {
        displayName: "Trigger Behavior",
        help: "Configure when to resend the dependent request",
        type: "enum",
        defaultValue: "never",
        options: [
          {
            displayName: "Never",
            description: "never resend request",
            value: "never",
          },
          {
            displayName: "No History",
            description: "resend when no responses present",
            value: "no-history",
          },
          {
            displayName: "When Expired",
            description: "resend when existing response has expired",
            value: "when-expired",
          },
          {
            displayName: "Always",
            description: "resend request when needed",
            value: "always",
          },
        ],
      },
      {
        displayName: "Max age (seconds)",
        help: "The maximum age of a response to use before it expires",
        type: "number",
        hide: (/** @type {any[]} */ args) => {
          const triggerBehavior = (args[3] && args[3].value) || "never";
          return triggerBehavior !== "when-expired";
        },
        defaultValue: 60,
      },
    ],
  },
  {
    name: "request",
    displayName: "Request",
    description: "reference value from current request",
    args: [
      {
        displayName: "Attribute",
        type: "enum",
        options: [
          {
            displayName: "Name",
            value: "name",
            description: "name of request",
          },
          {
            displayName: "Folder",
            value: "folder",
            description: "name of parent folder (or workspace)",
          },
          {
            displayName: "URL",
            value: "url",
            description: "fully qualified URL",
          },
          {
            displayName: "Query Parameter",
            value: "parameter",
            description: "query parameter by name",
          },
          {
            displayName: "Header",
            value: "header",
            description: "header value by name",
          },
          {
            displayName: "Cookie",
            value: "cookie",
            description: "cookie value by name",
          },
          {
            displayName: "OAuth 2.0 Access Token",
            value: "oauth2",
          },
          {
            displayName: "OAuth 2.0 Identity Token",
            value: "oauth2-identity",
          },
          {
            displayName: "OAuth 2.0 Refresh Token",
            value: "oauth2-refresh",
          },
        ],
      },
      {
        type: "string",
        hide: (/** @type {any[]} */ args) =>
          [
            "url",
            "oauth2",
            "oauth2-identity",
            "oauth2-refresh",
            "name",
            "folder",
          ].includes(args[0].value + ""),
        displayName: (/** @type {any[]} */ args) => {
          switch (args[0].value) {
            case "cookie":
              return "Cookie Name";
            case "parameter":
              return "Query Parameter Name";
            case "header":
              return "Header Name";
            default:
              return "Name";
          }
        },
      },
      {
        hide: (/** @type {any[]} */ args) => args[0].value !== "folder",
        displayName: "Parent Index",
        help: "Specify an index (Starting at 0) for how high up the folder tree to look",
        type: "number",
      },
    ],
  },
];

const metadata = createPluginTagMetadata();
/** @type {Record<string,any>[]} */
const tags = recipes.map((recipe) => ({
  ...recipe,
  run: () => "",
  actions: recipe.actions?.map(
    (
      /** @type {Record<string,any>} */ action,
      /** @type {number} */ index,
    ) => ({ ...action, index, run: () => {} }),
  ),
}));
/** @returns {Record<string,any>[]} */
export function builtinTagDefinitions() {
  return tags.map((tag) => ({ ...metadata.inspect(tag), plugin: "Built-in" }));
}
/** @param {string} name @param {any[]} args @param {string[]} validationValues @returns {Record<string,any>} */
export function resolveBuiltinTag(name, args, validationValues) {
  const tag = tags.find((tag) => tag.name === name);
  if (!tag) throw Error("Unknown built-in tag");
  return {
    ...metadata.resolve(tag, args, validationValues),
    plugin: "Built-in",
  };
}
