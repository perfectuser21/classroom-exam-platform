# Feature map

| Feature | Surface | Acceptance | Evidence |
| --- | --- | --- | --- |
| [Staff login](staff-login.md) | `/staff` | synthetic phone identity authenticates via real gateway | `staff-drive.txt`, `staff-login.json` |
| [Candidate login](candidate-login.md) | `/candidate` | dedicated Moodle test identity authenticates via real gateway | `candidate-drive.txt`, `candidate-login.json` |
| [Organization and roles](org.md) | `/api/org` | admin CRUD and five role assignments through the real gateway | `org-drive.txt` |

| [Specialty and theory bank](bank.md) | `/api/standards`, `/api/questions`, `/api/papers` | define specialty and level, maintain and classify a question, build a weighted draft | `bank-drive.txt` |

Doctor checks both pages; the drives are independent. PASS requires all and evidence retained after cleanup. Login is not a permission-scope test.

| [Classes and roster](class.md) | `/classes`, `/api/classes` | create and edit class; import/export roster and verify teacher ownership | `class-drive.txt` |

| [R4 theory E2E](theory.md) | `/classes`, `/api/class-exam-plans`, `/candidate` | disposable phone student: class plan → guarded UI release → real answer-card submit → class theory score, followed by verified cleanup | `theory-doctor.txt`, `theory-drive.txt`, screenshots, `r4-class-scores.json`, `theory-cleanup.txt` |

R0–R5 PASS requires all Drive receipts plus Moodle and local cleanup. Evidence remains FAIL while cleanup is pending. R4 and R5 use browser interaction; the earlier R0–R3 drives remain HTTP-driven.

| [R5 practical E2E](practical.md) | `/candidate`, practical plan, delivery and review APIs | taskbook and source delivery → browser download and answer upload → two examiner reviews → confirmed weighted score | `practical-doctor.txt`, `practical-drive.txt`, `r5-candidate-upload.png` |

| [R6 seat environment](seat-env.md) | catalog, one-click install and cleanup | real Windows seat installation, health check and scoped cleanup with independent readback | `seat-env-doctor.txt`, `seat-env-drive.txt`, `seat-env-cleanup.txt`, screenshots and receipts |

R6 reports FAIL when a disposable Windows seat or installer is unavailable. Overall evidence requires its Doctor, Drive and owned-fixture cleanup receipts in addition to the independent R0–R5 result. See the R6 feature document for verification scope and remaining gaps.
