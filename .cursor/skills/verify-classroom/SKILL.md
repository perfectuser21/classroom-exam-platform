---
name: verify-classroom
description: "Drive classroom-exam-platform login on staff.html and candidate.html and prove the admin, student, class teacher, instructor, and examiner roles. Use when changing login, roles, or account storage, or when a change must show PASS evidence."
---

# Verify classroom login

Drive the real gateway from this repo. The pages are `staff.html` at `/staff` and `candidate.html` at `/candidate`. Prove a login by the HTTP status, the role, the scope, and a second read of the session. Keep the evidence after cleanup.

Run every command from the repository root.

## Launch

Install dependencies once when `node_modules/sharp` does not load. Gateway imports `sharp` through `question-image.mjs` before it listens.

```
npm ci
```

Start one isolated instance.

```
node .cursor/skills/verify-classroom/scripts/verify-classroom.mjs launch
```

Optional `VERIFY_PORT` defaults to `18111`. Optional `VERIFY_RUN_ID` names the run. Launch prints the evidence directory.

Launch creates `CLASSROOM_STATE_DIR` at `/tmp/verify-classroom/<run-id>`, sets `CLASSROOM_ENABLE_STAFF_AUTH=1`, and seeds five accounts before the process listens. Ready means stdout contains `本地管理页面已启动` and both login pages return HTML. A process that exits before that line is not ready.

If `~/.credentials/1password.env` or `~/.credentials/classroom-frontend.json` is missing, launch creates only the missing file and records the path in `scaffolding.json`. The env file is a comment. The frontend file is a local basic-auth stub. Cleanup deletes only those created paths.

Do not launch a second gateway on the same port. If the port is taken, launch exits and names the port. Choose another `VERIFY_PORT`. Do not stop a process you did not start.

## Doctor

```
node .cursor/skills/verify-classroom/scripts/verify-classroom.mjs doctor
```

Doctor is read-only. It passes only when all of these are true.

- The pid file belongs to a live `gateway.mjs` whose `CLASSROOM_STATE_DIR` is this run.
- `GET /staff` is 200 and contains `id="login"` and `id="examiner-login"`.
- `GET /candidate` is 200 and contains `id="login-form"` and `id="student-login-form"`.

Doctor writes `/tmp/verify-classroom-evidence/<run-id>/doctor.json`. A missing pid, a dead pid, or a page without those ids is `result` `FAIL` and a non-zero exit. Do not drive a failed doctor.

## Drive

The harness is `verify-classroom.mjs`. It sends the same JSON the page scripts send. There is no Playwright suite in this repo.

```
node .cursor/skills/verify-classroom/scripts/verify-classroom.mjs drive login
```

`drive login` refuses to run until `doctor.json` says `PASS`. It loads `/staff` and `/candidate`, then performs these posts to `POST /api/staff/login` with header `X-Classroom-Request: staff-login`.

- `staff.html` form `login` sends `{username, password}` for the admin, the class teacher, and the instructor.
- `staff.html` form `examiner-login` sends `{name, idNumber, phone}`.
- `candidate.html` form `student-login-form` sends `{phone, password}`.

After each success it calls `GET /api/staff/me` with the returned `__Host-classroom` cookie. The class teacher, instructor, and student then call `GET /api/exams` and must get 403. The student calls `POST /api/staff/password` with header `X-Classroom-Request: staff-password`, then logs in again with the new password. The old password must get 401. An identity examiner must get 401 from the password form.

Fixture values stay inside the helper. Evidence must not contain those passwords, the examiner name, or the examiner id number.

The Moodle form `login-form` on `candidate.html` is a separate entry. This drive does not call it. Do not treat the phone login as proof of that form.

## Evidence

The evidence directory is `/tmp/verify-classroom-evidence/<run-id>/`. Launch prints it. `drive login` writes these files.

- `doctor.json` with `"result": "PASS"`
- `login/staff.html` and `login/candidate.html`, the pages that were fetched
- `login/proof.json` and `report.json` with `"result": "PASS"`, the role, and the scope for each action

```
node .cursor/skills/verify-classroom/scripts/verify-classroom.mjs evidence
```

That command exits 0 only when `report.json`, `doctor.json`, and `login/proof.json` exist and the report result is `PASS`.

A pass requires the real pages and the login responses. A unit test, a mocked account object, or a skipped doctor is not a pass. If launch cannot listen, it writes `launch.json` with `result` `FAIL` and the log tail. Leave that failure in place. Do not change the report to `PASS`.

## Cleanup

```
node .cursor/skills/verify-classroom/scripts/verify-classroom.mjs cleanup
```

Cleanup sends `SIGTERM`, then `SIGKILL` if needed, only to the pid that is still `gateway.mjs` for this run's state directory. It deletes `/tmp/verify-classroom/<run-id>` and the credential files listed in that run's `scaffolding.json`. It does not delete `/tmp/verify-classroom-evidence/<run-id>`. After cleanup, `evidence` must still print `PASS` and the same directory.

Run cleanup after a failed launch too, so a half-started pid and a stub credential file do not remain.

## Helpers

The helper is `.cursor/skills/verify-classroom/scripts/verify-classroom.mjs`. Invoke it from the repository root.

```
node .cursor/skills/verify-classroom/scripts/verify-classroom.mjs launch
node .cursor/skills/verify-classroom/scripts/verify-classroom.mjs doctor
node .cursor/skills/verify-classroom/scripts/verify-classroom.mjs drive login
node .cursor/skills/verify-classroom/scripts/verify-classroom.mjs evidence
node .cursor/skills/verify-classroom/scripts/verify-classroom.mjs cleanup
```

Two instances need two `VERIFY_RUN_ID` values and two `VERIFY_PORT` values. They do not share a state directory.

This VM did not have `node_modules` or `~/.credentials`. The recorded pass installed `sharp` with npm and let launch create the two missing credential files. A lab machine that already has `npm ci` and those files will not repeat those two steps. Moodle on `127.0.0.1:18088`, MeshCentral, and the Windows seat hosts were not running. The login drive does not call them.

Keep this map current with `/maintain-verification-skill` when routes or login fields change.
