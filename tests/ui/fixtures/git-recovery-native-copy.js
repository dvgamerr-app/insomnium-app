import { mount } from "svelte";
import Fixture from "./git-recovery-native-copy.svelte";

mount(Fixture, {
  target: document.body,
  props: { seed: /** @type {any} */ (window).__recoveryNativeSeed },
});
