# Classroom login verification map

This directory is the source for the user-facing login behavior of classroom-exam-platform. Read this index, then follow one feature file. Do not mark a feature passed because a different entry point worked.

## Baseline preconditions

- Run from the repository root.
- `node_modules/sharp` imports. If it does not, run `npm ci` before launch.
- Launch with `node .cursor/skills/verify-classroom/scripts/verify-classroom.mjs launch`.
- The gateway listens on `127.0.0.1` and `VERIFY_PORT` or `18111`.
- `CLASSROOM_STATE_DIR` is `/tmp/verify-classroom/<run-id>`.
- `CLASSROOM_ENABLE_STAFF_AUTH=1`.
- Doctor reports `PASS` for this run's pid, `/staff`, and `/candidate`.
- Do not drive a gateway this run did not start.

## Driving conventions

- Start from the seeded accounts created by launch.
- Send the field names in the feature file. Do not rename them.
- Run the helper from the repository root.
- Keep `/tmp/verify-classroom-evidence/<run-id>` after cleanup.

## Proof and skip reporting

- Record the page, the form id, the request fields, the status, the role, and the scope.
- A mutation also needs a second request that shows the new state. For a password change, the old password returns 401 and the new password returns the same role.
- Do not write fixture passwords, the examiner name, or the id number into evidence.
- If an entry point cannot run, write the command and the missing precondition. Do not claim it passed through another form.

## Feature entry contract

Each feature file has one H1, one opening paragraph, and these H2 headings in order.

1. `Sub-features`
2. `How to get to it (user POV)`
3. `Driving it with verify-classroom`
4. `Gotchas`

## Features

- [Staff login](./staff-login.md) covers the account form and the examiner form on `/staff`.
- [Candidate login](./candidate-login.md) covers the Moodle form and the student phone form on `/candidate`.
