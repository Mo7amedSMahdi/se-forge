---
name: add-entity
description: Add a new stored entity end to end in the right order - data model, migration (db lane), entity or model and repository, then the API operations from the approved contract (api lane), each with tests. Used by the planner to order the items, and by the db and backend engineers for their parts.
---

# Add an entity

Order, and who does it:
1. **Data model** (planner, skill `data-model-design`): the entity in the plan's data model section, with fields, keys, relations, constraints and indexes.
2. **Contract** (contract-analyst, skill `api-contract-design`), only if the entity is exposed through the API: its schema and operations, approved and tagged before step 4.
3. **db lane** (`db-engineer`, skill `db-migration`):
   - a new migration that creates the table or collection, its constraints and its indexes;
   - the entity or model class and its mapping, following the closest existing entity;
   - seed or reference data only when the plan asks for it;
   - tested up, down and up on a throwaway container.
4. **api lane** (`backend-engineer`, skill `new-endpoint`):
   - the repository or data-access methods the operations need, with tests against the container database (or the project's existing data-layer test setup);
   - the operations from the approved contract, each with its tests.
5. **ui lane** (`frontend-engineer`), when the plan has UI items: `forge api generate` from the approved version, then the screens.
6. **mobile lane** (`mobile-engineer`), when the plan has mobile items: the same, in the Flutter app (skills `new-screen`, `flutter-form`).

Each lane commits and pushes on the plan's branch before the next starts. The lead removes the finished lane's worktree before spawning the next lane on the same branch.

## Done when
- the entity is in the plan's data model section and, if exposed, in an approved contract version;
- its migration ran up, down and up on a throwaway container and is on the plan's branch;
- every operation that uses it has its tests, and `forge gates` is green on the pushed branch.
