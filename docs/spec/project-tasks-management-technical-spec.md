# Project Tasks Management Technical Spec

## Status

MVP technical specification for the current fork direction on top of the `tasknotes` codebase.

This document translates the accepted product and architecture decisions into an implementation-oriented plan.

Related documents:

- [project-tasks-management.md](./project-tasks-management.md)
- [project-tasks-management-discovery.md](./project-tasks-management-discovery.md)
- [project-tasks-management-architecture-decisions.md](./project-tasks-management-architecture-decisions.md)

## 1. Purpose

Build an Obsidian plugin that turns the existing `tasknotes` foundation into a project-centered, markdown-first planning system with:

- project note plus project folder model;
- one-note-per-task model;
- explicit period goals;
- dashboard-first UX;
- project tree, tasks list, kanban, calendar, and heatmap in MVP.

The implementation should reuse the strong parts of `tasknotes` instead of rewriting the whole plugin.

## 2. Current codebase anchors

The technical design should explicitly build on these existing areas:

- [src/main.ts](C:/Users/kireall/Desktop/Obsidian%20plug/tasknotes/src/main.ts)
  Current plugin entrypoint and service wiring.
- [src/bootstrap/pluginBootstrap.ts](C:/Users/kireall/Desktop/Obsidian%20plug/tasknotes/src/bootstrap/pluginBootstrap.ts)
  Core service initialization, ribbon registration, lazy initialization.
- [src/bootstrap/pluginRuntime.ts](C:/Users/kireall/Desktop/Obsidian%20plug/tasknotes/src/bootstrap/pluginRuntime.ts)
  Runtime setup and teardown.
- [src/services/TaskService.ts](C:/Users/kireall/Desktop/Obsidian%20plug/tasknotes/src/services/TaskService.ts)
  Central task create/update/delete logic.
- [src/utils/TaskManager.ts](C:/Users/kireall/Desktop/Obsidian%20plug/tasknotes/src/utils/TaskManager.ts)
  Task discovery, frontmatter extraction, and just-in-time indexing.
- [src/types.ts](C:/Users/kireall/Desktop/Obsidian%20plug/tasknotes/src/types.ts)
  Existing task/domain/filter types.
- [src/types/settings.ts](C:/Users/kireall/Desktop/Obsidian%20plug/tasknotes/src/types/settings.ts)
  Settings contract.
- [src/settings/defaults.ts](C:/Users/kireall/Desktop/Obsidian%20plug/tasknotes/src/settings/defaults.ts)
  Default field mapping, statuses, priorities, folders, and behavior.
- [src/bases/TaskListView.ts](C:/Users/kireall/Desktop/Obsidian%20plug/tasknotes/src/bases/TaskListView.ts)
- [src/bases/KanbanView.ts](C:/Users/kireall/Desktop/Obsidian%20plug/tasknotes/src/bases/KanbanView.ts)
- [src/bases/CalendarView.ts](C:/Users/kireall/Desktop/Obsidian%20plug/tasknotes/src/bases/CalendarView.ts)
  Existing task views that should be reused and adapted.
- [src/templates/defaultBasesFiles.ts](C:/Users/kireall/Desktop/Obsidian%20plug/tasknotes/src/templates/defaultBasesFiles.ts)
  Default generated `.base` files and formulas.

## 3. Accepted implementation baseline

These are treated as fixed for MVP:

1. Project = `project folder + canonical project note`.
2. The canonical object for references, filters, and views is the `project note`.
3. Task = separate markdown note.
4. Goal = separate markdown note.
5. All user data is markdown-first.
6. Hidden plugin state is limited to cache, index, settings, and UI state.
7. Each task has exactly one primary project in MVP.
8. Dashboard is the default landing surface.
9. Heatmap counts completed tasks only in MVP.
10. Pomodoro, recurring tasks, dependencies, and advanced subtask logic stay outside the MVP contract, even if some legacy code remains.

## 4. Default vault contract

The plugin must support arbitrary vaults, but MVP should ship with a strong default structure:

```text
Inbox/
Projects/
Tasks/
Goals/
Resources/
Templates/
System/
```

### 4.1 Default paths

Recommended defaults:

- `Projects/` for project folders
- `Tasks/{{year}}/` for task notes
- `Goals/Weekly/`
- `Goals/Monthly/`
- `Goals/Quarterly/`
- `System/Views/` for generated `.base` files

### 4.2 Configurability

These root folders should be configurable in settings, but the defaults above should be the first-run setup.

## 5. Entity storage model

## 5.1 Project

### Canonical shape

A project is represented by:

- a project folder, for example `Projects/VT-box/`
- a canonical project note inside that folder, for example `Projects/VT-box/project.md`

### Canonical identity

- Runtime identity: note path
- Link target for tasks: project note
- Physical container for materials: project folder

### Project note frontmatter

```yaml
type: project
title: VT-box
status: active
folder: Projects/VT-box
description: Core project workspace for VT-box.
relatedNotes:
  - "[[Projects/VT-box/Specs/overview]]"
tags:
  - project
dateCreated: 2026-04-05T10:00:00+03:00
dateModified: 2026-04-05T10:00:00+03:00
startDate: 2026-04-01
dueDate: 2026-06-30
completedDate:
archived: false
```

### MVP project statuses

Recommended default project statuses:

- `idea`
- `active`
- `on_hold`
- `completed`
- `archived`

## 5.2 Task

### Canonical shape

Each task is a standalone markdown file.

Example path:

```text
Tasks/2026/2026-04-05-vtbox-q2-planning.md
```

### Compatibility strategy

To stay close to `tasknotes`, the canonical task frontmatter should reuse existing task fields where practical.

Important compatibility choice:

- Store the primary project in the existing `projects` field.
- In MVP, `projects` must contain exactly one entry.
- Internally, product logic treats this as `primaryProject`.

### Task note frontmatter

```yaml
type: task
title: Plan VT-box tasks for Q2
status: planned
priority: high
projects:
  - "[[Projects/VT-box/project]]"
scheduled: 2026-04-05
due: 2026-04-08
dateCreated: 2026-04-05T10:15:00+03:00
dateModified: 2026-04-05T10:15:00+03:00
completedDate:
relatedNotes:
  - "[[Projects/VT-box/Specs/q2-roadmap]]"
tags:
  - task
archived: false
sortOrder:
```

### MVP task statuses

Accepted default values:

- `inbox`
- `planned`
- `in_progress`
- `blocked`
- `done`
- `canceled`

### MVP priorities

Accepted default values:

- `low`
- `normal`
- `high`
- `critical`

### Reserved but non-core fields

These may exist in frontmatter now or later, but they are not required to power MVP behavior:

- `startDate`
- `endDate`
- `timeEstimate`
- `timeEntries`
- `blockedBy`
- `recurrence`

## 5.3 Goal

### Canonical shape

Each goal is a standalone markdown note stored under a period folder.

Example paths:

```text
Goals/Weekly/2026/2026-W15.md
Goals/Monthly/2026/2026-04.md
Goals/Quarterly/2026/2026-Q2.md
```

### Goal note frontmatter

```yaml
type: goal
periodType: week
periodKey: 2026-W15
periodStart: 2026-04-06
periodEnd: 2026-04-12
title: Stabilize planning across active projects
description: Align project execution and next actions for the week.
projects:
  - "[[Projects/VT-box/project]]"
tasks:
  - "[[Tasks/2026/2026-04-05-vtbox-q2-planning]]"
tags:
  - goal
dateCreated: 2026-04-05T10:20:00+03:00
dateModified: 2026-04-05T10:20:00+03:00
status: active
```

### Goal behavior in MVP

- Goals are explicit planning entities, not derived-only filters.
- Goals may link to multiple projects and multiple tasks.
- Goal progress is computed, not manually entered, in MVP.

## 6. Entity detection rules

## 6.1 Task detection

MVP should switch the default task identification strategy to:

- `taskIdentificationMethod = property`
- `taskPropertyName = type`
- `taskPropertyValue = task`

### Transition behavior

During migration, task detection should support both:

- legacy TaskNotes task notes;
- new `type: task` notes.

## 6.2 Project detection

Project notes are discovered by:

- `type: project`

## 6.3 Goal detection

Goal notes are discovered by:

- `type: goal`

## 7. Frontmatter naming policy

To reduce rewrite cost, MVP should reuse current TaskNotes field names for task notes when possible:

- `status`
- `priority`
- `scheduled`
- `due`
- `dateCreated`
- `dateModified`
- `completedDate`
- `projects`

New fixed fields required by the product:

- `type`
- `folder` for project notes
- `relatedNotes` for project/task/goal notes
- `periodType`, `periodKey`, `periodStart`, `periodEnd` for goals

## 8. Proposed runtime modules

## 8.1 Keep and adapt

Reuse these modules rather than replacing them:

- `TaskService`
- `TaskManager`
- `FieldMapper`
- `StatusManager`
- `PriorityManager`
- `FilterService`
- `ViewStateManager`
- current Bases task views

## 8.2 Add

Create new modules:

### Projects

- `src/projects/ProjectService.ts`
- `src/projects/ProjectRepository.ts`
- `src/projects/ProjectPathService.ts`

Responsibilities:

- create project folder plus project note
- load and update project metadata
- resolve note <-> folder mapping
- compute project summaries from linked tasks

### Goals

- `src/goals/GoalService.ts`
- `src/goals/GoalRepository.ts`
- `src/goals/GoalPeriodService.ts`

Responsibilities:

- create and update goal notes
- resolve current week, month, quarter
- fetch goals for current period
- compute goal progress from linked tasks

### Dashboard

- `src/dashboard/DashboardService.ts`
- `src/views/DashboardView.ts`

Responsibilities:

- assemble dashboard sections
- fetch today, this week, active projects, deadlines, goals, and quick actions

### Progress

- `src/progress/ProgressService.ts`
- `src/views/ProgressHeatmapView.ts`

Responsibilities:

- aggregate completed tasks by local day
- prepare heatmap ranges
- expose click-through filters for selected day

### Project views

- `src/views/ProjectTreeView.ts`

Responsibilities:

- project-first grouped view
- expand/collapse projects
- sort/filter nested tasks

## 8.3 Extend existing settings

Add to [settings.ts](C:/Users/kireall/Desktop/Obsidian%20plug/tasknotes/src/types/settings.ts):

- `projectsFolder`
- `goalsFolder`
- `systemFolder`
- `projectNoteFilename` default `project`
- `dashboardDefaults`
- `projectStatuses`
- `goalDefaults`
- `heatmapSettings`

## 8.4 Extend existing types

Add to [types.ts](C:/Users/kireall/Desktop/Obsidian%20plug/tasknotes/src/types.ts):

- `ProjectInfo`
- `GoalInfo`
- `DashboardSection`
- `DashboardData`
- `HeatmapCell`
- `ProjectProgressSummary`

## 9. View model for MVP

## 9.1 Dashboard

Dashboard is the main entry surface.

### MVP dashboard widgets

- current goals:
  - week
  - month
  - quarter
- today
- this week
- active projects
- upcoming deadlines
- mini calendar
- quick actions

### Implementation choice

Dashboard should be a custom plugin view, not a `.base` file.

## 9.2 Projects view

This is a project-first view, separate from the all tasks list.

### Behavior

- top level rows are projects
- each project can expand/collapse
- nested tasks use shared task card rendering
- supports filters and multi-sort
- shows project progress summary

### Implementation choice

Custom plugin view, not a plain Bases view.

## 9.3 All tasks view

Reuse current task list infrastructure, but adapt product copy and defaults to the new status model and one-primary-project rule.

## 9.4 Kanban

Reuse current kanban infrastructure with these product rules:

- default columns map to task statuses
- exactly one primary project per task
- drag-and-drop between columns updates `status`
- card fields are configurable

## 9.5 Calendar

Reuse current calendar infrastructure with these product rules:

- week and month are in MVP
- task cards display minimal configurable metadata
- drag-and-drop updates `scheduled`
- calendar includes a goals block for the active period context

## 9.6 Heatmap

Custom plugin view.

### MVP behavior

- source metric = completed tasks only
- date source = `completedDate`
- aggregate by local day
- selecting a day opens or applies a filtered task list for that day

## 10. Command set for MVP

Add or adapt commands:

- `open-dashboard`
- `open-projects-view`
- `open-tasks-view`
- `open-kanban-view`
- `open-calendar-view`
- `open-progress-view`
- `create-project`
- `create-task`
- `create-goal`
- `open-current-week-goal`

Command naming should stay sentence-case in UI and avoid redundant plugin names.

## 11. Create and update flows

## 11.1 Create project

Flow:

1. User triggers create project.
2. Plugin creates project folder under `projectsFolder`.
3. Plugin creates canonical `project.md` inside the folder.
4. Plugin writes `type: project` frontmatter.
5. Plugin optionally opens the project note or project details view.

## 11.2 Create task

Flow:

1. User creates task from dashboard, project context, note context, or global command.
2. Plugin creates one standalone task note under `tasksFolder`.
3. Plugin writes `type: task`.
4. Plugin writes exactly one project link in `projects`.
5. Plugin writes `relatedNotes` if task was created from a note context.
6. All views refresh through existing event infrastructure.

## 11.3 Create goal

Flow:

1. User creates a weekly, monthly, or quarterly goal.
2. Plugin chooses folder and `periodKey`.
3. Plugin creates a goal note with `type: goal`.
4. Plugin links selected projects and tasks.
5. Dashboard and calendar goals block refresh.

## 12. Compatibility and migration strategy

## 12.1 Tasks

Preserve compatibility with the TaskNotes task-note model where possible.

Rules:

- Existing tasks remain readable.
- New tasks should be created with `type: task`.
- Legacy tasks may be backfilled with `type: task` on update.
- If a legacy task has multiple project links, the UI should use the first one as primary in MVP and mark the note as needing normalization.

## 12.2 Projects

No automatic full inference of projects from folders in MVP.

Rules:

- A project exists for the product only after a canonical project note exists.
- If a folder exists without `project.md`, it is just a folder, not yet a project entity.

## 12.3 Legacy TaskNotes features

Do not remove legacy features just to simplify the fork immediately.

Rules:

- Pomodoro, API, recurrence, and related services may remain in code.
- They should not drive the MVP UX or data model.
- Where needed, hide them from the main product surfaces rather than deleting them first.

## 13. Engineering constraints

Implementation must follow the Obsidian plugin skill guidelines:

- use markdown-first data storage
- use `registerEvent`, `registerDomEvent`, and `registerInterval` for lifecycle cleanup
- avoid storing view instances on the plugin where unnecessary
- use `normalizePath()` for user-defined paths
- use Obsidian DOM helpers rather than direct unsafe HTML
- keep UI strings in sentence case
- keep accessible controls with keyboard support and visible focus styles

## 14. Milestone plan

## Milestone 1. Schema and settings foundation

- add new entity interfaces
- add new settings fields
- switch default task identification to `type: task`
- add project and goal repositories

Detailed execution plan:

- [project-tasks-management-milestone-1.md](./project-tasks-management-milestone-1.md)

## Milestone 2. Project entity support

- create project folder plus project note flow
- project note parser and serializer
- project summary computation

## Milestone 3. Goal entity support

- goal note parser and serializer
- current period resolver
- goal queries for week, month, quarter

## Milestone 4. Dashboard

- dashboard service
- dashboard view
- quick actions

## Milestone 5. Project tree

- project tree view
- project progress summaries
- filtering and sorting over nested tasks

## Milestone 6. Adapt existing task surfaces

- align task create/edit flows to one-primary-project rule
- adapt task list
- adapt kanban
- adapt calendar

## Milestone 7. Heatmap and progress

- progress service
- heatmap view
- click-through to filtered tasks

## 15. Acceptance criteria for MVP

MVP is accepted when all of the following are true:

1. Creating a project creates both a project folder and a canonical project note.
2. Creating a task creates a standalone task note with exactly one primary project.
3. Creating a goal creates a standalone goal note for week, month, or quarter.
4. Dashboard opens as the default landing surface and shows the planned MVP sections.
5. Projects view groups tasks under project notes and supports expand/collapse.
6. Kanban and calendar continue to work on the same underlying task notes.
7. Heatmap counts completed tasks using `completedDate`.
8. All user-facing entity data is inspectable in markdown files.
9. Existing TaskNotes task notes remain readable during migration.

## 16. Immediate next engineering step

The next implementation document should be a data-contract spec that fixes:

- exact frontmatter schema names
- final default folder settings
- final project status config
- final dashboard widget payloads
- final task and project modal fields

That document should be concrete enough to start coding the first milestone without further discovery.
