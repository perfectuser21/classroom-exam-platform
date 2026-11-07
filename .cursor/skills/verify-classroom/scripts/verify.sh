#!/usr/bin/env bash
set -u
cd "$(git rev-parse --show-toplevel)" || exit 1
base=http://127.0.0.1:18199
run=${CLASSROOM_VERIFY_RUN:-.classroom-evidence/current}
mkdir -p "$run"
run=$(cd "$run" && pwd)
evidence_files='doctor.txt theory-doctor.txt staff-drive.txt candidate-drive.txt org-drive.txt bank-drive.txt class-drive.txt theory-drive.txt theory-cleanup.txt local-cleanup.txt'
render_evidence() {
  : > "$run/result.txt"
  for f in $evidence_files; do
    if [ -s "$run/$f" ]; then cat "$run/$f" >> "$run/result.txt"; else echo "FAIL missing $f" >> "$run/result.txt"; fi
  done
  if grep -q '^FAIL' "$run/result.txt"; then echo 'FAIL verify-classroom R0–R4 (including cleanup)' >> "$run/result.txt"; else echo 'PASS verify-classroom R0–R4 theory E2E (including cleanup)' >> "$run/result.txt"; fi
  for f in seat-env-doctor.txt seat-env-drive.txt seat-env-cleanup.txt; do
    if [ -s "$run/$f" ]; then cat "$run/$f" >> "$run/result.txt"; else echo "FAIL missing $f" >> "$run/result.txt"; fi
  done
  if grep -q '^FAIL' "$run/result.txt"; then echo 'FAIL verify-classroom R6 seat install and cleanup' >> "$run/result.txt"; else echo 'PASS verify-classroom R6 seat install and cleanup' >> "$run/result.txt"; fi
  cat "$run/result.txt"
  ! grep -q '^FAIL' "$run/result.txt"
}
case "${1:-}" in
 launch)
  if curl -fsS "$base/candidate" >/dev/null 2>&1; then echo 'FAIL: port 18199 already occupied'; exit 1; fi
  if [ -f "$run/theory-private.json" ] || [ -f "$run/seat-env-private.json" ]; then echo 'FAIL: previous R4 cleanup pending; run cleanup first'; exit 1; fi
  for f in $evidence_files seat-env-doctor.txt seat-env-drive.txt seat-env-cleanup.txt; do rm -f "$run/$f"; done
  rm -f "$run/doctor.txt" "$run/staff-drive.txt" "$run/candidate-drive.txt" "$run/result.txt" "$run/staff-login.json" "$run/candidate-login.json" "$run/org-drive.txt" "$run/bank-drive.txt" "$run/class-drive.txt"
  state=$(mktemp -d "${TMPDIR:-/tmp}/classroom-verify.XXXXXXXX") || exit 1
  echo "$state" > "$run/state-path"
  CLASSROOM_VERIFY_STATE="$state" node --input-type=module <<'NODE'
import {AccountStore} from './account-store.mjs';
import {FileJobStorage} from './job-storage.mjs';
const a=new AccountStore({storage:new FileJobStorage(process.env.CLASSROOM_VERIFY_STATE+'/staff-accounts.json')});
await a.create({username:'13800138001',password:'Verify-only-password-2026!',role:'class_teacher'});
await a.create({username:'verify_admin',password:'Verify-only-admin-password-2026!',role:'admin'});
NODE
  if [ $? -ne 0 ]; then echo 'FAIL: cannot seed test account'; exit 1; fi
  CLASSROOM_STATE_DIR="$state" CLASSROOM_PORT=18199 CLASSROOM_ENABLE_STAFF_AUTH=1 CLASSROOM_ENABLE_QUESTION_PUBLISH=1 CLASSROOM_ENABLE_PAPER_PUBLISH=1 CLASSROOM_ENABLE_ASSIGNMENT=1 CLASSROOM_ENABLE_EXAM_RELEASE=1 CLASSROOM_REQUIRE_IDENTITY_VERIFICATION=1 node gateway.mjs >"$run/gateway.log" 2>&1 &
  echo $! > "$run/gateway.pid"
  for i in {1..30}; do if curl -fsS "$base/staff" >/dev/null 2>&1; then echo 'Launch: gateway running'; exit 0; fi; if ! kill -0 "$(cat "$run/gateway.pid")" 2>/dev/null; then echo 'FAIL: gateway exited; see gateway.log'; exit 1; fi; sleep 1; done
  echo 'FAIL: gateway did not become ready; see gateway.log'; exit 1 ;;
 doctor)
  result=0
  for surface in staff candidate; do
   code=$(curl -sS -o "$run/$surface.html" -w '%{http_code}' "$base/$surface" 2>/dev/null || true)
   if [ "$code" = 200 ] && grep -q '登录' "$run/$surface.html"; then echo "PASS $surface page HTTP 200"; else echo "FAIL $surface page HTTP ${code:-unreachable}"; result=1; fi
  done | tee "$run/doctor.txt"
  # Pipeline subshell cannot propagate result: verify evidence explicitly.
  node .cursor/skills/verify-classroom/scripts/seat-env-doctor.mjs "$run" || result=1
  node .cursor/skills/verify-classroom/scripts/theory-drive.mjs doctor "$run" || result=1
  if [ "$result" -ne 0 ]; then exit 1; fi
  if grep -q '^FAIL' "$run/doctor.txt" "$run/theory-doctor.txt"; then exit 1; fi ;;
 drive)
  drive_status=0
  code=$(curl -sS -o "$run/staff-login.json" -w '%{http_code}' -c "$run/cookies.tmp" -H 'Content-Type: application/json' -H 'X-Classroom-Request: staff-login' --data '{"username":"13800138001","password":"Verify-only-password-2026!"}' "$base/api/staff/login" 2>/dev/null || true)
  if [ "$code" = 200 ] && node -e "const x=require(process.argv[1]);process.exit(x.role==='class_teacher'?0:1)" "$run/staff-login.json"; then echo 'PASS staff login: class_teacher'; else echo "FAIL staff login HTTP ${code:-unreachable}"; fi | tee "$run/staff-drive.txt"
  node .cursor/skills/verify-classroom/scripts/org-drive.mjs "$run/org-drive.txt" || drive_status=1
  node .cursor/skills/verify-classroom/scripts/bank-drive.mjs "$run/bank-drive.txt" || drive_status=1
  node .cursor/skills/verify-classroom/scripts/class-drive.mjs "$run/class-drive.txt" || drive_status=1
  node .cursor/skills/verify-classroom/scripts/theory-drive.mjs drive "$run" || drive_status=1
  node .cursor/skills/verify-classroom/scripts/seat-env-drive.mjs drive "$run" || drive_status=1
  if [ "$drive_status" -ne 0 ]; then exit 1; fi
  if grep -q '^FAIL' "$run/staff-drive.txt" "$run/candidate-drive.txt" "$run/org-drive.txt" "$run/bank-drive.txt" "$run/class-drive.txt" "$run/theory-drive.txt"; then exit 1; fi ;;
 evidence)
  render_evidence; exit $? ;;
 cleanup)
  cleanup_status=0
  node .cursor/skills/verify-classroom/scripts/seat-env-drive.mjs cleanup "$run" || cleanup_status=1
  node .cursor/skills/verify-classroom/scripts/theory-drive.mjs cleanup "$run" || cleanup_status=1
  if [ -f "$run/gateway.pid" ]; then pid=$(cat "$run/gateway.pid"); if ps -p "$pid" -o command= | grep -q 'node gateway.mjs'; then kill "$pid" 2>/dev/null || true; fi; rm -f "$run/gateway.pid"; fi
  if [ ! -f "$run/seat-env-private.json" ] && [ -f "$run/state-path" ]; then state=$(cat "$run/state-path"); case "$state" in "${TMPDIR:-/tmp}/classroom-verify."*) rm -rf "$state";; *) echo 'FAIL: refusing unexpected state path'; exit 1;; esac; rm -f "$run/state-path"; fi
  rm -f "$run/cookies.tmp"
  echo 'PASS local gateway, temporary class state and cookies cleanup' > "$run/local-cleanup.txt"
  echo "Cleanup: ephemeral state removed; evidence retained at $run"
  render_evidence || cleanup_status=1
  exit "$cleanup_status" ;;
 *) echo 'Usage: verify.sh launch|doctor|drive|evidence|cleanup'; exit 2 ;;
esac
