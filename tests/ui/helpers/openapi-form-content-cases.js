/** Content-mode wire goldens; no expected value is produced by the serializer. */
export const openApiFormContentCases =
  /** @type {Array<Record<string,any>>} */ ([
    ...[
      { id: "text-media-case", contentType: "Text/Plain" },
      { id: "text-media-charset", contentType: 'TEXT/PLAIN; CHARSET="uTf-8"' },
      { id: "text-media-quoted", contentType: 'text/plain; note="a,b;c"' },
    ].map((entry) => ({
      ...entry,
      content: true,
      schema: { type: "string" },
      value: "a +",
      expected: "color=a+%2B",
    })),
    {
      id: "text-media-array",
      content: true,
      contentType: 'Text/Plain; charset="UTF-8"',
      schema: { type: "array", items: {} },
      value: ["a +", "ไทย/🌙", 0, false],
      expected:
        "color=a+%2B&color=%E0%B9%84%E0%B8%97%E0%B8%A2%2F%F0%9F%8C%99&color=0&color=false",
      editText: '[9007199254740993,1e+2,"\\u0061"]',
      editExpected: "color=9007199254740993&color=1e%2B2&color=a",
    },
    {
      id: "text-media-empty-array",
      content: true,
      contentType: "Text/Plain; charset=UTF-8",
      schema: { type: "array", items: {} },
      value: [],
      expected: "",
    },
    ...[
      {
        id: "text-media-non-utf8",
        contentType: "text/plain; charset=ISO-8859-1",
      },
      { id: "text-media-malformed", contentType: "text/plain; charset=" },
      { id: "text-media-list", contentType: "text/plain, application/json" },
      {
        id: "text-media-duplicate",
        contentType: "text/plain; charset=UTF-8; charset=UTF-8",
      },
    ].map((entry) => ({
      ...entry,
      content: true,
      schema: { type: "string" },
      value: "a +",
      expected: null,
      refusal: "Review form serialization for color",
    })),
    {
      id: "text-media-object",
      content: true,
      contentType: "Text/Plain; charset=UTF-8",
      schema: { type: "object" },
      value: { x: "a +" },
      expected: null,
      refusal: "Review form serialization for color",
    },
    ...[
      { id: "json-media-case", contentType: "Application/JSON" },
      {
        id: "json-media-charset",
        contentType: 'application/json; charset="UTF-8"',
      },
      {
        id: "json-media-quoted",
        contentType: 'application/json; note="a,b;c"',
      },
    ].map((entry) => ({
      ...entry,
      content: true,
      schema: { type: "string" },
      value: "a +",
      expected: "color=%22a+%2B%22",
    })),
    ...[
      { id: "json-media-malformed", contentType: "application/json; charset=" },
      { id: "json-media-list", contentType: "application/json, text/plain" },
    ].map((entry) => ({
      ...entry,
      content: true,
      schema: { type: "string" },
      value: "a +",
      expected: null,
      refusal: "Review form serialization for color",
    })),
    {
      id: "default-nested-object",
      content: true,
      schema: { type: "object" },
      value: { nested: { zip: "99999+1234" } },
      expected:
        "color=%7B%22nested%22%3A%7B%22zip%22%3A%2299999%2B1234%22%7D%7D",
    },
    {
      id: "json-string",
      content: true,
      contentType: "application/json",
      schema: { type: "string" },
      value: "a +",
      expected: "color=%22a+%2B%22",
    },
    {
      id: "default-text-array",
      content: true,
      schema: { type: "array", items: { type: "string" } },
      value: ["a +", "b&="],
      expected: "color=a+%2B&color=b%26%3D",
    },
    {
      id: "default-object-array",
      content: true,
      schema: { type: "array", items: { type: "object" } },
      value: [{ x: "a b" }, { x: "+" }],
      expected:
        "color=%7B%22x%22%3A%22a+b%22%7D&color=%7B%22x%22%3A%22%2B%22%7D",
    },
    {
      id: "json-mixed-array",
      content: true,
      contentType: "application/json",
      schema: { type: "array", items: {} },
      value: [0, false, "", null],
      expected: "color=0&color=false&color=%22%22&color=null",
    },
    {
      id: "default-nested-array",
      content: true,
      schema: {
        type: "array",
        items: { type: "array", items: { type: "number" } },
      },
      value: [[1, 2], []],
      expected: "color=%5B1%2C2%5D&color=%5B%5D",
    },
    {
      id: "default-text-string",
      content: true,
      schema: { type: "string" },
      value: "a +",
      expected: "color=a+%2B",
    },
    {
      id: "json-null",
      content: true,
      contentType: "application/json",
      schema: { type: ["string", "null"] },
      value: null,
      expected: "color=null",
    },
    {
      id: "json-empty-array",
      content: true,
      contentType: "application/json",
      schema: { type: "array", items: {} },
      value: [],
      expected: "",
    },
    {
      id: "json-unrestricted",
      content: true,
      contentType: "application/json",
      schema: {},
      value: { a: [1, { x: 'comma, quote"' }] },
      expected:
        "color=%7B%22a%22%3A%5B1%2C%7B%22x%22%3A%22comma%2C+quote%5C%22%22%7D%5D%7D",
    },
  ]);
