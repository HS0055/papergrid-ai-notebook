# Workflow Configuration

## TDD
- Strictness: relaxed (write tests where valuable, not mandatory for every task)
- Test runner: not yet configured (add vitest when needed)

## Commit Strategy
- Prefix: conventional commits (feat:, fix:, refactor:, chore:)
- Frequency: per-task (one commit per completed task)
- Include track ID in commit message

## Verification Checkpoints
- After each phase: run `tsc --noEmit` + manual verification
- Between phases: user approval required

## Code Style
- Follow existing patterns in codebase
- Zod schemas in @papergrid/core for shared types
- React FC components with explicit prop interfaces
- Tailwind CSS for styling (no CSS modules)
