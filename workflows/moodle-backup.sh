#!/bin/bash
set -euo pipefail
umask 077
state=${CLASSROOM_STATE_DIR:-"$HOME/.local/share/classroom-exam"}
root=${CLASSROOM_BACKUP_ROOT:-"$state/backups"}
docker=${CLASSROOM_DOCKER:-docker}
moodle_source=${CLASSROOM_MOODLE_SOURCE:-"$HOME/perfect21/moodle-classroom-pilot/moodle"}
moodle_git=${CLASSROOM_MOODLE_GIT:-git}
project=$(cd "$(dirname "$0")/.." && pwd)
mkdir -p "$root"
chmod 700 "$root"
staging=$(mktemp -d "$root/.moodle-$(date +%Y%m%d-%H%M%S)-XXXXXX")
cleanup() { if [[ -n "$staging" && -d "$staging" ]]; then rm -rf -- "$staging"; fi; }
trap cleanup EXIT
if [[ -n "$("$moodle_git" -C "$moodle_source" status --porcelain --untracked-files=all)" ]]; then
  printf 'Moodle 程序存在未记录改动，已停止备份。\n' >&2
  exit 1
fi
ignored=$("$moodle_git" -C "$moodle_source" ls-files --others --ignored --exclude-standard)
while IFS= read -r path; do
  if [[ -n "$path" && "$path" != 'config.php' ]]; then
    printf 'Moodle 程序存在未归档文件，已停止备份。\n' >&2
    exit 1
  fi
done <<< "$ignored"
if "$moodle_git" -C "$moodle_source" cat-file -e HEAD:config.php 2>/dev/null; then
  printf 'Moodle 配置不应包含在程序快照中，已停止备份。\n' >&2
  exit 1
fi
revision=$("$moodle_git" -C "$moodle_source" rev-parse HEAD)
if [[ ! "$revision" =~ ^[0-9a-f]{40}$ ]]; then
  printf 'Moodle 程序版本不可用，已停止备份。\n' >&2
  exit 1
fi
"$moodle_git" -C "$moodle_source" archive --format=tar HEAD | gzip -c > "$staging/moodle-code.tar.gz"
gzip -t "$staging/moodle-code.tar.gz"
tar -tzf "$staging/moodle-code.tar.gz" >/dev/null
if [[ "$("$moodle_git" -C "$moodle_source" rev-parse HEAD)" != "$revision" || -n "$("$moodle_git" -C "$moodle_source" status --porcelain --untracked-files=all)" ]]; then
  printf 'Moodle 程序在备份期间发生变化，已停止备份。\n' >&2
  exit 1
fi
printf '%s\n' "$revision" > "$staging/moodle-code-revision.txt"
node "$project/backup-runtime-snapshot.mjs" > "$staging/runtime-manifest.json"
moodle_db=$("$docker" exec classroom_moodle_pilot-webserver-1 php -r 'define("CLI_SCRIPT", true); require "/var/www/html/config.php"; echo $CFG->dbname;')
backup_db=$("$docker" exec classroom_moodle_pilot-db-1 sh -c 'printf %s "$POSTGRES_DB"')
if [[ -z "$moodle_db" || "$moodle_db" != "$backup_db" ]]; then
  printf 'Moodle 数据库与备份目标不一致，已停止备份。\n' >&2
  exit 1
fi
"$docker" exec classroom_moodle_pilot-db-1 sh -c 'exec pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > "$staging/database.dump"
"$docker" exec -i classroom_moodle_pilot-db-1 pg_restore --list < "$staging/database.dump" >/dev/null
"$docker" exec classroom_moodle_pilot-webserver-1 tar -C /var/www -czf - moodledata > "$staging/moodledata.tar.gz"
gzip -t "$staging/moodledata.tar.gz"
tar -tzf "$staging/moodledata.tar.gz" >/dev/null
tar -czf "$staging/frontend-state.tar.gz" --exclude='./backups' --exclude='./installers' --exclude='./wheelhouses' --exclude='./logs' --exclude='./meshcentral-data' --exclude='./meshcentral-generated-initial' -C "$state" .
gzip -t "$staging/frontend-state.tar.gz"
tar -tzf "$staging/frontend-state.tar.gz" >/dev/null
(cd "$project" && git ls-files -z | tar -czf "$staging/source-code.tar.gz" --null -T -)
gzip -t "$staging/source-code.tar.gz"
tar -tzf "$staging/source-code.tar.gz" >/dev/null
chmod 600 "$staging"/*
final="$root/${staging##*/.}"
mv "$staging" "$final"
staging=''
printf '备份完成：%s\n' "$final"
