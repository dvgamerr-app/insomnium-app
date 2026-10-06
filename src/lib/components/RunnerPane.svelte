<script>
  import Feedback from "./ui/Feedback.svelte";
  import EmptyState from "./ui/EmptyState.svelte";
  import Field from "./ui/Field.svelte";
  import Input from "./ui/Input.svelte";
  import Button from "./ui/Button.svelte";
  import Select from "./ui/Select.svelte";
  import SplitPane from "./ui/SplitPane.svelte";
  import {
    workspace,
    update,
    remove,
    runTests,
    stop,
    addUnitTest,
  } from "../workspace.svelte.js";
  import { selectedRunnerSuite, latestRunnerResult } from "../runner-model.js";
  import { workspaceFor } from "../model.js";
  import CodeEditor from "./CodeEditor.svelte";
  import Icon from "./Icon.svelte";
  /** @type {{collectionId:string}} */ let { collectionId } = $props();
  const suite = $derived(
    selectedRunnerSuite(workspace.data.resources, collectionId),
  );
  const tests = $derived(
    workspace.data.resources.filter(
      (r) => r._type === "unit_test" && r.parentId === suite?._id,
    ),
  );
  const requests = $derived(
    workspace.data.resources.filter(
      (r) =>
        r._type === "request" &&
        workspaceFor(workspace.data.resources, r._id) === collectionId,
    ),
  );
  const running = $derived(!!suite && !!workspace.running[suite._id]);
  const saved = $derived(
    suite
      ? latestRunnerResult(workspace.data.resources, collectionId, suite._id)
      : null,
  );
  const results = $derived(saved?.results);
  let deleting = $state("");
  let lastSuite = "";
  $effect(() => {
    const current = suite?._id || "";
    if (current !== lastSuite) {
      lastSuite = current;
      deleting = "";
    }
  });
  const deleteTarget = $derived(
    workspace.data.resources.find((r) => r._id === deleting),
  );
  /** @param {string|null} [testId] */
  async function run(testId = null) {
    if (!suite) return;
    const suiteId = suite._id;
    try {
      await runTests(suiteId, testId);
    } catch (error) {
      workspace.runnerErrors[suiteId] = String(error);
    }
  }
  function confirmDelete() {
    if (deleting) {
      remove(deleting);
      deleting = "";
    }
  }
  /** @param {Record<string,any>} test */
  function status(test) {
    if (test.pending || test.state === "pending") return "Pending";
    if (test.state === "failed" || Object.keys(test.err || {}).length)
      return "Failed";
    if (test.state === "passed") return "Passed";
    return results?.pending?.some(
      (/** @type {any} */ item) => item.fullTitle === test.fullTitle,
    )
      ? "Pending"
      : "Passed";
  }
</script>

{#if suite}
  <section class="runner" aria-label="Collection tests">
    <header>
      <Input
        aria-label="Test suite name"
        value={suite.name}
        disabled={running}
        onchange={(event) =>
          update(suite._id, {
            name: event.currentTarget.value.trim() || "Untitled Suite",
          })}
      />
      <Button
        variant="secondary"
        class="secondary-button"
        disabled={running}
        onclick={() => addUnitTest(suite._id)}
        ><Icon name="plus" size={14} /> New Test</Button
      >
      {#if running}<Button
          variant="danger"
          class="danger-button"
          onclick={() => stop(suite._id)}
          ><Icon name="stop" size={14} /> Stop</Button
        >
      {:else}<Button
          variant="primary"
          class="primary-button"
          disabled={!tests.length}
          onclick={() => run()}><Icon name="play" size={14} /> Run Tests</Button
        >{/if}
      <Button
        variant="ghost"
        class="icon-button"
        aria-label="Delete test suite"
        title="Delete test suite"
        onclick={() => (deleting = suite._id)}
        ><Icon name="trash" size={15} /></Button
      >
    </header>
    {#if deleteTarget}
      <div class="delete-confirm" role="alert">
        <span
          >Delete “{deleteTarget.name}”{deleteTarget._type === "unit_test_suite"
            ? " and its tests"
            : ""}?</span
        >
        <Button
          variant="secondary"
          class="secondary-button"
          onclick={() => (deleting = "")}>Cancel</Button
        >
        <Button variant="danger" class="danger-button" onclick={confirmDelete}
          >Delete</Button
        >
      </div>
    {/if}
    {#if workspace.runnerErrors[suite._id]}<Feedback
        as="div"
        class="inline-error padded"
        role="alert"
      >
        {workspace.runnerErrors[suite._id]}
      </Feedback>{/if}
    <SplitPane
      class="runner-columns"
      storageKey="runner"
      label="Test editor and results size"
      stackAt={640}
      minFirst={180}
      minSecond={180}
    >
      {#snippet first()}
        <div class="test-list">
          {#each tests as test (test._id)}
            <article>
              <div class="test-toolbar">
                <Input
                  aria-label="Test name"
                  value={test.name}
                  disabled={running}
                  onchange={(event) =>
                    update(test._id, {
                      name: event.currentTarget.value.trim() || "Untitled Test",
                    })}
                />
                <Button
                  variant="ghost"
                  class="icon-button"
                  title="Run this test"
                  aria-label={"Run " + test.name}
                  disabled={running}
                  onclick={() => run(test._id)}
                  ><Icon name="play" size={14} /></Button
                >
                <Button
                  variant="ghost"
                  class="icon-button"
                  title="Delete test"
                  aria-label={"Delete " + test.name}
                  onclick={() => (deleting = test._id)}
                  ><Icon name="trash" size={14} /></Button
                >
              </div>
              <Field class="request-choice"
                >Request
                <Select
                  aria-label={"Request for " + test.name}
                  value={test.requestId || ""}
                  disabled={running}
                  onchange={(event) =>
                    update(test._id, {
                      requestId: event.currentTarget.value || null,
                    })}
                >
                  <option value="">No request selected</option>
                  {#if test.requestId && !requests.some((r) => r._id === test.requestId)}<option
                      value={test.requestId}
                      >Unavailable request ({test.requestId})</option
                    >{/if}
                  {#each requests as request (request._id)}<option
                      value={request._id}
                      >{request.method || "GET"} · {request.name}</option
                    >{/each}
                </Select>
              </Field>
              <div class="test-code">
                <CodeEditor
                  identity={"unit-test:" + test._id}
                  value={test.code || ""}
                  mode="text/javascript"
                  label={"Code for " + test.name}
                  settings={workspace.data.settings}
                  readOnly={running}
                  onchange={(code) => update(test._id, { code })}
                />
              </div>
            </article>
          {:else}<EmptyState variant="response" class="empty-response">
              <h2>No tests yet</h2>
              <p>Add a test and select a request to get started.</p>
              <Button
                variant="secondary"
                class="secondary-button"
                onclick={() => addUnitTest(suite._id)}>New Test</Button
              >
            </EmptyState>{/each}
        </div>
      {/snippet}{#snippet second()}
        <section
          class="test-results"
          aria-label="Test results"
          aria-busy={running}
        >
          <h2>
            {running
              ? "Running Tests…"
              : results
                ? "Test Results"
                : "No Results"}
          </h2>
          {#if saved}<p class="hint">
              {new Date(
                saved.created || saved.modified,
              ).toLocaleString()}{saved.unitTestId ? " · Single test run" : ""}
            </p>{/if}
          {#if results}
            <div class="result-counts">
              <span class="passed"
                >{results.stats?.passes ?? results.passes?.length ?? 0} passed</span
              ><span class="failed"
                >{results.stats?.failures ?? results.failures?.length ?? 0} failed</span
              ><span
                >{results.stats?.pending ?? results.pending?.length ?? 0} pending</span
              >
            </div>
            {#if running}<p class="hint">
                Showing the previous run while tests execute.
              </p>{/if}
            {#each results.tests || [] as result, index ((saved?._id || "result") + ":" + index)}
              <details class:failed={status(result) === "Failed"}>
                <summary
                  ><span>{status(result)}</span>
                  {result.title}<small>{result.duration ?? 0} ms</small
                  ></summary
                >
                <p class="hint">{result.fullTitle}</p>
                {#if Object.keys(result.err || {}).length}<pre>{result.err
                      .message || "Test failed"}</pre>
                  {#if "actual" in result.err || "expected" in result.err}<pre>Expected: {JSON.stringify(
                        result.err.expected,
                        null,
                        2,
                      )}{"\n"}Actual: {JSON.stringify(
                        result.err.actual,
                        null,
                        2,
                      )}</pre>{/if}
                  {#if result.err.stack}<pre class="hint">{result.err
                        .stack}</pre>{/if}
                {/if}
              </details>
            {/each}
          {:else}<p class="hint">
              Run a test suite to see assertion results here.
            </p>{/if}
        </section>
      {/snippet}</SplitPane
    >
  </section>
{:else}<EmptyState variant="response" class="empty-response">
    <h2>No test suite selected</h2>
    <p>Create a suite from the sidebar.</p>
  </EmptyState>{/if}

<style>
  .runner {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
    min-width: 0;
  }
  header,
  .test-toolbar,
  .delete-confirm {
    display: flex;
    align-items: center;
    gap: var(--space-8);
    padding: var(--space-10);
    border-bottom: 1px solid var(--line);
    flex-wrap: wrap;
  }
  header > :global(input),
  .test-toolbar > :global(input) {
    flex: 1;
    min-width: 100px;
  }
  .test-list,
  .test-results {
    flex: 1;
    overflow: auto;
    min-width: 0;
    min-height: 0;
  }
  .test-list {
    flex: 1;
  }
  article {
    border-bottom: 1px solid var(--line);
  }
  :global(.request-choice) {
    display: flex;
    align-items: center;
    gap: var(--space-10);
    padding: var(--space-10);
    color: var(--muted);
  }
  :global(.request-choice select) {
    flex: 1;
  }
  .test-code {
    height: 220px;
    display: flex;
    min-height: 150px;
    resize: vertical;
    overflow: auto;
  }
  .test-results {
    padding: var(--space-16);
  }
  h2 {
    font-size: var(--font-size-16);
    font-weight: 500;
    margin: 0 0 var(--space-12);
  }
  .result-counts {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-14);
    padding-bottom: var(--space-16);
  }
  .passed {
    color: var(--green);
  }
  .failed {
    color: var(--danger);
  }
  details {
    border-top: 1px solid var(--line);
    padding: var(--space-10) 0;
  }
  summary {
    cursor: pointer;
    overflow-wrap: anywhere;
  }
  summary span {
    margin-right: var(--space-8);
  }
  small {
    float: right;
    color: var(--muted);
  }
  pre {
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    font-size: var(--font-size-12);
  }
</style>
