export const limits = Object.freeze({
  wire: 48 * 1024 * 1024,
  sourceJson: 24 * 1024 * 1024,
  source: 2 * 1024 * 1024,
  references: 8 * 1024 * 1024,
  files: 32,
  result: 8 * 1024 * 1024,
  output: 16 * 1024 * 1024,
});

export function fail(code, message = code) {
  const error = new Error(message);
  error.code = code;
  throw error;
}

export function exactObject(value, keys) {
  if (!value || typeof value !== "object" || Array.isArray(value) ||
      Object.keys(value).sort().join(",") !== [...keys].sort().join(",")) fail("protocol");
}

/** Bounded accumulation before decoding; one frame and EOF, never a JSON log. */
export async function readRequest(stream) {
  const chunks = [];
  let size = 0;
  for await (const chunk of stream) {
    size += chunk.byteLength;
    if (size > limits.wire) fail("input_limit");
    chunks.push(chunk);
  }
  const bytes = Buffer.concat(chunks, size);
  let text;
  try { text = new TextDecoder("utf-8", { fatal: true }).decode(bytes); }
  catch { fail("protocol"); }
  if (!text.endsWith("\n") || text.slice(0, -1).includes("\n")) fail("protocol");
  let frame;
  try { frame = JSON.parse(text); } catch { fail("protocol"); }
  exactObject(frame, ["protocol", "jobId", "sourceJson", "repositoryRoot", "rulesetPath"]);
  if (frame.protocol !== 1 || typeof frame.jobId !== "string" ||
      !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(frame.jobId) ||
      typeof frame.sourceJson !== "string") fail("protocol");
  if (Buffer.byteLength(frame.sourceJson) > limits.sourceJson) fail("input_limit");
  if (frame.repositoryRoot !== null && typeof frame.repositoryRoot !== "string") fail("binding");
  if (frame.rulesetPath !== null && typeof frame.rulesetPath !== "string") fail("binding");
  if ((frame.repositoryRoot === null) !== (frame.rulesetPath === null)) fail("binding");
  return frame;
}

export function readSource(sourceJson) {
  let source;
  try { source = JSON.parse(sourceJson); } catch { fail("protocol"); }
  exactObject(source, ["fileName", "contents", "files"]);
  if (typeof source.fileName !== "string" || !source.fileName || source.fileName.length > 4096 ||
      typeof source.contents !== "string" || !Array.isArray(source.files)) fail("protocol");
  if (Buffer.byteLength(source.contents) > limits.source || source.files.length > limits.files ||
      Buffer.byteLength(JSON.stringify(source.files)) > limits.references) fail("input_limit");
  for (const file of source.files) {
    exactObject(file, ["name", "contents"]);
    if (typeof file.name !== "string" || !file.name || file.name.length > 4096 ||
        typeof file.contents !== "string") fail("protocol");
    if (Buffer.byteLength(file.contents) > limits.source) fail("input_limit");
  }
  return source;
}

export function response(frame, result) {
  const resultJson = JSON.stringify(result);
  if (Buffer.byteLength(resultJson) > limits.result) fail("output_limit");
  const line = JSON.stringify({ protocol: 1, jobId: frame.jobId, resultJson }) + "\n";
  if (Buffer.byteLength(line) > limits.output) fail("output_limit");
  return line;
}
