# Feature map

| Feature | Surface | Acceptance | Evidence |
| --- | --- | --- | --- |
| [Staff login](staff-login.md) | `/staff` | synthetic phone identity authenticates via real gateway | `staff-drive.txt`, `staff-login.json` |
| [Candidate login](candidate-login.md) | `/candidate` | dedicated Moodle test identity authenticates via real gateway | `candidate-drive.txt`, `candidate-login.json` |

Doctor checks both pages; the two drives are independent. PASS requires both and evidence retained after cleanup. Login is not a permission-scope test.
