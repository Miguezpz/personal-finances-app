# Specification Quality Checklist: Fechas de corte y pago de tarjetas desde el estado de cuenta

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-11-07
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] No implementation details (languages, frameworks, APIs)
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

## Requirement Completeness

- [x] No [NEEDS CLARIFICATION] markers remain
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable
- [x] Success criteria are technology-agnostic (no implementation details)
- [x] All acceptance scenarios are defined
- [x] Edge cases are identified
- [x] Scope is clearly bounded
- [x] Dependencies and assumptions identified

## Feature Readiness

- [x] All functional requirements have clear acceptance criteria
- [x] User scenarios cover primary flows
- [x] Feature meets measurable outcomes defined in Success Criteria
- [x] No implementation details leak into specification

## Notes

- Validated in 1 iteration. The input named functions (`cardTermsFromStatement`, `dueDateFor`), DB columns and source files; the spec keeps them out and states the needs as FR-002, FR-008 and FR-011. Names and files are for `/speckit-plan`.
- Number 007 on purpose: 006 is reserved for the pay-calendar spec (quincena starts on the real payday), agreed on 2026-11-05 and not yet specified.
- Decisions taken without a marker (the owner said "lo que creas mejor"): move to the **previous** business day (never late); recompute every installment not fully collected, partial ones included; a one-time recompute at rollout (FR-013); a non-blocking warning when the captured due date may have been moved (FR-006); manual entry of day/offset stays available (FR-007).
- Acceptance data are the owner's 6 real cards. They were loaded into the cloud DB by hand on 2026-11-07, so SC-006 checks that rollout doesn't change them.
- The Nu example Sep 23 → Oct 5 (bank moved Sunday → Monday) intentionally becomes Oct 2 in the app (SC-004: never later than the bank).
