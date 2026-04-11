# Knowledge Base Agent Core (KVAS) — интеграция с Obsidian-плагином

## 1. Что такое KVAS
Knowledge Base Agent Core (KVAS) — это не “умный чат” и не “AI note writer”.
Это KB-backed система управления разработкой продукта, где:

- знание и контекст живут в Markdown и являются truth layer;
- агенты — заменяемые исполнители;
- orchestration управляет стадиями, артефактами и валидацией;
- Obsidian-плагин — рабочий thin client.

## 2. Цель интеграции
Связать orchestration/agent core с локальной knowledge base через простой, понятный UI в Obsidian.
Плагин должен дать пользователю:

- обзор состояния проекта по стадиям;
- видимость артефактов и их статусов;
- запуск типизированных agent task;
- review/publish/reindex действия;
- доступ к контексту и lineage.

## 3. Что уже закрыто плагином
Функции, которые уже работают и считаются baseline:

- проекты/задачи/цели как markdown-сущности;
- связь задач с проектами и целями;
- dashboard с фокусом, планированием, прогрессом;
- backlog/planned/in_progress/blocked/done/canceled;
- календарь, канбан, agenda, общий список;
- Canvas-генерация карты проекта (project → goals → tasks → steps).

## 4. Что должен закрывать orchestration (и не переносится в плагин)
- truth policy и публикация;
- контекстная сборка, retrieval, lineage-graph;
- выбор агента и контракт исполнения;
- validation и критерии приемки;
- хранение execution traces и промежуточных черновиков.

## 5. Требования к плагину как thin client
Плагин отвечает за интерфейс и рабочие действия:

- отображать текущую стадию проекта;
- показывать обязательные артефакты стадии;
- запускать typed tasks;
- показывать результат и статус (draft/review/published);
- навигация по связанным источникам;
- быстрые действия: review, publish, reindex.

## 6. Карта интерфейсов (минимальный набор)
1. Home / Command Center
   - фокус, планы, прогресс, цели, быстрые действия.
2. Planning Dashboard
   - today/week/calendar/backlog.
3. Projects Dashboard
   - список проектов, статус, прогресс, доступ к workspace проекта.
4. Project Workspace
   - цели/эпики/этапы, задачи, материалы, запуск agent tasks.
5. Artifacts & Stages
   - стадия, список артефактов, review/publish.
6. Canvas / Map
   - карта проекта и связей.

## 7. Эволюция Canvas
Canvas уже доступен как автогенерация структуры.
Следующий уровень:

- ручная настройка визуала;
- фильтры (по статусам/проектам);
- режимы: “План”, “Артефакты”, “Релизы”;
- двусторонний режим (опционально): изменения на canvas → markdown.

## 8. Стадии и артефакты (канонический цикл)
1. Idea & Problem
2. Project Card
3. Scope & Boundaries
4. User Scenarios
5. System Design
6. Implementation Plan
7. Development Tasks
8. Review
9. Test / Report
10. Release Decision

Каждая стадия должна иметь типизированный артефакт и критерии приемки.

## 9. Вывод
KVAS строится вокруг workflow + KB + orchestration.
Плагин — это интерфейс и операционная панель, а не мозг системы.
