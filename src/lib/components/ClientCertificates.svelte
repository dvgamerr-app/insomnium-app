<script>
  import Button from "./ui/Button.svelte";
  import Checkbox from "./ui/Checkbox.svelte";
  import Field from "./ui/Field.svelte";
  import Input from "./ui/Input.svelte";
  import Feedback from "./ui/Feedback.svelte";
  import { isTauri } from "@tauri-apps/api/core";
  import { open } from "@tauri-apps/plugin-dialog";
  import {
    workspace,
    addClientCertificate,
    addCaCertificate,
    editResource,
    remove,
  } from "../workspace.svelte.js";

  /** @type {{collectionId:string,collectionName:string}} */
  let { collectionId, collectionName } = $props();
  const native = isTauri();
  const fileFields = [
    {
      key: "cert",
      label: "Certificate file (PEM)",
      extensions: ["pem", "crt", "cer"],
      description: "",
    },
    {
      key: "key",
      label: "Private key file (PEM)",
      extensions: ["pem", "key"],
      description: "",
    },
    {
      key: "pfx",
      label: "Certificate file (PFX/P12)",
      extensions: ["pfx", "p12"],
      description: "PFX takes precedence over the PEM certificate file.",
    },
  ];
  let picking = $state(false);
  const caField = {
    key: "path",
    label: "CA certificate file (PEM)",
    extensions: ["pem", "crt", "cer"],
    description: "",
  };
  const caCertificates = $derived(
    workspace.data.resources.filter(
      (resource) =>
        resource._type === "ca_certificate" &&
        resource.parentId === collectionId,
    ),
  );
  let error = $state("");
  const certificates = $derived(
    workspace.data.resources.filter(
      (resource) =>
        resource._type === "client_certificate" &&
        resource.parentId === collectionId,
    ),
  );
  /** @param {Record<string,any>} resource @param {string} key @param {any} value */
  function change(resource, key, value) {
    editResource(resource._id, { [key]: value }, resource.parentId);
  }
  /** @param {Record<string,any>} certificate @param {typeof fileFields[number]} field */
  async function chooseFile(certificate, field) {
    if (picking || !native) return;
    const originalCollection = collectionId;
    const modified = certificate.modified;
    picking = true;
    error = "";
    try {
      const path = await open({
        directory: false,
        multiple: false,
        title: field.label,
        defaultPath: certificate[field.key] || undefined,
        filters: [{ name: field.label, extensions: field.extensions }],
      });
      const current = workspace.data.resources.find(
        (r) => r._id === certificate._id,
      );
      if (
        typeof path === "string" &&
        current &&
        current.modified === modified &&
        collectionId === originalCollection &&
        current.parentId === originalCollection
      ) {
        change(current, field.key, path);
      }
    } catch (cause) {
      error = String(cause);
    } finally {
      picking = false;
    }
  }
</script>

<section class="settings-section" aria-label="Collection CA certificate">
  <h3>CA certificate for {collectionName}</h3>
  <p class="hint">
    An enabled PEM file supplies the trusted certificates for this collection.
    File paths stay on this device and are excluded from Git sync.
  </p>
  <Button
    disabled={caCertificates.length > 0}
    onclick={() => addCaCertificate(collectionId)}>Add CA certificate</Button
  >
  {#if caCertificates.length > 1}<p class="hint">
      The first entry controls this collection. Remove duplicate entries to use
      a different one.
    </p>{/if}
  {#each caCertificates as certificate (certificate._id)}
    <Field label={caField.label}>
      <div class="certificate-file">
        <Input
          value={certificate.path || ""}
          onchange={(event) =>
            change(certificate, "path", event.currentTarget.value || null)}
        />
        <Button
          disabled={!native || picking}
          aria-label={`Choose ${caField.label}`}
          onclick={() => chooseFile(certificate, caField)}>Browse</Button
        >
      </div>
    </Field>
    <Field layout="inline" label="Enable CA certificate"
      ><Checkbox
        checked={!certificate.disabled}
        onchange={(event) =>
          change(certificate, "disabled", !event.currentTarget.checked)}
      /></Field
    >
    <Field layout="inline" label="Private CA certificate"
      ><Checkbox
        checked={!!certificate.isPrivate}
        onchange={(event) =>
          change(certificate, "isPrivate", event.currentTarget.checked)}
      /></Field
    >
    <Button onclick={() => remove(certificate._id)}
      >Remove CA certificate</Button
    >
  {/each}
  {#if error}<Feedback as="p" role="alert">{error}</Feedback>{/if}
</section>

<section class="settings-section" aria-label="Collection client certificates">
  <h3>Client certificates for {collectionName}</h3>
  <p class="hint">
    Matching enabled entries apply to this collection. File paths are local to
    this device. These certificates are excluded from Git sync.
  </p>
  <Button onclick={() => addClientCertificate(collectionId)}
    >Add client certificate</Button
  >
  {#if error}<Feedback as="p" role="alert">{error}</Feedback>{/if}
  {#each certificates as certificate (certificate._id)}
    <section
      class="settings-section"
      aria-label={`Client certificate ${certificate.host || "new"}`}
    >
      <Field
        label="Host and port"
        description="Use a hostname with an optional port. Wildcards such as *.example.com or localhost:* are supported."
      >
        <Input
          value={certificate.host || ""}
          placeholder="api.example.com:443"
          onchange={(event) =>
            change(certificate, "host", event.currentTarget.value)}
        />
      </Field>
      <Field layout="inline" label="Enabled">
        <Checkbox
          checked={!certificate.disabled}
          onchange={(event) =>
            change(certificate, "disabled", !event.currentTarget.checked)}
        />
      </Field>
      {#each fileFields as field (field.key)}
        <Field label={field.label} description={field.description}>
          <div class="certificate-file">
            <Input
              value={certificate[field.key] || ""}
              onchange={(event) =>
                change(
                  certificate,
                  field.key,
                  event.currentTarget.value || null,
                )}
            />
            <Button
              disabled={!native || picking}
              aria-label={`Choose ${field.label}`}
              onclick={() => chooseFile(certificate, field)}>Browse</Button
            >
          </div>
        </Field>
      {/each}
      <Field label="Certificate passphrase">
        <Input
          type="password"
          autocomplete="off"
          value={certificate.passphrase || ""}
          onchange={(event) =>
            change(
              certificate,
              "passphrase",
              event.currentTarget.value || null,
            )}
        />
      </Field>
      <Field layout="inline" label="Private">
        <Checkbox
          checked={!!certificate.isPrivate}
          onchange={(event) =>
            change(certificate, "isPrivate", event.currentTarget.checked)}
        />
      </Field>
      <Button onclick={() => remove(certificate._id)}
        >Remove client certificate</Button
      >
    </section>
  {/each}
</section>

<style>
  .certificate-file {
    display: flex;
    gap: var(--space-8);
    min-width: 0;
  }
  .certificate-file :global(.ui-input) {
    flex: 1;
    min-width: 0;
  }
</style>
