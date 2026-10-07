/** @param {import('playwright-core').Page} page */
export async function openGitBranches(page) {
  const panel = page.getByRole("region", {
    name: "Source Control",
    exact: true,
  });
  await panel
    .getByRole("button", { name: "Reload changes", exact: true })
    .waitFor();
  const branches = panel.getByRole("button", { name: "Branches", exact: true });
  const more = panel.getByRole("button", {
    name: "More Source Control actions",
    exact: true,
  });
  // The reload button mounts before repository loading exposes branch actions.
  await branches.or(more).first().waitFor();
  if (await branches.isVisible()) await branches.click();
  else await more.click();
  await page.getByRole("dialog", { name: "Branches", exact: true }).waitFor();
}

/** Open current Remote settings from the responsive Source Control toolbar.
 * @param {import('playwright-core').Page} page */
export async function openGitRemote(page) {
  const panel = page.getByRole("region", { name: "Source Control", exact: true });
  await panel.getByRole("button", { name: "Reload changes", exact: true }).waitFor();
  const remote = panel.getByRole("button", { name: /^(Set up remote|Remote)$/ });
  const more = panel.getByRole("button", { name: "More Source Control actions", exact: true });
  await remote.or(more).first().waitFor();
  if (!await remote.isVisible()) await more.click();
  await remote.click();
  await page.getByRole("region", { name: "Git remote", exact: true }).waitFor();
}
