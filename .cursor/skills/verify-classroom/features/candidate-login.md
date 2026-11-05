# Candidate login

Doctor checks `/candidate`. Drive posts dedicated test Moodle credentials to `/api/candidate/login` and requires HTTP 200 with `ok: true`. The gateway calls the existing Moodle integration; no mock or substitute service counts. Without test credentials or a reachable Moodle backend, record FAIL. This does not prove phone-only policy or self-service password changes.
