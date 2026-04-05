# Project Tasks Management

## Status

Working product specification captured on 2026-04-04 from the project author.

This document fixes the current product vision for the Obsidian plugin we want to build on top of the existing `tasknotes` codebase.

## Working name

- Primary working name: `Project Tasks Management`
- Alternative names mentioned during discovery:
  - `Project N Task`
  - `Knowledge Planner for Obsidian`

## Product context

The user already has an Obsidian knowledge base and wants to evolve it into a unified personal operating system where knowledge, projects, tasks, goals, and planning live in one space.

The plugin should not replace the vault structure. It should integrate into it and use it as the source of truth.

## Problem statement

Knowledge and project execution are currently split across different systems:

- knowledge lives in Obsidian;
- tasks and projects often live in external tools;
- links between notes, project context, and execution get lost;
- planning and knowledge management are disconnected;
- there is no convenient way to see the same work through calendar, kanban, list, timeline, goals, and progress views.

## Product goal

Build an Obsidian plugin that allows the user to:

1. Manage projects and tasks inside the existing knowledge base.
2. Link tasks to projects and notes.
3. View the same work in multiple representations:
   - list;
   - project tree;
   - kanban;
   - calendar;
   - timeline;
   - progress overview.
4. Plan by day, week, month, and quarter.
5. Work with goals for week, month, and quarter.
6. Track progress with completed tasks, activity history, and a GitHub-style heatmap.

## Desired outcome

The final plugin should provide:

- normal Obsidian knowledge management with folders, notes, and resources;
- a first-class `project` entity;
- tasks attached to projects or existing standalone;
- synchronized data across all views;
- calendar-driven planning;
- period goals;
- progress and activity analytics;
- no need to leave Obsidian for daily project and task management.

## Product principles

- Knowledge, data, and planning must work as one system.
- The plugin must feel native inside Obsidian.
- One entity should support many views without data duplication.
- Basic planning should stay fast and not feel heavy.
- Flexibility is required, but startup configuration should stay simple.
- Context matters more than rigid form.

## Accepted MVP architecture decisions

These decisions are fixed for the current MVP direction unless we later revise them explicitly.

1. Project = `project folder + canonical project note`.
2. The canonical object for links, filters, and views is the `project note`.
3. Tasks are stored as separate markdown files with one note per task.
4. Goals are stored as separate markdown entities for a period.
5. All user-facing data remains markdown-first.
6. Non-markdown storage is allowed only for cache, indexing, settings, and UI state.
7. Each task has exactly one primary project in MVP.
8. The main entry point for the product is a dashboard.
9. Heatmap activity in MVP is based on completed tasks only.
10. Pomodoro and similar advanced TaskNotes features may remain in the codebase for future reuse, but they are not part of the MVP contract.

## In scope

- project creation and editing;
- task creation and editing;
- project to task linking;
- task and project links to notes or folders;
- multiple views:
  - projects with nested tasks;
  - all tasks list;
  - kanban;
  - calendar;
  - timeline;
  - heatmap / progress view;
- filtering, grouping, sorting;
- period goals;
- configurable display fields;
- operation fully inside Obsidian.

## Not primary for MVP

- real-time multi-user collaboration;
- shared sync between multiple users;
- enterprise workflows;
- mandatory external server;
- mobile-first optimization;
- mandatory Jira, Notion, or Google Calendar integrations;
- pomodoro as a required core workflow;
- recurring tasks as a required core workflow;
- dependencies as a required core workflow;
- full subtask hierarchy as a required core workflow.

## Core entities

### Knowledge base

The existing Obsidian vault with arbitrary folders, nested folders, notes, and assets.

The plugin must adapt to the vault, not force a single rigid structure.

### Project

A first-class entity connected to tasks, notes, and materials.

Implementation decision for MVP:

- the project note is the canonical domain object;
- the project folder is the physical container for project materials;
- tasks point to the project note, not directly to the folder.

Expected fields:

- `id`
- `title`
- `status`
- `description`
- `path`
- `relatedNotes`
- `createdAt`
- `updatedAt`
- `tags`

Future-compatible fields:

- importance / priority;
- custom fields.

### Task

A unit of work connected to a project or standalone.

Implementation decision for MVP:

- one markdown file per task;
- one primary project per task in MVP;
- related notes are allowed;
- no dependency model, recurring model, or full subtask model in MVP.

Expected fields:

- `id`
- `title`
- `status`
- `priority`
- `projectId`
- `scheduledDate`
- `dueDate`
- `startDate`
- `endDate`
- `createdAt`
- `completedAt`
- `description`
- `relatedNotes`
- `tags`

### Goal

A planning entity for a period:

- week;
- month;
- quarter.

Implementation decision for MVP:

- one markdown file per goal;
- explicit storage instead of deriving goals only from task filters;
- goals may link to related tasks and projects.

Expected fields:

- `id`
- `type`
- `periodKey`
- `title`
- `description`
- `relatedProjects`
- `relatedTasks`
- `createdAt`
- `updatedAt`

### Related note / knowledge item

Any vault note that contains relevant knowledge, decisions, materials, prompts, research, or project context and can be linked to projects or tasks.

## Main user scenarios

### Create project

The user creates a project entity that can be linked to a note or folder in the vault and then opened as a project workspace with related tasks.

### Create task inside project

The user opens a project and creates a task. The task is automatically linked to that project and appears in all relevant views.

### View tasks grouped by project

The user opens a tree-style view where projects are the top level and tasks are nested inside them. Projects can be expanded or collapsed and tasks can be filtered or sorted.

### Work through kanban

The user opens a kanban board, sees tasks grouped by statuses, moves tasks between columns, and uses filters for project, priority, tags, and deadlines.

### Work through calendar

The user opens week or month calendar views, drags tasks across days, sees key attributes on cards, and sees the goals for the corresponding period.

### Work through timeline

The user opens a timeline to view tasks and projects across time, plan long-running work, and review load and deadlines.

### Track progress

The user opens a progress view and sees completed tasks per day and a heatmap that helps with reflection and motivation.

### Move from knowledge to action

The user reads a note, creates a task from it, links the task to a project, and plans it without leaving the vault context.

## Functional requirements

### Project management

The system should allow:

- create project;
- edit project;
- archive or delete project;
- list projects;
- open project details and related tasks;
- link project to a note or folder;
- show related materials.

### Task management

The system should allow:

- create task;
- edit task;
- archive or delete task;
- change task status;
- change task dates;
- link task to project;
- link task to notes;
- use priorities;
- use tags;
- store task description.

### Project -> task tree view

The system should provide a view where:

- projects are the top level;
- tasks are nested below each project;
- projects can be expanded or collapsed;
- filtering is available;
- multi-sort is available;
- examples of sorting include deadline, planned date, priority, status, created date, and updated date.

### Kanban

The system should provide:

- configurable columns;
- drag-and-drop between columns;
- optional status change on move;
- filters;
- configurable task card fields;
- access to task details.

### All tasks list

The system should provide an all tasks view for search, filtering, sorting, and quick overview across the whole system.

### Calendar

The system should provide:

- week view;
- month view;
- tasks positioned by date;
- drag-and-drop rescheduling;
- customizable visible fields;
- quick access to task details;
- sync with the other views.

### Timeline

The system should provide:

- tasks positioned in time;
- support for long-running tasks and stages;
- deadline overview;
- visual planning.

### Period goals

The system should support goals for:

- week;
- month;
- quarter.

Goals should be created and edited by the user, displayed in the relevant planning context, and kept separate from ordinary tasks while still linked to planning.

### Heatmap

The system should provide a heatmap of completed tasks by day with density based on task count and support long-period review.

### Filtering and sorting

The system should support:

- filter by project;
- filter by status;
- filter by priority;
- filter by deadline;
- filter by tags;
- filter by date range;
- multi-sort.

### Display customization

The system should allow the user to:

- choose which fields appear in cards;
- tune calendar card content;
- tune list and board columns;
- control default visible entities.

### Knowledge base integration

The system should:

- respect arbitrary vault structure;
- allow custom folders and note layouts;
- link tasks and projects to notes and folders;
- support the pattern where a project lives inside its own folder with materials.

## Non-functional requirements

### Native to Obsidian

- markdown-first;
- vault-first;
- no destructive assumptions about existing files;
- should feel like a natural Obsidian extension.

### Flexible

- adaptable to different folder structures;
- adaptable to different fields;
- adaptable to different project methods.

### Performant

- should remain usable with many notes, many tasks, many projects, and long activity history.

### Extensible

- architecture should allow new views;
- new entities;
- new fields;
- future automations and analytics.

### Local-first

- core logic should work locally inside the vault without mandatory external infrastructure.

## MVP scope

The first working version should include:

1. Dashboard as the main landing surface.
2. Project create and edit.
3. Task create and edit.
4. Task to project linking.
5. Projects -> tasks tree view.
6. All tasks list.
7. Kanban.
8. Calendar:
   - week;
   - month.
9. Basic filtering:
   - project;
   - status;
   - priority;
   - deadline.
10. Basic sorting.
11. Goal blocks:
   - week;
   - month;
   - quarter.
12. Heatmap of completed tasks.
13. Links between tasks, projects, and notes.

## Post-MVP ideas

- timeline;
- configurable view builder;
- custom fields;
- advanced productivity analytics;
- automatic task creation from notes;
- automation workflows;
- project templates;
- dependencies;
- recurring tasks;
- richer subtask and stage models;
- epics and stages;
- external integrations.

## Success criteria

The product is successful if:

1. Projects and tasks can be managed fully inside Obsidian.
2. The same tasks can be viewed consistently in multiple views.
3. The user can plan a week and month quickly.
4. Tasks, projects, and knowledge stay linked.
5. Progress and completed work are visible.
6. The plugin becomes part of daily work rather than a demo experiment.

## Constraints and assumptions

- The knowledge base already exists and may have an arbitrary structure.
- The user may create any folders or notes.
- The plugin must not force one rigid vault structure.
- The initial product is for one primary user.
- Mobile is not the primary target for MVP.

## Source note

This document is a normalized repository copy of the project brief provided directly by the user in chat on 2026-04-04.
