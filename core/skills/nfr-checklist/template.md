# Non-functional requirements: <project>

Date: <YYYY-MM-DD>. Sources: `.forge/project/bootstrap/decisions.md` (D-ids), the stories, measurements.
Every value: its source in brackets, or **assumption (<who confirms>)**.

## 1. Users and usage
| | Value | Source |
|---|---|---|
| Registered users after 1 year | | |
| Daily active users (DAU) | | |
| Peak concurrent users | | |
| Busy period (hours per day) | | |
| Peak factor | | |

## 2. Capacity math
**Requests**
| Flow (operation) | Requests per active user per day | Average req/s | Peak req/s |
|---|---|---|---|
| | | DAU × n ÷ (busy hours × 3600) = | average × peak factor = |

**Data growth**
| Entity | Rows per day | Bytes per row, indexes included (measured or assumed) | Per year | Retention | At the end of retention |
|---|---|---|---|---|---|
| | | | | | |
Files and images: <count per day × average size = per year>.

**Connections:** <API instances> × <pool size> = <n> ≤ <max_connections> − <reserve>.

**What the numbers require:** <instances, indexes, page-size limits, cache or not, and why>.

## 3. Latency and throughput targets (the k6 thresholds)
| Flow | p95 latency | Error rate | Throughput to sustain | Source |
|---|---|---|---|---|
| | < … ms | < 1 % | … req/s | |

## 4. Availability and recovery
Uptime target; maintenance windows; recovery point and time objectives (backups come with staging, decision 70).

## 5. Security
ASVS level (decision 31: Level 2 unless raised); personal data and where it lives; authentication; retention and deletion; audit logging.

## 6. Accessibility and languages
Accessibility level (from the register; no team default); languages; right-to-left; date, number and currency formats.

## 7. Limits and quotas
Upload sizes; page sizes (`limit` 20, at most 100: decision 41); rate limits; timeouts on outbound calls.

## 8. Assumptions to confirm
| Assumption | Used in | Who confirms | Answer |
|---|---|---|---|
| | | | |
