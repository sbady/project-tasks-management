# Project Tasks Management Data Contract

## Status

Concrete MVP data contract for the current fork direction.

This document fixes:

- exact frontmatter field names
- entity identification rules
- default folder settings
- file naming rules
- dashboard payload contract
- migration rules for legacy TaskNotes data

Related documents:

- [project-tasks-management.md](./project-tasks-management.md)
- [project-tasks-management-architecture-decisions.md](./project-tasks-management-architecture-decisions.md)
- [project-tasks-management-technical-spec.md](./project-tasks-management-technical-spec.md)

## 1. Design rules

1. All user-facing entities are markdown files.
2. `type` is the primary entity discriminator.
3. Paths are configurable, but MVP ships with strong defaults.
4. Existing TaskNotes-compatible task fields are reused when practical.
5. `project note` is canonical for linking.
6. `project folder` is physical organization only, not the canonical runtime identity.

## 2. Entity identifiers

## 2.1 Canonical IDs

For MVP, canonical entity ID = normalized vault path.

This applies to:

- project notes
- task notes
- goal notes

No extra opaque UUID is required for MVP.

## 2.2 Internal runtime aliases

The code may expose helper fields:

- `projectId`
- `taskId`
- `goalId`

But their value should simply equal the canonical path.

## 3. Entity types

The `type` frontmatter field must use these exact values:

- `project`
- `task`
- `goal`

Reserved for future use:

- `initiative`
- `epic`
- `template`

## 4. Default folder settings

## 4.1 Settings keys

Add these settings keys to the plugin settings model:

```ts
projectsFolder: string
tasksFolder: string
goalsFolder: string
systemFolder: string
resourcesFolder: string
templatesFolder: string
inboxFolder: string
projectNoteFilename: string
taskFilenamePattern: "date-slug" | "slug" | "zettel"
goalFilenamePattern: "period-key"
```

## 4.2 Default values

```yaml
projectsFolder: "Projects"
tasksFolder: "Tasks"
goalsFolder: "Goals"
systemFolder: "System"
resourcesFolder: "Resources"
templatesFolder: "Templates"
inboxFolder: "Inbox"
projectNoteFilename: "project"
taskFilenamePattern: "date-slug"
goalFilenamePattern: "period-key"
```

## 4.3 Derived default subfolders

These are conventions, not separate required settings in MVP:

```text
Tasks/{year}/
Goals/Weekly/{year}/
Goals/Monthly/{year}/
Goals/Quarterly/{year}/
System/Views/
```

## 5. File naming rules

## 5.1 Project note naming

Every project folder contains one canonical project note:

```text
{projectsFolder}/{projectSlug}/{projectNoteFilename}.md
```

Default example:

```text
Projects/vt-box/project.md
```

## 5.2 Project folder slug

Project folder slug generation:

1. Start from project title.
2. Convert to lowercase.
3. Replace spaces with `-`.
4. Remove invalid path characters.
5. Collapse repeated `-`.

Example:

- `VT Box` -> `vt-box`

## 5.3 Task note naming

Default pattern: `date-slug`

```text
Tasks/{year}/{yyyy-mm-dd}-{task-slug}.md
```

Example:

```text
Tasks/2026/2026-04-05-plan-vt-box-q2.md
```

Fallback rules:

- if title slug is empty, use `untitled-task`
- if filename already exists, append `-2`, `-3`, etc.

## 5.4 Goal note naming

Weekly:

```text
Goals/Weekly/{year}/{periodKey}.md
```

Monthly:

```text
Goals/Monthly/{year}/{periodKey}.md
```

Quarterly:

```text
Goals/Quarterly/{year}/{periodKey}.md
```

Examples:

- `Goals/Weekly/2026/2026-W15.md`
- `Goals/Monthly/2026/2026-04.md`
- `Goals/Quarterly/2026/2026-Q2.md`

## 6. Project note schema

## 6.1 Required fields

```yaml
type: project
title: string
status: string
folder: string
dateCreated: ISO datetime
dateModified: ISO datetime
archived: boolean
```

## 6.2 Optional fields

```yaml
description: string
tags: string[]
relatedNotes: string[]
startDate: YYYY-MM-DD
dueDate: YYYY-MM-DD
completedDate: YYYY-MM-DD
area: string
domain: string
owner: string
```

## 6.3 Full example

```yaml
type: project
title: VT-box
status: active
folder: Projects/vt-box
description: Main workspace for VT-box.
tags:
  - project
relatedNotes:
  - "[[Projects/vt-box/Specs/overview]]"
startDate: 2026-04-01
dueDate: 2026-06-30
completedDate:
area:
domain:
owner:
dateCreated: 2026-04-05T12:00:00+03:00
dateModified: 2026-04-05T12:00:00+03:00
archived: false
```

## 6.4 Allowed project statuses in MVP

Default config:

- `idea`
- `active`
- `on_hold`
- `completed`
- `archived`

## 7. Task note schema

## 7.1 Required fields

```yaml
type: task
title: string
status: string
priority: string
projects: string[]
dateCreated: ISO datetime
dateModified: ISO datetime
archived: boolean
```

## 7.2 Cardinality rules

- `projects` must contain exactly one link in MVP.
- If zero links exist, task is considered `unassigned`.
- If more than one link exists in legacy data, runtime uses the first value as primary and marks the note as needing normalization.

## 7.3 Optional fields

```yaml
scheduled: YYYY-MM-DD
due: YYYY-MM-DD
startDate: YYYY-MM-DD
endDate: YYYY-MM-DD
completedDate: YYYY-MM-DD
description: string
details: string
relatedNotes: string[]
tags: string[]
contexts: string[]
sortOrder: string
timeEstimate: number
```

## 7.4 Full example

```yaml
type: task
title: Plan VT-box tasks for Q2
status: planned
priority: high
projects:
  - "[[Projects/vt-box/project]]"
scheduled: 2026-04-05
due: 2026-04-08
startDate:
endDate:
completedDate:
description:
relatedNotes:
  - "[[Projects/vt-box/Specs/q2-roadmap]]"
tags:
  - task
contexts: []
sortOrder:
timeEstimate:
dateCreated: 2026-04-05T12:15:00+03:00
dateModified: 2026-04-05T12:15:00+03:00
archived: false
```

## 7.5 Allowed task statuses in MVP

Exact values:

- `inbox`
- `planned`
- `in_progress`
- `blocked`
- `done`
- `canceled`

## 7.6 Allowed priorities in MVP

Exact values:

- `low`
- `normal`
- `high`
- `critical`

## 7.7 Task date semantics

- `scheduled`: the day the task is planned to be worked on
- `due`: the deadline date
- `startDate`: optional start boundary for future timeline work
- `endDate`: optional end boundary for future timeline work
- `completedDate`: the day the task reached a completed status

In MVP:

- calendar placement uses `scheduled` primarily
- overdue logic uses `due`
- heatmap uses `completedDate`
- timeline does not ship yet, so `startDate` and `endDate` are reserved but not central

## 8. Goal note schema

## 8.1 Required fields

```yaml
type: goal
periodType: "week" | "month" | "quarter"
periodKey: string
periodStart: YYYY-MM-DD
periodEnd: YYYY-MM-DD
title: string
dateCreated: ISO datetime
dateModified: ISO datetime
status: string
archived: boolean
```

## 8.2 Optional fields

```yaml
description: string
projects: string[]
tasks: string[]
tags: string[]
successCriteria: string[]
```

## 8.3 Full example

```yaml
type: goal
periodType: week
periodKey: 2026-W15
periodStart: 2026-04-06
periodEnd: 2026-04-12
title: Stabilize planning across active projects
description: Align project execution and next actions for the week.
projects:
  - "[[Projects/vt-box/project]]"
tasks:
  - "[[Tasks/2026/2026-04-05-plan-vt-box-q2]]"
tags:
  - goal
successCriteria:
  - Weekly plan is fully assigned.
status: active
dateCreated: 2026-04-05T12:20:00+03:00
dateModified: 2026-04-05T12:20:00+03:00
archived: false
```

## 8.4 Allowed goal statuses in MVP

- `active`
- `completed`
- `archived`

## 9. Link contract

## 9.1 Preferred storage format

Entity references should be stored as wikilinks in frontmatter strings:

```yaml
projects:
  - "[[Projects/vt-box/project]]"
```

```yaml
relatedNotes:
  - "[[Resources/strategy]]"
```

## 9.2 Why wikilinks

Wikilinks are preferred because:

- they are natural in Obsidian
- they survive path changes better when Obsidian updates links
- they are readable to the user

## 9.3 Runtime normalization

The runtime should normalize links into canonical paths before filtering or comparison.

## 10. Settings contract extensions

Add these settings groups.

## 10.1 Project settings

```ts
projectsFolder: string
projectNoteFilename: string
projectStatuses: Array<{
  value: string
  label: string
  color: string
  order: number
  isClosed: boolean
}>
```

## 10.2 Goal settings

```ts
goalsFolder: string
goalDefaults: {
  weeklyFolder: string
  monthlyFolder: string
  quarterlyFolder: string
  autoOpenCurrentGoal: boolean
}
```

## 10.3 Dashboard settings

```ts
dashboardDefaults: {
  openOnStartup: boolean
  sectionsOrder: string[]
  showMiniCalendar: boolean
  showUpcomingDeadlinesCount: number
  showRecentProjectsCount: number
}
```

## 10.4 Progress settings

```ts
heatmapSettings: {
  rangeDays: 365
  metric: "completed"
  clickAction: "filter-tasks"
}
```

## 11. Runtime type contracts

## 11.1 ProjectInfo

```ts
interface ProjectInfo {
  id: string
  path: string
  folder: string
  title: string
  status: string
  description?: string
  relatedNotes?: string[]
  tags?: string[]
  startDate?: string
  dueDate?: string
  completedDate?: string
  dateCreated: string
  dateModified: string
  archived: boolean
}
```

## 11.2 TaskInfo normalized rule

Existing `TaskInfo` may stay, but MVP product logic must interpret it as:

- `projects[0]` = primary project
- `type` = `task`

If needed, add normalized helper fields:

```ts
primaryProject?: string
relatedNotes?: string[]
type?: "task"
```

## 11.3 GoalInfo

```ts
interface GoalInfo {
  id: string
  path: string
  periodType: "week" | "month" | "quarter"
  periodKey: string
  periodStart: string
  periodEnd: string
  title: string
  description?: string
  projects?: string[]
  tasks?: string[]
  tags?: string[]
  successCriteria?: string[]
  status: string
  dateCreated: string
  dateModified: string
  archived: boolean
}
```

## 12. Dashboard payload contract

Dashboard is a custom view, not a markdown entity.

## 12.1 Section IDs

Exact section IDs for MVP:

- `goals`
- `today`
- `this_week`
- `active_projects`
- `upcoming_deadlines`
- `mini_calendar`
- `quick_actions`

## 12.2 DashboardData

```ts
interface DashboardData {
  generatedAt: string
  currentDate: string
  currentWeekKey: string
  currentMonthKey: string
  currentQuarterKey: string
  sections: DashboardSection[]
}
```

## 12.3 DashboardSection

```ts
interface DashboardSection {
  id:
    | "goals"
    | "today"
    | "this_week"
    | "active_projects"
    | "upcoming_deadlines"
    | "mini_calendar"
    | "quick_actions"
  title: string
  visible: boolean
  payload: unknown
}
```

## 12.4 Payloads by section

### `goals`

```ts
interface DashboardGoalsPayload {
  week?: GoalInfo | null
  month?: GoalInfo | null
  quarter?: GoalInfo | null
}
```

### `today`

```ts
interface DashboardTodayPayload {
  scheduledTasks: TaskInfo[]
  dueTasks: TaskInfo[]
  overdueTasks: TaskInfo[]
}
```

### `this_week`

```ts
interface DashboardWeekPayload {
  scheduledTasks: TaskInfo[]
  dueTasks: TaskInfo[]
}
```

### `active_projects`

```ts
interface DashboardActiveProjectsPayload {
  projects: Array<{
    project: ProjectInfo
    openTaskCount: number
    blockedTaskCount: number
    dueSoonTaskCount: number
  }>
}
```

### `upcoming_deadlines`

```ts
interface DashboardDeadlinesPayload {
  tasks: TaskInfo[]
}
```

### `mini_calendar`

```ts
interface DashboardMiniCalendarPayload {
  selectedDate: string
  markers: Record<string, number>
}
```

### `quick_actions`

```ts
interface DashboardQuickActionsPayload {
  actions: Array<{
    id: string
    label: string
    commandId: string
  }>
}
```

## 13. Display defaults

## 13.1 Kanban card fields

Default MVP fields:

- title
- priority
- scheduled
- due
- primary project

## 13.2 Calendar card fields

Default MVP fields:

- title
- priority
- primary project
- status

## 13.3 Project tree row defaults

Project rows show:

- title
- status
- open task count
- due soon task count

Task rows show:

- title
- status
- priority
- scheduled
- due

## 14. Migration rules

## 14.1 Task migration

For legacy TaskNotes tasks:

1. If task is detected by old rules, it remains readable.
2. On first write/update, plugin should backfill:
   - `type: task` if missing
3. If legacy `projects` contains more than one entry:
   - keep file readable
   - treat first entry as primary
   - show a normalization warning in UI

## 14.2 Project migration

There is no automatic migration from arbitrary folders to projects in MVP.

A folder becomes a project only after a canonical project note exists inside it.

## 14.3 Goal migration

No legacy compatibility required.

## 15. Validation rules

## 15.1 Project validation

Invalid if:

- `type != project`
- missing `title`
- missing `status`
- missing `folder`
- note path is not inside the declared folder

## 15.2 Task validation

Invalid if:

- `type != task`
- missing `title`
- missing `status`
- missing `priority`
- `projects` is not an array and not empty

Needs normalization if:

- `projects.length > 1`

## 15.3 Goal validation

Invalid if:

- `type != goal`
- missing `periodType`
- missing `periodKey`
- missing `periodStart`
- missing `periodEnd`
- missing `title`

## 16. Dashboard implementation recommendation

Dashboard should be implemented inside this plugin as a custom view.

### Why

- Our dashboard needs native access to `Project`, `Task`, and `Goal` repositories.
- It needs synchronized state across project tree, kanban, calendar, and heatmap.
- It should reflect our exact domain rules, especially:
  - one primary project per task
  - explicit goals
  - project note plus project folder model

Using a separate dashboard plugin as a technical base would create an awkward split between:

- the task/project system
- the homepage/dashboard shell

That is not worth it for MVP.

## 17. Recommended external plugins as references only

These are useful as UX references, not as architectural bases:

- Homepage
  - good reference for startup behavior and opening a custom landing surface
- Startpage
  - good reference for dashboard composition, stats blocks, pinned items, and recent notes UX
- obsidian-kanban
  - good reference for interaction patterns only

## 18. Acceptance checklist

This data contract is accepted when:

1. Frontmatter names are stable and implemented exactly as documented.
2. New project/task/goal creation flows follow the path and naming rules above.
3. Dashboard payloads map directly onto repository data without hidden user data stores.
4. Legacy task notes remain readable during transition.
5. New code can be written against `ProjectInfo`, `TaskInfo`, and `GoalInfo` without further schema ambiguity.
