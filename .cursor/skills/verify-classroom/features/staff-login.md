# Staff login

Launch creates a temporary class teacher account using `AccountStore` and starts the real `gateway.mjs`. Doctor checks `/staff`; Drive posts to `/api/staff/login` and expects HTTP 200 and `class_teacher`. Cleanup deletes the test account and session state, retaining the evidence. The test does not prove browser interaction or class ownership enforcement.
