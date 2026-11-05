#!/usr/bin/env bash
set -u
cd "$(git rev-parse --show-toplevel)" || exit 1
base=http://127.0.0.1:18199
run=${CLASSROOM_VERIFY_RUN:-.classroom-evidence/current}
mkdir -p "$run"
run=$(cd "$run" && pwd)
case "${1:-}" in
 launch)
  if curl -fsS "$base/candidate" >/dev/null 2>&1; then echo 'FAIL: port 18199 already occupied'; exit 1; fi
  rm -f "$run/doctor.txt" "$run/staff-drive.txt" "$run/candidate-drive.txt" "$run/result.txt" "$run/staff-login.json" "$run/candidate-login.json" "$run/org-drive.txt"
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
  CLASSROOM_STATE_DIR="$state" CLASSROOM_PORT=18199 CLASSROOM_ENABLE_STAFF_AUTH=1 node gateway.mjs >"$run/gateway.log" 2>&1 &
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
  if grep -q '^FAIL' "$run/doctor.txt"; then exit 1; fi ;;
 drive)
  code=$(curl -sS -o "$run/staff-login.json" -w '%{http_code}' -c "$run/cookies.tmp" -H 'Content-Type: application/json' -H 'X-Classroom-Request: staff-login' --data '{"username":"13800138001","password":"Verify-only-password-2026!"}' "$base/api/staff/login" 2>/dev/null || true)
  if [ "$code" = 200 ] && node -e "const x=require(process.argv[1]);process.exit(x.role==='class_teacher'?0:1)" "$run/staff-login.json"; then echo 'PASS staff login: class_teacher'; else echo "FAIL staff login HTTP ${code:-unreachable}"; fi | tee "$run/staff-drive.txt"
  node .cursor/skills/verify-classroom/scripts/org-drive.mjs "$run/org-drive.txt"
  if [ -z "${CLASSROOM_VERIFY_CANDIDATE_USER:-}" ] || [ -z "${CLASSROOM_VERIFY_CANDIDATE_PASSWORD:-}" ]; then echo 'FAIL candidate login: dedicated Moodle test credentials not supplied' | tee "$run/candidate-drive.txt"; exit 1; fi
  payload=$(node -e "process.stdout.write(JSON.stringify({username:process.env.CLASSROOM_VERIFY_CANDIDATE_USER,password:process.env.CLASSROOM_VERIFY_CANDIDATE_PASSWORD}))")
  code=$(curl -sS -o "$run/candidate-login.json" -w '%{http_code}' -H 'Content-Type: application/json' -H 'X-Classroom-Request: candidate' --data "$payload" "$base/api/candidate/login" 2>/dev/null || true)
  if [ "$code" = 200 ] && node -e "const x=require(process.argv[1]);process.exit(x.ok===true?0:1)" "$run/candidate-login.json"; then echo 'PASS candidate Moodle login'; else echo "FAIL candidate login HTTP ${code:-unreachable}"; fi | tee "$run/candidate-drive.txt"
  if grep -q '^FAIL' "$run/staff-drive.txt" "$run/candidate-drive.txt" "$run/org-drive.txt"; then exit 1; fi ;;
 evidence)
  for f in doctor.txt staff-drive.txt candidate-drive.txt org-drive.txt; do if [ ! -s "$run/$f" ]; then echo "FAIL missing $run/$f"; exit 1; fi; done
  cat "$run/doctor.txt" "$run/staff-drive.txt" "$run/candidate-drive.txt" "$run/org-drive.txt" | tee "$run/result.txt"
  echo "Evidence: $run"
  if grep -q '^FAIL' "$run/result.txt"; then exit 1; fi ;;
 cleanup)
  if [ -f "$run/gateway.pid" ]; then pid=$(cat "$run/gateway.pid"); if ps -p "$pid" -o command= | grep -q 'node gateway.mjs'; then kill "$pid" 2>/dev/null || true; fi; rm -f "$run/gateway.pid"; fi
  if [ -f "$run/state-path" ]; then state=$(cat "$run/state-path"); case "$state" in "${TMPDIR:-/tmp}/classroom-verify."*) rm -rf "$state";; *) echo 'FAIL: refusing unexpected state path'; exit 1;; esac; rm -f "$run/state-path"; fi
  rm -f "$run/cookies.tmp"
  echo "Cleanup: ephemeral state removed; evidence retained at $run" ;;
 *) echo 'Usage: verify.sh launch|doctor|drive|evidence|cleanup'; exit 2 ;;
esac
