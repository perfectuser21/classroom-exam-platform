# Candidate login

Candidate login has two forms on `/candidate`. The Moodle form uses a candidate account and password. The student form uses a phone and password, then lets that student set a new password.

## Sub-features

- `candidate-moodle-login` signs in through `login-form` and `/api/candidate/login`.
- `student-phone-login` signs in through `student-login-form` and returns role `student`.
- `student-set-password` replaces the student password and rejects the old one.
- `student-scope` keeps the student off `GET /api/exams`.

## How to get to it (user POV)

- Open `/candidate`.
- Submit `登录` on `login-form`. The fields are named `username` and `password`.
- Submit `学员登录` on `student-login-form`. The fields are `student-phone` and `student-pass`.
- After the student home is visible, submit `设置密码` on `student-password-form`. The field is `student-new-pass`.

## Driving it with verify-classroom

Preconditions:

- Doctor reports `PASS`.
- Launch has seeded the student phone account.
- The Moodle entry also needs a service on `127.0.0.1:18088`. This drive does not start one.

- **Open the page.** `GET /candidate` returns 200 and the saved HTML contains `id="login-form"` and `id="student-login-form"`.
- **Student.** Submit `学员登录`. The helper posts `{phone, password}` to `/api/staff/login` with `X-Classroom-Request: staff-login`. Status 200, role `student`, scope `self`. The page shows the heading `学员`.
- **Set password.** Submit `设置密码`. The helper posts `{password}` to `/api/staff/password` with `X-Classroom-Request: staff-password` and the student cookie. Status 200 and body `{ok:true}`.
- **Confirm the change.** The previous password returns 401. The new password returns role `student` and scope `self`.
- **Stay on the student page.** `GET /api/exams` with the student cookie returns 403.
- **Moodle entry.** Do not run it unless `127.0.0.1:18088` answers. If it does not, record the failed `POST /api/candidate/login` and the missing listener. Do not mark `candidate-moodle-login` passed.
- **Proof.** `drive login` writes the student action into `login/proof.json` and saves the fetched page at `login/candidate.html`.

## Gotchas

- `login-form` still posts `{username, password}` to `/api/candidate/login`. A successful student phone login does not prove that form.
- The student home stays hidden when the role is not `student`. The page then calls logout.
- Password length is 12 to 128 characters. A shorter new password stays on `密码未更新`.
- The student cookie is `__Host-classroom`, not `classroom_candidate`.
- Scope `self` does not open an exam attempt. Exam delivery still depends on Moodle.
