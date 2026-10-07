import { mount } from "svelte";
import Fixture from "./git-recovery-native-copy.svelte";

// Keep the bootstrap app dormant while mounting the full production page with
// the fixture's own module instance. No production global is replaced.
const bootstrap = document.querySelector(".app-shell");
if (bootstrap instanceof HTMLElement) {
  bootstrap.inert = true;
  bootstrap.style.display = "none";
}
const target = document.createElement("div");
target.dataset.nativeRecoveryFixture = "";
document.body.append(target);
mount(Fixture, {
  target,
  props: { seed: /** @type {any} */ (window).__recoveryNativeSeed },
});
