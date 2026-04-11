---
name: knowledge-base-agent-core
description: Use when working with the KBAC Obsidian plugin, planning projects with projects/goals/tasks, running backlog/planning flows, or customizing the plugin behavior and UI. This skill explains the entity model, status logic, key views, and safe customization points.
---

# Knowledge Base Agent Core (KBAC) Obsidian Plugin

Use this skill when you need to operate, extend, or customize the KBAC plugin inside Obsidian.
The plugin is a thin client for a KB-backed workflow: it visualizes projects, goals, tasks and planning,
and provides UI surfaces to trigger typed actions and review states.

## Core entities (Markdown-first)
- **Project**: `type: project` note that lives inside a project folder. Acts as the canonical anchor.
- **Task**: `type: task` note, one per task. Can link to a project and optionally to goals.
- **Goal**: `type: goal` note with `relatedProjects` and `relatedTasks`.

Projects, tasks, and goals are stored as markdown files with frontmatter.

### Canonical fields (Task)
- `status`: `backlog | planned | in_progress | blocked | done | canceled`
- `scheduled`: planned work date
- `due`: final deadline
- `projects`: array of project links
- `priority`: `none | low | normal | high | critical`

### Canonical fields (Goal)
- `relatedProjects`: links to project notes
- `relatedTasks`: links to task notes
- `periodType`: `week | month | quarter`

## Status logic
- `backlog`: task exists but not planned
- `planned`: task has a planned date (`scheduled`)
- `in_progress`: task in active execution
- `blocked`: task blocked
- `done`: completed
- `canceled`: canceled

Creation rule:
- If a task is created **with** `scheduled`, set `status = planned`.
- If **no** `scheduled`, set `status = backlog`.

## Key views
- **Dashboard**: command center. Focus, progress, goals, planning, projects, quick capture.
- **Planning**: `today | week | calendar | backlog`.
- **Kanban**: status columns. Backlog should appear as a column.
- **Calendar**: scheduled and due date views.
- **Goals**: linked tasks progress.
- **Canvas**: auto-generated project map.

## Backlog workflow (required behavior)
Backlog is a mode within Planning:
- Group by project.
- Quick actions:
  - schedule today
  - schedule tomorrow
  - choose date
  - open task
  - move to in_progress
When a backlog task is scheduled, set:
- `scheduled = YYYY-MM-DD`
- `status = planned`

## Canvas workflow
Project canvas is generated from:
`project -> goals -> tasks -> checklist steps`.
Canvas is a **visual layer**, not the truth layer.
Data edits should happen in markdown or modals; canvas can be regenerated.

## Customization points
When asked to customize the plugin:
- Adjust UI text in `src/views/DashboardView.ts`.
- Modify styling in `styles/dashboard-view.css` and other scoped CSS files.
- Add new commands in `src/commands/taskNotesCommands.ts`.
- Implement new services in `src/services/`.
- Update entity logic in `src/utils/` and `src/core/`.

## Safe operations
Prefer using existing services:
- `ProjectService`, `GoalService`, `TaskService`
- `GoalRepository`, `ProjectRepository`
- `DashboardService`

Avoid direct file writes unless using `vault.process` or existing services.

## Orchestration boundary
The plugin is a thin UI layer. It must not:
- replace orchestration,
- decide truth layer,
- embed full agent logic.

It should:
- display states,
- trigger typed actions,
- show lineage and artifacts.
