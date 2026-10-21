#!/usr/bin/env bash
# OpenProject, through its REST API v3 (curl + jq). Set project.tracker to "openproject" to use it.
# Reads, by name only, from the environment (export them in the shell profile):
#   OPENPROJECT_URL           e.g. https://openproject.example.com (no trailing slash needed)
#   OPENPROJECT_API_KEY       My account > Access tokens > API
#   OPENPROJECT_PROJECT       the project identifier (from the URL /projects/<identifier>), its numeric id,
#                             or the pasted project URL
#   OPENPROJECT_READY_STATUS  optional: the status `ready` moves a ticket to and `list ready` reads (default "Todo")
#   OPENPROJECT_BOARD         optional: the id of a basic board (/boards/<id>) whose columns are kept in step
# - A ticket is a work package; its status and type are OpenProject's own. Done, Closed and Resolved are
#   ordinary statuses there (OpenProject closes by status), so `status <id> Closed` is enough.
# - OpenProject has no labels: --source/--area/--repo go into a "Labels:" line at the end of the description.
# - A basic board's columns are hand-ordered lists, not statuses. With OPENPROJECT_BOARD set, `list board`
#   shows its columns, `status` also moves the card to the column for the new status (op_column), and
#   `create --column` puts the new card in that column. Without it, `list board` groups by status and
#   --column becomes the status when one with that name exists.
# The API key goes to curl through a config file descriptor, never in an argument or in output.
tk_need curl openproject
tk_need jq openproject

for v in OPENPROJECT_URL OPENPROJECT_API_KEY OPENPROJECT_PROJECT; do
  if [[ -z "${!v:-}" ]]; then echo "tracker(openproject): $v is not set (export it in your shell profile)" >&2; exit 2; fi
done
op_base="${OPENPROJECT_URL%/}/api/v3"
# Accept a pasted project URL or path as well as the bare identifier.
OPENPROJECT_PROJECT="${OPENPROJECT_PROJECT##*/projects/}"; OPENPROJECT_PROJECT="${OPENPROJECT_PROJECT%%/*}"
op_ready="${OPENPROJECT_READY_STATUS:-Todo}"
op_board="${OPENPROJECT_BOARD:-}"

# op_call <METHOD> <path under /api/v3> [json body]
op_call() {
  local method="$1" path="$2" body="${3:-}" out code
  out="$(curl -sS -K <(printf 'user = "apikey:%s"\n' "$OPENPROJECT_API_KEY") -X "$method" \
    -H 'Content-Type: application/json' ${body:+--data-binary "$body"} \
    -w '\n%{http_code}' "$op_base$path")" || { echo "tracker(openproject): $method $path failed to connect" >&2; return 1; }
  code="${out##*$'\n'}"; out="${out%$'\n'*}"
  if [[ "$code" != 2* ]]; then
    echo "tracker(openproject): $method $path -> HTTP $code $(jq -r '.message // empty' <<<"$out" 2>/dev/null)" >&2
    return 1
  fi
  printf '%s' "$out"
}
op_write() {
  if tk_dry; then echo "DRY RUN: $1 $2 ${3:+<${#3} bytes>}" >&2; printf '{}'; return 0; fi
  op_call "$@"
}
op_q() { jq -rn --arg s "$1" '$s | @uri'; }
# op_wps <filters json>: the project's work packages matching the filters
op_wps() {
  op_call GET "/projects/$OPENPROJECT_PROJECT/work_packages?pageSize=500&sortBy=$(op_q '[["id","asc"]]')&filters=$(op_q "$1")" | jq '._embedded.elements'
}
op_open='[{"status":{"operator":"o","values":null}}]'
# op_href <collection> <name>: the href of the status/type with that name (case-insensitive), or nothing
op_href() {
  local list
  case "$1" in
    statuses) list="$(op_call GET /statuses)" ;;
    types) list="$(op_call GET "/projects/$OPENPROJECT_PROJECT/types")" ;;
  esac || return 1
  jq -r --arg n "$2" '._embedded.elements[] | select((.name | ascii_downcase) == ($n | ascii_downcase)) | ._links.self.href' <<<"$list" | head -n 1
}

op_who='(._links.assignee.title // "-")'
op_line='"#\(.id) \(.subject)  [\(._links.status.title)]  \('"$op_who"')"'

tr_get() {
  local id="${1:?forge tracker get needs a ticket id}" wp
  wp="$(op_call GET "/work_packages/$id")" || return 1
  if [[ "${2:-}" == "--json" ]]; then printf '%s\n' "$wp"; return; fi
  jq -r --arg url "${OPENPROJECT_URL%/}" '
    "#\(.id) \(.subject)  status=\(._links.status.title)  type=\(._links.type.title)  assignee=\('"$op_who"')",
    "url: \($url)/work_packages/\(.id)", "--- description", (.description.raw // "")' <<<"$wp"
}

tr_statuses() {
  echo "== statuses"; op_call GET /statuses | jq -r '._embedded.elements[] | "  \(.name)\(if .isClosed then "  (closed)" else "" end)"'
  echo "== types"; op_call GET "/projects/$OPENPROJECT_PROJECT/types" | jq -r '._embedded.elements[] | "  \(.name)"'
}

# op_status_filter <status name>: a filter on that status, or fails when there is none
op_status_filter() {
  local href; href="$(op_href statuses "$1")"
  [[ -n "$href" ]] || { echo "tracker(openproject): no status named '$1' (forge tracker statuses lists them)" >&2; return 1; }
  jq -cn --arg id "${href##*/}" '[{"status":{"operator":"=","values":[$id]}}]'
}

tr_list() {
  local what="${1:-board}" f
  shift || true
  case "$what" in
    open) op_wps "$op_open" | jq -r ".[] | $op_line" ;;
    ready) f="$(op_status_filter "$op_ready")" || return 1; op_wps "$f" | jq -r ".[] | $op_line" ;;
    status) f="$(op_status_filter "${1:?forge tracker list status needs the status name}")" || return 1
      op_wps "$f" | jq -r ".[] | $op_line" ;;
    json) op_wps "$op_open" | jq --arg url "${OPENPROJECT_URL%/}" '[.[] | {id, title: .subject,
        labels: [("type::" + ._links.type.title), ("status::" + ._links.status.title)], state: "opened",
        createdAt, updatedAt, author: ._links.author.title, url: "\($url)/work_packages/\(.id)"}]' ;;
    board) local board q name
      board="$(op_board_id "${1:-}")"
      if [[ -z "$board" ]]; then
        op_wps "$op_open" | jq -r 'group_by(._links.status.title)[] |
          "== \(.[0]._links.status.title)", (.[] | "  #\(.id) \(.subject)  \('"$op_who"')")'
        return
      fi
      op_columns "$board" | while IFS=$'\t' read -r q name; do
        echo "== $name"
        op_call GET "/queries/$q?pageSize=500" | jq -r '._embedded.results._embedded.elements[]? |
          "  #\(.id) \(.subject)  [\(._links.status.title)]  \('"$op_who"')"'
      done ;;
    *) echo "tracker list: what to list? board, status <name>, open, ready or json" >&2; return 1 ;;
  esac
}

# op_board_id [<board>]: a numeric --board wins; a name (issues, frontend, …) means OPENPROJECT_BOARD.
op_board_id() { if [[ "${1:-}" =~ ^[0-9]+$ ]]; then echo "$1"; else echo "$op_board"; fi; }

# op_columns <board id>: "<query id>\t<column name>" per column, left to right
op_columns() {
  local q
  op_call GET "/grids/$1" | jq -r '.widgets | sort_by(.startColumn)[] | .options.queryId // empty' | while read -r q; do
    printf '%s\t%s\n' "$q" "$(op_call GET "/queries/$q?pageSize=0" | jq -r .name)"
  done
}

# op_column <status>: the board column a status belongs in; a status not listed goes to the column of its own name.
# Nothing for Todo and Ready for Development, so a card the owner placed by hand stays where it is.
op_column() {
  case "$(printf '%s' "$1" | tr '[:upper:]' '[:lower:]')" in
    todo|"ready for development") ;;
    "in development"|"code review") echo "In Process" ;;
    "in testing"|"ready for qa"|"in qa") echo "In Testing" ;;
    "ready for release") echo "To Be Deployed" ;;
    done|closed|resolved) echo "Complete" ;;
    rejected) echo "Canceled" ;;
    "on hold"|blocked|pending) echo "Pending" ;;
    *) echo "$1" ;;
  esac
}

# op_place <wp id> <column name> [<board>]: take the card out of every other column and add it to the end of this one.
op_place() {
  local id="$1" column="$2" board cols target q name order max
  board="$(op_board_id "${3:-}")"
  [[ -n "$board" && -n "$column" ]] || return 0
  cols="$(op_columns "$board")" || return 1
  target="$(awk -F'\t' -v c="$column" 'tolower($2) == tolower(c) { print $1; exit }' <<<"$cols")"
  [[ -n "$target" ]] || { echo "card not moved: board $board has no column named '$column'" >&2; return 0; }
  while IFS=$'\t' read -r q name; do
    order="$(op_call GET "/queries/$q/order")" || return 1
    if [[ "$q" == "$target" ]]; then
      jq -e --arg id "$id" 'has($id)' <<<"$order" >/dev/null && { echo "card already in '$name'"; return 0; }
      max="$(jq '[.[]] | max // -1' <<<"$order")"
    elif jq -e --arg id "$id" 'has($id)' <<<"$order" >/dev/null; then
      op_write PATCH "/queries/$q/order" "$(jq -cn --arg id "$id" '{delta: {($id): -1}}')" >/dev/null || return 1
    fi
  done <<<"$cols"
  op_write PATCH "/queries/$target/order" "$(jq -cn --arg id "$id" --argjson p "$((max + 1))" '{delta: {($id): $p}}')" >/dev/null \
    && echo "card moved to '$column' on board $board"
}

op_comment() {
  op_write POST "/work_packages/$1/activities" "$(jq -cn --arg t "$2" '{comment: {raw: $t}}')" >/dev/null
}

# op_set_status <id> <status name>
op_set_status() {
  local id="$1" href lock
  href="$(op_href statuses "$2")"
  [[ -n "$href" ]] || { echo "tracker(openproject): no status named '$2' (forge tracker statuses lists them)" >&2; return 1; }
  lock="$(op_call GET "/work_packages/$id" | jq -r .lockVersion)" || return 1
  op_write PATCH "/work_packages/$id" "$(jq -cn --argjson l "$lock" --arg h "$href" '{lockVersion: $l, _links: {status: {href: $h}}}')" >/dev/null
}

tr_status() {
  local id="${1:?forge tracker status needs a ticket id}" status="${2:?forge tracker status needs the status name}" note
  note="$(tk_note "${@:3}")"
  op_set_status "$id" "$status" || { echo "tracker: could not set the status of #$id" >&2; return 1; }
  [[ -z "$note" ]] || { op_comment "$id" "$note" && echo "commented"; }
  echo "#$id -> status $status"
  op_place "$id" "$(op_column "$status")" || echo "card not moved on board $op_board" >&2
}

tr_ready() {
  local id="${1:?forge tracker ready needs a ticket id}" note
  note="$(tk_note "${@:2}")"
  op_set_status "$id" "$op_ready" || return 1
  [[ -z "$note" ]] || op_comment "$id" "$note"
  echo "#$id -> $op_ready"
}

tr_comment() {
  local id="${1:?forge tracker comment needs a ticket id}" text
  case "${2:-}" in
    --file) text="$(<"${3:?forge tracker comment --file needs a file}")" ;;
    *) text="${2:?forge tracker comment needs the text}" ;;
  esac
  op_comment "$id" "$text" || return 1
  echo "commented on #$id"
}

tr_create() {
  tk_create_args "$@" || return 1
  local type_href status_href desc body created id rel status="$tk_status" pair labels=()
  for pair in ${tk_extra[@]+"${tk_extra[@]}"}; do labels+=("${pair%% *}::${pair#* }"); done
  desc="$tk_desc"
  [[ ${#labels[@]} -eq 0 ]] || desc+=$'\n\n'"Labels: ${labels[*]}"
  # Without a basic board, a column is read as a status.
  [[ -n "$(op_board_id "$tk_board")" || -z "$tk_board" || -z "$(op_href statuses "$tk_column")" ]] || status="$tk_column"
  type_href="$(op_href types "$tk_type")"
  [[ -n "$type_href" ]] || { echo "tracker(openproject): the project has no type named '$tk_type'" >&2; return 1; }
  status_href="$(op_href statuses "$status")"
  body="$(jq -cn --arg s "$tk_subject" --arg d "$desc" --arg t "$type_href" \
    '{subject: $s, description: {format: "markdown", raw: $d}, _links: {type: {href: $t}}}')"
  if tk_dry; then
    echo "DRY RUN: POST /projects/$OPENPROJECT_PROJECT/work_packages subject='$tk_subject' type=$tk_type status=$status relates=${tk_relates[*]-} <${#desc} chars>" >&2
    [[ -z "$tk_board" || -z "$(op_board_id "$tk_board")" ]] || echo "DRY RUN: place the card in '$tk_column' on board $(op_board_id "$tk_board")" >&2
    return 0
  fi
  created="$(op_call POST "/projects/$OPENPROJECT_PROJECT/work_packages" "$body")" || return 1
  id="$(jq -r .id <<<"$created")"
  printf 'created #%s  %s/work_packages/%s\n' "$id" "${OPENPROJECT_URL%/}" "$id"
  if [[ -n "$status_href" && "$(jq -r ._links.status.href <<<"$created")" != "$status_href" ]]; then
    op_set_status "$id" "$status" || echo "status '$status' not set; the work package keeps its initial status" >&2
  fi
  for rel in ${tk_relates[@]+"${tk_relates[@]}"}; do
    op_call POST "/work_packages/$id/relations" \
      "$(jq -cn --arg to "/api/v3/work_packages/$rel" '{type: "relates", _links: {to: {href: $to}}}')" >/dev/null \
      && echo "relates to #$rel" || echo "relation to #$rel not created" >&2
  done
  [[ -z "$tk_board" ]] || op_place "$id" "$tk_column" "$tk_board" || echo "card not placed in '$tk_column'" >&2
  return 0
}
