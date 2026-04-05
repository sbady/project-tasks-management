# Project Tasks Management Milestone 1

## Purpose

This document fixes the exact scope and control checkpoints for `Milestone 1`.

Milestone 1 is the foundation milestone.

It does not ship the visible product yet.
It makes the data model, settings model, detection rules, and repository layer stable enough to safely build:

- project creation;
- goal support;
- dashboard;
- project tree;
- adapted kanban and calendar views.

## Milestone goal

By the end of Milestone 1, the codebase must have a stable schema and repository foundation for the new product model:

- `project`
- `task`
- `goal`

with backward-safe handling of existing TaskNotes task notes.

## What Milestone 1 includes

## 1. Settings foundation

Add the new settings fields required by the data contract:

- `projectsFolder`
- `goalsFolder`
- `systemFolder`
- `resourcesFolder`
- `templatesFolder`
- `inboxFolder`
- `projectNoteFilename`
- `taskFilenamePattern`
- `goalFilenamePattern`
- `dashboardDefaults`
- `projectStatuses`
- `goalDefaults`
- `heatmapSettings`

Files expected to change:

- [settings.ts](C:/Users/kireall/Desktop/Obsidian%20plug/tasknotes/src/types/settings.ts)
- [defaults.ts](C:/Users/kireall/Desktop/Obsidian%20plug/tasknotes/src/settings/defaults.ts)

## 2. Domain types and contracts

Add the new core runtime types:

- `ProjectInfo`
- `GoalInfo`
- `DashboardData`
- `DashboardSection`
- `HeatmapCell`
- helper normalized task fields if needed

Files expected to change:

- [types.ts](C:/Users/kireall/Desktop/Obsidian%20plug/tasknotes/src/types.ts)

## 3. Entity identification and detection rules

Implement or prepare support for:

- `type: task`
- `type: project`
- `type: goal`

while preserving readability of legacy TaskNotes tasks.

Rules:

- new tasks must be treated as `type: task`
- project notes must be identified by `type: project`
- goal notes must be identified by `type: goal`
- legacy tasks still load through compatibility rules

Files expected to change:

- [TaskManager.ts](C:/Users/kireall/Desktop/Obsidian%20plug/tasknotes/src/utils/TaskManager.ts)
- [FieldMapper.ts](C:/Users/kireall/Desktop/Obsidian%20plug/tasknotes/src/services/FieldMapper.ts)
  if normalization or field conversion updates are needed

## 4. Path, naming, and normalization utilities

Add utilities for:

- project folder slug generation
- canonical project note path generation
- task file path generation under `Tasks/{year}/`
- goal file path generation by period type
- wikilink normalization to canonical vault paths

Proposed new files:

- `src/core/pathing/projectPaths.ts`
- `src/core/pathing/taskPaths.ts`
- `src/core/pathing/goalPaths.ts`
- `src/core/links/normalizeEntityLink.ts`

## 5. Repository skeletons

Add repository-level read/list/parse support for new entities.

Milestone 1 scope is repository foundation, not full create/edit UI.

### Projects

- `ProjectRepository`
- parse project note frontmatter
- list project notes
- resolve note path <-> project folder mapping

### Goals

- `GoalRepository`
- parse goal note frontmatter
- list goals by period type
- resolve current period file conventions

Proposed new files:

- `src/projects/ProjectRepository.ts`
- `src/goals/GoalRepository.ts`
- `src/goals/GoalPeriodService.ts`

## 6. Runtime wiring

Wire the new repositories into plugin runtime so later milestones can consume them without rework.

Files expected to change:

- [main.ts](C:/Users/kireall/Desktop/Obsidian%20plug/tasknotes/src/main.ts)
- [pluginBootstrap.ts](C:/Users/kireall/Desktop/Obsidian%20plug/tasknotes/src/bootstrap/pluginBootstrap.ts)
- [pluginRuntime.ts](C:/Users/kireall/Desktop/Obsidian%20plug/tasknotes/src/bootstrap/pluginRuntime.ts)

## 7. Validation helpers

Add validation helpers for:

- valid project note
- valid task note for new contract
- valid goal note
- normalization-needed states

Proposed new files:

- `src/core/validation/projectValidation.ts`
- `src/core/validation/taskValidation.ts`
- `src/core/validation/goalValidation.ts`

## 8. Tests for foundation behavior

Milestone 1 should include test coverage for:

- path generation
- slug generation
- entity detection
- legacy task compatibility
- project parsing
- goal parsing

Likely test areas:

- `tests/unit/`

## What Milestone 1 does not include

These are explicitly out of scope:

- project creation modal
- goal creation modal
- dashboard UI
- project tree UI
- heatmap UI
- kanban redesign
- calendar redesign
- task modal redesign
- project progress widgets
- migration command UI

This is important because Milestone 1 is a foundation milestone, not a visible feature milestone.

## Control checkpoints

We will move through Milestone 1 using these checkpoints.

## Checkpoint 1. Settings and type contract

Goal:

- codebase compiles with the new settings and type interfaces

Done when:

- new settings fields exist in the settings type
- defaults are defined
- new domain interfaces exist
- no existing compile path is broken

Acceptance signal:

- TypeScript build passes

## Checkpoint 2. Entity detection

Goal:

- runtime can distinguish `task`, `project`, and `goal`

Done when:

- `type: project` notes are recognized as projects
- `type: goal` notes are recognized as goals
- new `type: task` notes are recognized as tasks
- legacy TaskNotes tasks are still recognized

Acceptance signal:

- unit tests pass for all detection scenarios

## Checkpoint 3. Path and naming layer

Goal:

- file and folder conventions are codified in reusable utilities

Done when:

- project path generation works
- task filename generation works for the new contract
- goal period paths work
- wikilinks normalize to canonical paths

Acceptance signal:

- deterministic path-generation tests pass

## Checkpoint 4. Repository layer

Goal:

- read/list/parse support exists for projects and goals

Done when:

- `ProjectRepository` can list and parse project notes
- `GoalRepository` can list and parse goal notes
- current period resolution exists for goals
- plugin runtime can access these repositories

Acceptance signal:

- repositories can parse fixture files without runtime errors

## Checkpoint 5. Backward-safe integration

Goal:

- new foundation does not break existing TaskNotes task handling

Done when:

- legacy task reading still works
- task list, kanban, and calendar builds still compile
- no existing startup path crashes

Acceptance signal:

- build passes
- smoke test on current plugin startup passes

## Deliverables

At the end of Milestone 1, we should have:

1. Updated settings contract.
2. Updated defaults contract.
3. New domain interfaces.
4. New pathing utilities.
5. New validation helpers.
6. New `ProjectRepository`.
7. New `GoalRepository`.
8. Runtime wiring for the repositories.
9. Unit tests for schema/path/detection compatibility.

## Definition of done

Milestone 1 is done only if all of the following are true:

1. The plugin builds successfully.
2. New schema and settings compile without type holes.
3. `task`, `project`, and `goal` entities are detectable.
4. Legacy TaskNotes tasks remain readable.
5. Project and goal repositories can parse markdown fixtures.
6. No visible MVP UI has been built yet unless it is required only for smoke verification.

## Why this milestone matters

If we skip this foundation step, all later UI milestones will be built on unstable assumptions and will likely need rework.

If we do it well, then:

- Milestone 2 can focus only on project creation and project entity behavior
- Milestone 3 can focus only on goals
- Milestone 4 can focus only on dashboard
- Milestone 5+ can move faster because the data layer is already stable

## Recommended order inside Milestone 1

1. Settings contract
2. Type contract
3. Detection rules
4. Path utilities
5. Repositories
6. Runtime wiring
7. Tests
8. Build and smoke verification

## Next milestone after completion

If Milestone 1 is accepted, the next step is:

- `Milestone 2: Project entity support`

That milestone should deliver the first visible project behavior:

- create project folder plus project note
- project parser and serializer in real workflows
- project summary computation
