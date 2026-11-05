---
name: verify-classroom
description: Verify the actual classroom gateway login surfaces and retain evidence.
---

# Verify classroom

Run from this repository root. This exercises `gateway.mjs` at `/staff` and `/candidate`, not `candidate-dev-server.mjs`. Install locked dependencies with `npm ci`. The gateway requires `~/.credentials/1password.env` at startup and `~/.credentials/classroom-frontend.json` for authenticated management routes. Never copy credentials into evidence. Candidate login additionally needs an isolated Moodle test account and the configured Moodle/SSH connectivity. No Moodle account is created or altered by this script.

## Launch

`./.cursor/skills/verify-classroom/scripts/verify.sh launch` starts the gateway on loopback port 18199 with a temporary `CLASSROOM_STATE_DIR`, staff auth enabled, and a synthetic class teacher. It refuses an occupied port. It does not reuse the production state directory. Keep all stages in the same shell if your runner terminates background processes between commands.

## Doctor

`./.cursor/skills/verify-classroom/scripts/verify.sh doctor` checks both served login pages. HTTP 200 alone does not prove authentication or Moodle availability.

## Drive

Set `CLASSROOM_VERIFY_CANDIDATE_USER` and `CLASSROOM_VERIFY_CANDIDATE_PASSWORD` in the environment to a dedicated Moodle test account, then run `./.cursor/skills/verify-classroom/scripts/verify.sh drive`. The script submits the real login APIs and checks the class teacher role and Moodle login response. Missing credentials are an explicit candidate FAIL. This is HTTP-driven verification, not a browser interaction or proof of class/course isolation.

## Evidence

Run `./.cursor/skills/verify-classroom/scripts/verify.sh evidence`. Artifacts live under `.classroom-evidence/current/` (override with `CLASSROOM_VERIFY_RUN`); `result.txt` is PASS only if both surfaces pass. HTML snapshots, sanitized response bodies, logs and text results remain there. Do not commit artifacts containing real identity data. See `features/` for feature-specific acceptance and limitations.

## Cleanup

Always run `./.cursor/skills/verify-classroom/scripts/verify.sh cleanup`, even on failure. It stops only the gateway it launched, deletes its temporary state and cookie, and retains the evidence directory. Re-read `result.txt` after cleanup. This loop does not establish student password changes, scoped class access, or unfinished-only examiner scoring.
