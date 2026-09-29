# Project instructions

- Read `docs/migration/STATUS.md`, `PLAN.md`, and `PARITY.md` before continuing migration. Update STATUS after each completed milestone, failure, or changed decision.
- Use Bun for all JavaScript tooling and scripts. Never execute Node, npm, npx, pnpm, yarn, Python, or pip. Use `bun x --bun` for JavaScript CLIs. Rust/Cargo is the native Tauri backend.
- Frontend: Svelte with JavaScript, no TypeScript application files and no TypeScript 7.
- Consult official documentation before implementing or initializing a subsystem. Use documented generators/commands first, then customize. Record links and commands in docs/migration.
- Working reference: `E:\.dvgamerr-app\jirasync-hub-app` (read-only). Do not copy its identity, credentials, updater endpoints, or Jira-specific implementation.
- Preserve the Insomnium UI/layout unless the owner clarifies otherwise.
- Legacy source is in `_backup/legacy-electron/`, ignored by Git. Never delete it or use `git clean -dfX`.
- Do not create or modify test scripts for new functionality unless explicitly requested. Bug fixes may include necessary tests. Use compiler/build checks and manual verification.
- Ask once only when genuinely unsure. Inspect/check/review requests are read-only. Acknowledge mistakes briefly and fix them.
- Do not create SREB tickets. Microsoft Better Auth 1.7 requires a full migration/backfill or rollback from 1.6.24; adding issuer alone is insufficient.
- Do not mark full migration complete until every parity item is implemented and verified, or explicitly removed from scope by the owner.
