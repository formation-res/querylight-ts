---
name: code-quality
description: Use when adding or changing functionality so implementation quality stays high through pragmatic SOLID design, small cohesive changes, and red/green/refactor TDD with strong automated test coverage.
---

# Code Quality

Use this skill when implementing new functionality, changing behavior, or refactoring code that could regress existing behavior.

## Default stance

- Prefer small, cohesive changes over broad rewrites.
- Keep behavior changes and cleanup separable unless the cleanup is required to make the behavior change safe.
- Add or update automated tests for every user-visible or contract-visible change.
- Use red/green/refactor as the default delivery loop:
  1. write a failing test for the intended behavior
  2. make the smallest change that turns it green
  3. refactor while keeping tests green

## SOLID guidance

Apply SOLID as a pressure test, not as dogma.

- Single Responsibility Principle:
  Keep modules and functions focused. If a unit is doing parsing, state management, rendering, and policy decisions together, split it.
- Open/Closed Principle:
  Prefer extending behavior through existing seams over editing many unrelated call sites.
- Liskov Substitution Principle:
  Preserve contracts. A replacement should not silently narrow accepted inputs or weaken guarantees.
- Interface Segregation Principle:
  Keep public APIs narrow. Do not force callers to depend on methods or data they do not need.
- Dependency Inversion Principle:
  Depend on stable abstractions or small seams when it improves testability or reduces coupling.

Do not introduce extra interfaces or indirection unless they solve a real problem in the current code.

## TDD workflow

For new functionality:

1. Identify the externally visible behavior to prove.
2. Add the narrowest failing test that demonstrates the missing capability.
3. Implement the minimum code to satisfy the test.
4. Add adjacent edge-case tests if the feature has obvious boundary conditions.
5. Refactor duplication, naming, or structure only after the behavior is covered.

For bug fixes:

1. Reproduce the bug with a failing test first.
2. Fix the bug with the smallest safe change.
3. Keep the regression test.

## Test quality rules

- Test behavior, not implementation trivia.
- Cover happy path, edge cases, and invalid inputs when relevant.
- Prefer deterministic tests with small fixtures.
- When adding a public API, test both direct behavior and any serialization/build/export path that could break it.
- If a change affects types, exported surfaces, or packaging, run the relevant build and packaging checks in addition to unit tests.

## Test coverage goals

- New functionality should have direct tests for the primary success path.
- Every bug fix should add a regression test that fails before the fix and passes after it.
- Cover the important boundaries:
  empty input, single-item input, multi-item input, invalid input, and threshold/range edges where applicable.
- Cover both corpus-wide behavior and filtered/subset behavior when the feature supports scoped execution.
- Cover serialization, hydration, or packaging paths when the feature depends on persisted state or exported types.
- Prefer enough coverage to make refactoring safe over chasing a raw percentage target.
- If the repo reports coverage metrics, avoid reducing coverage in the changed area without a clear reason.
- For critical business logic, aim for near-complete branch coverage on the changed code path.

## Refactoring rules

- Refactor only under green tests.
- Remove duplication that obscures intent or increases bug risk.
- Improve naming when it reduces cognitive load.
- Avoid speculative abstractions for future features that do not exist yet.
- If a refactor changes behavior, it is not just a refactor; add tests that make that behavior explicit.

## Heuristics for implementation choices

- Prefer pure functions for derived values and aggregation logic.
- Keep side effects at the edges.
- Reuse existing patterns in the repo unless they are clearly the source of the problem.
- Preserve backward compatibility for public APIs unless the user explicitly asks for a breaking change.
- When a change can be localized, localize it.

## Done criteria

The work is not done until:

- the intended behavior is covered by tests
- the implementation is the simplest version that satisfies those tests
- obvious duplication or cohesion problems introduced by the change are cleaned up
- validation relevant to the changed surface has been run
