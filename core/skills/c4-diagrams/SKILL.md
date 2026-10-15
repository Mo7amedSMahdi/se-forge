---
name: c4-diagrams
description: Drawing a system's architecture as C4 diagrams in Mermaid (decision 66) - the system context and the containers, components only where a container is complex - kept as Markdown in docs/architecture/ next to the code and checked to render. Use when the architecture is first described, when a container, external system or major flow is added or removed, and when reviewing such a change.
---

# C4 diagrams in Mermaid

`examples/context.md` and `examples/containers.md` describe the kit's users sample; `forge docs check`
renders them with mermaid-cli 12 (`tests/architecture/run.sh`). Mermaid marks its C4 support as
experimental: render every diagram before it is merged. GitLab and GitHub render Mermaid in Markdown
with their own versions; that rendering has not been checked yet.

## Levels (one diagram each, one file each, in `docs/architecture/`)
- **Context** (`context.md`, `C4Context`): the system as one box, the people who use it and the external systems it talks to (payment provider, identity provider, e-mail, the client's existing systems).
- **Containers** (`containers.md`, `C4Container`): what is deployed: the web app, the API, workers, the database, caches, queues, each with its technology, and how they talk (protocol, sync or async). A table under it maps each container to its image and repository.
- **Components** (`components-<container>.md`, `C4Component`): only for a container whose inside a reader cannot guess from its code layout. Most projects have none.
- No class-level diagrams; the code is the reference.

## Syntax (as used in the examples)
```
C4Container
  title Containers: <system>
  Person(alias, "Label", "What they do")
  System_Ext(alias, "Label", "What it is")
  Container_Boundary(alias, "System") {
    Container(alias, "Label", "Technology", "Responsibility")
    ContainerDb(alias, "Label", "Technology", "What it stores")
  }
  Rel(from, to, "What happens", "Protocol")
```
`Person_Ext`, `SystemDb`, `ContainerQueue` and `Component` follow the same pattern. Labels in the project's documentation language; one relationship per real call path, named by what happens, not "uses".

## Steps
1. Start from the register (systems, integrations, D-ids) and the stack decisions; draft in `.forge/project/architecture/` (or on the ticket's branch for a change to existing diagrams).
2. Above each diagram: what it shows and the D-ids it relies on. Below the containers diagram: the container-to-image table.
3. `forge docs check <file>` until every diagram renders.
4. Changes to the containers (a new service, database, queue or external system) go with an ADR (skill `adr-writer`).

## Done when
- the context and container diagrams exist in `docs/architecture/`, one level per file, and match what is deployed;
- every element has its technology, every relationship its purpose and protocol;
- `forge docs check` renders every diagram.
