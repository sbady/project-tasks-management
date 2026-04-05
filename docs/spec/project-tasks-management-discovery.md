# Project Tasks Management Discovery

## Purpose

This document turns the current product vision into a working discovery and implementation checklist.

It is the main companion to [project-tasks-management.md](C:/Users/kireall/Desktop/Obsidian%20plug/tasknotes/docs/spec/project-tasks-management.md).

It also distinguishes accepted MVP decisions from still-open discovery questions.

## Recommended delivery strategy

We should not try to ship the entire vision in one pass. The safest path is:

1. Stabilize the data model and storage strategy.
2. Decide what we reuse from `tasknotes` and what we simplify or replace.
3. Ship one coherent MVP loop:
   - projects;
   - tasks;
   - project tree;
   - all tasks list;
   - kanban;
   - calendar;
   - period goals;
   - heatmap.
4. Only then add timeline, advanced analytics, automations, and custom fields.

## Proposed decomposition

### Phase 0. Discovery and architecture

- finalize domain model details on top of the accepted baseline;
- finalize storage format details for projects, tasks, and goals;
- define vault integration strategy;
- define migration strategy from current `tasknotes` assumptions;
- define what existing features from `tasknotes` we keep, hide, or remove.

### Phase 1. Data layer and core entities

- project entity model;
- task entity model;
- goal entity model;
- note linking model;
- repositories and indexing;
- caching and event propagation;
- settings model for folders, naming, defaults, and field mapping.

### Phase 2. Authoring workflows

- create project;
- edit project;
- create task;
- edit task;
- link task to project;
- link project and task to notes;
- archive / delete behavior;
- quick-create from note or project context.

### Phase 3. Core views for MVP

- Projects view with nested tasks;
- All tasks list;
- Kanban view;
- Calendar week view;
- Calendar month view;
- Goals block for current period;
- Progress heatmap.

### Phase 4. Filtering, sorting, and UX polish

- filter state model;
- multi-sort behavior;
- saved filters if needed;
- card density and visible fields;
- drag-and-drop rules;
- keyboard accessibility and Obsidian-native interactions.

### Phase 5. Performance and vault resilience

- large vault indexing behavior;
- incremental refresh behavior;
- conflict-safe writes;
- recovery from broken frontmatter or missing links;
- test data sets and smoke tests.

### Phase 6. Post-MVP expansion

- timeline;
- custom fields;
- dependencies and subtasks;
- templates;
- automations;
- external integrations.

## Accepted decisions

The following decisions are treated as fixed for MVP unless we intentionally revisit them.

1. Project = `project folder + canonical project note`.
2. The project note is the canonical domain object for references, filters, and views.
3. Tasks = separate markdown notes.
4. Goals = separate markdown notes for period entities.
5. Markdown-first is a hard rule for user data.
6. Hidden storage is allowed only for cache, index, settings, and UI state.
7. Each task has one primary project in MVP.
8. Dashboard is the main entry surface for MVP.
9. Heatmap is based on completed tasks only in MVP.
10. Pomodoro and similar advanced features may stay available in the codebase for future reuse, but they are not core MVP requirements.

## Critical product questions

These are the questions that matter most before implementation can move fast without rework.

### A. Storage and source of truth

1. Which fields must be persisted in frontmatter from day one, and which can remain computed?
2. Should links between entities prefer wikilinks, canonical paths, or both?
3. What canonical naming rules should be used for project, task, and goal files?

### B. Vault structure and user workflow

4. Should the default vault layout be:
   - `Inbox/`
   - `Projects/`
   - `Tasks/`
   - `Goals/`
   - `Resources/`
   - `Templates/`
   - `System/`
   or should part of this remain configurable from the first release?
5. Should tasks live by default in a shared `Tasks/` tree even when they belong to projects?
6. How opinionated should initial vault setup be for new users?

### C. Project model

7. What statuses should projects support in MVP?
8. Do projects need their own deadlines and date ranges in MVP?
9. Do projects need progress calculation in MVP, and if yes, how should it be derived?
10. Does a project need `owner`, `area`, `domain`, or other organizational fields now, or later?

### D. Task model

11. Confirm the exact task statuses for MVP. Current recommendation:
   - `inbox`
   - `planned`
   - `in_progress`
   - `blocked`
   - `done`
   - `canceled`
12. Confirm the exact task priorities for MVP. Current recommendation:
   - `low`
   - `normal`
   - `high`
   - `critical`
13. Should kanban columns be fixed to statuses or independently configurable in MVP?
14. What is the exact semantic difference between `scheduledDate`, `startDate`, and `dueDate` in the UX?
15. Should checklist items inside a task note remain plain content only, or become lightweight pseudo-subtasks later?

### E. Goals and planning

16. How should a weekly goal differ from a normal task list for the week?
17. Can one goal span multiple projects?
18. Should goals be manually curated, auto-derived from tagged tasks, or hybrid?
19. Where should goals be edited:
   - dedicated modal;
   - dedicated note;
   - side panel;
   - block embedded in calendar view?
20. How should the plugin determine the current quarter and current planning period?

### F. Views and navigation

21. What exact widgets belong on the MVP dashboard:
   - goals;
   - today;
   - this week;
   - active projects;
   - nearest deadlines;
   - mini calendar;
   - quick actions?
22. In the projects tree view, should standalone tasks appear in a separate group?
23. In calendar view, which task fields must be visible on cards by default?
24. In kanban view, which fields must be visible on cards by default?
25. What exactly should the timeline show in post-MVP:
   - tasks only;
   - projects only;
   - both?
26. Should heatmap click-through open a filtered task list for the selected day?

### G. Editing and synchronization

27. Which actions must support drag-and-drop in MVP?
28. Which edits must be available inline versus inside a modal?
29. Should creating a task from a note automatically create a backlink to that note?
30. Should a task linked to multiple notes show all links on the card, or only the primary note?
31. What synchronization behavior is required when the user edits raw markdown directly?

### H. Reuse vs simplification of existing `tasknotes`

32. Which current `tasknotes` features do we explicitly keep:
   - calendar views;
   - bases integration;
   - note-per-task storage;
   - time tracking;
   - pomodoro;
   - API;
   - recurring tasks?
33. Which current `tasknotes` features should be hidden from the UI in our product direction?
34. Do we want to keep `TaskNotes` assumptions in code and rebrand later, or start renaming early?
35. Do we want to preserve compatibility with existing TaskNotes data, or treat this as a fork with a stronger project contract?

### I. Analytics and progress

36. Should the heatmap aggregate by local day only?
37. Should progress reporting include project-level completion summaries in MVP?

### J. Scope control

38. What is the smallest slice that would already replace an external task manager for the user?
39. Which features are emotionally important but not actually needed in the first working version?
40. Which feature, if delayed, would make the plugin not usable for daily work?

## Suggested MVP cut

If we want a realistic first shipping target, I recommend this exact MVP:

- dashboard as the main landing surface;
- project note plus project folder model;
- note-based tasks;
- single-project task relationship in MVP;
- related notes links;
- project tree view;
- all tasks view;
- kanban by status;
- month and week calendar;
- period goals as first-class lightweight entities;
- heatmap from completed tasks;
- basic filters and sorts;
- no timeline yet;
- no automations yet;
- no dependencies yet;
- no custom field builder yet;
- no recurring task requirement;
- no full subtask model requirement.

## Suggested implementation order

1. Decide storage and entity model.
2. Decide reuse strategy for the current `tasknotes` codebase.
3. Build or adapt project entity support.
4. Normalize task fields and status model.
5. Implement project tree view.
6. Adapt all tasks list.
7. Adapt kanban.
8. Adapt calendar plus goals block.
9. Implement heatmap.
10. Polish filters, sort, and settings.

## Candidate reference plugins

These are worth studying selectively, not copying blindly.

### Strong reference candidates

- `TaskNotes`
  - We are already using it as the main base because it gives us note-based tasks, calendar-style workflows, and a modular codebase.
- `obsidian-kanban`
  - Useful as a reference for clean kanban UX, drag-and-drop behavior, and card interaction patterns.
- `obsidian-tasks`
  - Useful for query/filter UX, task status ergonomics, and markdown-native task workflows.
- `projects`
  - Useful if you want project-centric UX patterns rather than only task-centric ones.
- `periodic-notes` or calendar-oriented planning plugins
  - Useful for week/month/quarter planning mental models and date navigation patterns.

### Optional deeper references

- heatmap / contribution graph plugins for Obsidian
  - Useful for the progress view interaction model.
- metadata-heavy plugins such as Dataview or Bases-oriented examples
  - Useful if we want strong filter and grouping behavior tied to frontmatter.

## Recommended next workshop topics

We should answer the open questions in this order:

1. Storage model for projects, tasks, and goals.
2. Exact task and project statuses.
3. Relationship between projects and folders/notes.
4. Exact MVP view set and what stays out.
5. What we keep from `tasknotes` and what we strip away.
6. Default UX for calendar, kanban, and project tree.
