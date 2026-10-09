// Literal wire oracle, independent of the application query serializer.
const text = {
  style: "content",
  kind: "scalar-json",
  nullable: true,
  mediaType: 'Text/Plain; charset="UTF-8"',
};

export function queryOrderParameters() {
  return [
    { name: "color", value: "first +" },
    {
      name: "color",
      value: '"a + ไทย/🌙"',
      _openapiSerialization: { ...text },
    },
    { name: "color", value: "middle +" },
    { name: "count", value: "false", _openapiSerialization: { ...text } },
    { name: "empty", value: '""', _openapiSerialization: { ...text } },
    {
      name: "color",
      value: '["a +","b&="]',
      _openapiSerialization: { style: "form", kind: "array", explode: true },
    },
    {
      name: "object",
      value: '{"v":"a +"}',
      _openapiSerialization: {
        style: "content",
        kind: "object",
        mediaType: "application/json",
      },
    },
    { name: "omitted", value: "null", _openapiSerialization: { ...text } },
    {
      name: "ignored",
      value: '"skip"',
      disabled: true,
      _openapiSerialization: { ...text },
    },
    { name: "color", value: "last +" },
    { name: "bare", value: "", noValue: true },
    { name: "", value: "named +", sendEmptyName: true },
    { name: "disabled", value: "skip", disabled: true },
  ];
}

/** @param {boolean} encoding @param {boolean} curl @param {boolean} [apiKey] */
export function queryOrderTarget(encoding, curl, apiKey = false) {
  const standard = curl && !encoding;
  const space = standard ? "+" : "%20";
  return (
    (encoding ? "/100%25/a%20b?empty&x=%2F" : "/100%/a%20b?empty=&x=%2f") +
    "&color=first" +
    space +
    "%2B" +
    "&color=a%20%2B%20%E0%B9%84%E0%B8%97%E0%B8%A2%2F%F0%9F%8C%99" +
    "&color=middle" +
    space +
    "%2B&count=false&empty=" +
    "&color=a%20%2B&color=b%26%3D&object=%7B%22v%22%3A%22a%20%2B%22%7D" +
    "&color=last" +
    space +
    "%2B&bare&=named" +
    space +
    "%2B" +
    (apiKey ? "&key=a%2Bb" : "")
  );
}
