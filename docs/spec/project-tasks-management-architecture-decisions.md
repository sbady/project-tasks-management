# Project Tasks Management Architecture Decisions

## Purpose

This document captures the current architecture choices for MVP in a compact format that we can use directly while writing the technical specification and implementing the plugin.

## Decision table

| Topic | Options considered | Current choice | Why this choice | Risk / tradeoff | Post-MVP note |
|---|---|---|---|---|---|
| Project domain object | Folder only; note only; metadata entity; note + folder pair | `Project = project note + project folder` | Best fit for real vault workflow and strong filtering/linking behavior | Slightly more setup than note-only | Later we can add templates and stronger folder conventions |
| Canonical project reference | Folder path; note path; internal ID | `Project note` is canonical | Notes work naturally with frontmatter, wikilinks, filters, and views | Folder and note can drift without validation | Add repair and consistency checks later |
| Task storage | Inline tasks; hidden DB; task note | `One markdown file per task` | Strong fit for markdown-first, calendar, kanban, and portability | Many files in large vaults | Add indexing and archival strategies later |
| Goal storage | Derived only from tasks; hidden DB; markdown entities | `One markdown file per goal` | Goals are intentions, not just filtered tasks | More authoring UI to design | Add richer goal analytics later |
| User data principle | Mixed storage; hidden-first; markdown-first | `All user data markdown-first` | Preserves transparency, portability, and Obsidian philosophy | Some internals may be less convenient | Keep hidden state limited |
| Hidden state usage | No hidden state; unrestricted hidden state; limited hidden state | `Only cache, index, settings, and UI state may live outside markdown` | Practical balance between purity and performance | Must prevent business logic from drifting into hidden state | Can remain a long-term rule |
| Task to project relation | One project; many projects | `Exactly one primary project in MVP` | Keeps UX, filters, and reporting simple | Cross-project work needs conventions | Could add `relatedProjects` later |
| Default vault layout | Fully free-form; hardcoded structure; recommended structure | `Recommended roots: Inbox, Projects, Tasks, Goals, Resources, Templates, System` | Gives a sane default without forbidding customization | Some users may want immediate reconfiguration | Make paths configurable in settings |
| Dashboard strategy | Projects view; calendar view; dashboard | `Dashboard is the default entry point` | Better daily operating surface than a single structural view | More UI composition work in MVP | Grow into a richer home dashboard later |
| Heatmap metric | Created; edited; completed; time tracked | `Completed tasks only` | Clearest signal of actual output | Ignores effort and partial progress | Add alternate modes later if useful |
| Status model | Large workflow set; compact focused set | `inbox, planned, in_progress, blocked, done, canceled` | Enough structure for planning without too much process overhead | Some edge cases feel compressed | Expand later only if truly needed |
| Priority model | Binary; 3-level; 4-level; custom | `low, normal, high, critical` | Clear and practical for planning and filters | Some users may want custom labels | Add custom priorities later |
| Subtasks | Full entity model; checklist only; none | `No full subtask model in MVP` | Avoids early complexity and edge cases | Some tasks need ad hoc checklists only | Revisit after core flows are stable |
| Dependencies | Full dependency graph; simple blockers; none | `Not in MVP` | Keeps MVP focused on planning and visibility | Limits advanced project management use | Candidate for post-MVP |
| Recurring tasks | Build now; keep legacy optional; postpone | `Not required for MVP` | Reduces redesign complexity in the first release | Existing TaskNotes capability may stay underused initially | Can be revived later |
| TaskNotes legacy features | Remove all; keep all; keep selectively | `Keep note-per-task and multi-view foundations; pomodoro and similar features may remain but are not core MVP` | Pragmatic reuse without letting legacy UX dictate product direction | Codebase may still include non-MVP surfaces | Hide or re-surface intentionally later |
| Compatibility with TaskNotes | Break fully; preserve fully; preserve partially | `Preserve compatibility around task note model where possible, strengthen project contract` | Reuses existing value while adapting to the new domain model | Partial compatibility creates edge cases | Decide later whether this becomes a clean fork or a strong variant |

## Immediate implications for implementation

1. Project creation must create both a project folder and a canonical project note.
2. Task creation must create a standalone task note and assign one primary project when created from project context.
3. Goal creation must create explicit period notes rather than inferred records only.
4. The repository layer must understand:
   - note-to-folder mapping for projects;
   - task-to-project note linking;
   - goal-to-period mapping.
5. Dashboard is a first-class surface in MVP, not an optional later convenience.

## Still open after these decisions

- exact frontmatter schema names;
- naming conventions for files and folders;
- final folder configurability rules;
- final dashboard widget set;
- final kanban and calendar card defaults;
- migration and compatibility depth with existing raw TaskNotes data.
