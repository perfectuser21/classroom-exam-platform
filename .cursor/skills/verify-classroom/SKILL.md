---
name: verify-classroom
description: Verify real classroom login, organization, bank, roster R4 theory, R5 practical exams and R6 seat environment with disposable fixtures and retained evidence.
---

# Verify classroom

Run from this repository root. Exercise `gateway.mjs` at `/staff`, `/classes` and `/candidate`, not `candidate-dev-server.mjs`. Install locked dependencies with `npm ci` and the browser with `PLAYWRIGHT_SKIP_BROWSER_GC=1 npx playwright install chromium`. The gateway requires `~/.credentials/1password.env`, `~/.credentials/classroom-frontend.json`, and the Moodle read API token in `~/.credentials/moodle-pilot-api.json`. Use the credentials skill to refresh secrets from 1Password; never print or commit them. The local Moodle Docker pilot and HTTP bridge must be running. No shared pilot account is altered or required on a roster.

## Launch

`./.cursor/skills/verify-classroom/scripts/verify.sh launch` starts the gateway on loopback port 18199 with temporary `CLASSROOM_STATE_DIR`, synthetic staff accounts, question/paper publication, assignment and release enabled, identity verification required, and candidate materials and uploads enabled. It refuses an occupied port or an outstanding R4 cleanup manifest. Keep all stages in one shell if the runner terminates background processes between calls.

## Doctor

`./.cursor/skills/verify-classroom/scripts/verify.sh doctor` checks both served login pages, the browser runtime, Moodle provisioning/cleanup prerequisites and the enrolled-user API. R5 Doctor also checks that candidate materials and uploads are enabled. Missing prerequisites are explicit FAILs.

## Drive

`./.cursor/skills/verify-classroom/scripts/verify.sh drive` exercises real staff login, organization and role provisioning, specialty and question bank, weighted paper, class/roster and teacher access. The R4 Drive then provisions a disposable phone-username Moodle student and links it to an R3 roster. A real browser creates and assigns a class plan, verifies release guards, releases from the class UI, logs in as the disposable student, submits its answer card and checks the class theory score in both API and UI. Shared candidate credentials are not needed. The same disposable quiz also runs the [R5 practical path](features/practical.md): taskbook and material delivery, browser download and answer upload, two examiner reviews and confirmed weighted score. See [R4 acceptance](features/theory.md).

## Evidence

`./.cursor/skills/verify-classroom/scripts/verify.sh evidence` writes `.classroom-evidence/current/result.txt` (override with `CLASSROOM_VERIFY_RUN`). R0–R5 and cleanup receipts are all required: before Cleanup the result explicitly reports missing cleanup and remains FAIL. Sanitized response bodies, screenshots, logs and check results remain in the run directory. The private `theory-private.json` temporarily contains the disposable password and cleanup ownership manifest; do not copy it into reports or commit any run artifacts.

## Cleanup

Always run `./.cursor/skills/verify-classroom/scripts/verify.sh cleanup`, including after Drive failure. It deletes only the manifest-owned disposable Moodle identity and exam data, verifies shared pilot identities are unchanged, removes the private manifest, stops its gateway and removes temporary state and cookies. It retains evidence and rebuilds `result.txt`. If Moodle cleanup fails, the manifest remains available for retry and the result remains FAIL. Re-read the result after Cleanup. Moodle's standard anonymized deleted-user tombstone remains.

For a single-shell run, ensure Cleanup runs even when Doctor or Drive fails:

```bash
verify=.cursor/skills/verify-classroom/scripts/verify.sh
"$verify" launch || exit 1
trap '"$verify" cleanup' EXIT
"$verify" doctor || true
"$verify" drive || true
"$verify" evidence
"$verify" cleanup
verify_status=$?
trap - EXIT
exit "$verify_status"
```

R6 acceptance is specified in [seat environment](features/seat-env.md); its Doctor and Drive exercise the guarded install and cleanup path, and report FAIL when a disposable Windows seat or installer is unavailable. `seat-env-cleanup.txt` must verify the owned Windows fixture is removed before overall PASS. The combined harness requires R0–R5 evidence and the independent R6 receipts. The harness does not establish student password changes, 50-person browser load or unfinished-only examiner scoring.
