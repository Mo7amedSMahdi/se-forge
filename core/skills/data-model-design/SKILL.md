---
name: data-model-design
description: Design the data model change for one plan - entities, fields, keys, relations, constraints, indexes - as a reviewed section of the plan with an ER diagram, before any migration is written. Used by the planner and the db-engineer on plans with the db area.
---

# Design the data model change

## Procedure
1. Read the current model: the newest migrations (`ls` the migrations folder, read the last few), the entities or models the ticket touches, and the existing naming. Keep the existing conventions: table and column case, id type, timestamps, soft delete. A new project takes them from its stack reference and ADRs.
2. From the story and the contract, list what is stored: entities, fields (type, nullability, default), and who owns each entity's lifecycle.
3. Keys and relations: a primary key per entity; each relation with its cardinality and what happens on delete (restrict by default; cascade only for owned children).
4. Constraints: unique, check and not-null rules from the story's data rules. They belong in the database, not only in code.
5. Indexes: every foreign key, every column the plan's queries filter, join or sort on, and every uniqueness rule. Note the expected row counts when known.
6. Change safety: is any part destructive (drop, rename, narrowing a type, a new NOT NULL column on existing rows)? Then plan expand → migrate → contract over separate releases, with backfills as their own migrations (skill `db-migration`).
7. Personal data: mark the fields that hold it. They go into the plan's threat model (skill `threat-model`).

## In the plan: section "Data model"
- A Mermaid `erDiagram` of the entities this ticket adds or changes, and their direct neighbours only.
- A table: entity · field · type · null · default · constraint · index · personal data.
- The migration steps in order, each marked additive or destructive.
- Questions with a recommended default, like every plan question.

MongoDB: collections, document shape, embedded or referenced, JSON schema validation, and indexes. The same rules apply otherwise.

## Done when
- the plan has the data model section: diagram, field table, migration steps marked additive or destructive;
- every foreign key and every filtered or sorted column has an index decision;
- destructive steps are split into expand → migrate → contract, and personal data is marked for the threat model.
