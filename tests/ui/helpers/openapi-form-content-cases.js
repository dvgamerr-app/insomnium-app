/** Content-mode wire goldens; no expected value is produced by the serializer. */
export const openApiFormContentCases =
  /** @type {Array<Record<string,any>>} */ ([
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
