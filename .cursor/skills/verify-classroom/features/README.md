# Feature map

| Feature | Surface | Acceptance | Evidence |
| --- | --- | --- | --- |
| [Staff login](staff-login.md) | `/staff` | synthetic phone identity authenticates via real gateway | `staff-drive.txt`, `staff-login.json` |
| [Candidate login](candidate-login.md) | `/candidate` | dedicated Moodle test identity authenticates via real gateway | `candidate-drive.txt`, `candidate-login.json` |
| [Organization and roles](org.md) | `/api/org` | admin CRUD and five role assignments through the real gateway | `org-drive.txt` |

| [Specialty and theory bank](bank.md) | `/api/standards`, `/api/questions`, `/api/papers` | define specialty and level, maintain and classify a question, build a weighted draft | `bank-drive.txt` |

Doctor checks both pages; the drives are independent. PASS requires all and evidence retained after cleanup. Login is not a permission-scope test.
