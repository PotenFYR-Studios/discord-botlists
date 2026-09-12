<!-- Conventional Commit title required (feat:/fix:/docs:/chore:/refactor:/test:); release-drafter categorizes from it. -->

## Description

<!-- What does this PR change and why? -->

## Related issues

<!-- Fixes #123, or "none" -->

## Type of change

- [ ] Bug fix (non-breaking)
- [ ] New feature (non-breaking)
- [ ] Breaking change (fix or feature that changes existing API behavior)
- [ ] Documentation (docs site or README)
- [ ] Registry data (botlist added/updated/removed)
- [ ] CI / tooling

## Testing

- [ ] `bun run lint` passes
- [ ] `bun run build` passes
- [ ] `bun test` passes
- [ ] Live behavior checked where relevant (`bun scripts/test-live.ts`, optional)

## Project rules

- [ ] No new runtime dependencies added (zero-dependency promise)
- [ ] I did not hand-edit generated files (`src/data/lists.generated.ts`, `docs/src/docs/version.generated.ts`, `docs/src/data/status.json`, the README block between `<!-- STATUS:START -->` / `<!-- STATUS:END -->`)
- [ ] Docs updated if user-facing behavior changed
