# Staff login

Staff login lets an admin, a class teacher, an instructor, or an examiner enter on `/staff` and come back as that same person.

## Sub-features

- `staff-password-login` signs in an admin, a class teacher, or an instructor with the account form.
- `staff-examiner-login` signs in an examiner with name, id number, and phone.
- `staff-session` reads `GET /api/staff/me` with the cookie from the login response.
- `staff-class-scope` keeps class teacher and instructor off `GET /api/exams`.

## How to get to it (user POV)

- Open `/staff`.
- Submit `登录` on the form `login`. The fields are `username` and `password`.
- Submit `考评员登录` on the form `examiner-login`. The fields are `examiner-name`, `examiner-id`, and `examiner-phone`.

## Driving it with verify-classroom

Preconditions:

- Doctor reports `PASS`.
- Launch has seeded the admin, class teacher, instructor, and examiner accounts.

- **Open the page.** `GET /staff` returns 200 and the saved HTML contains `id="login"` and `id="examiner-login"`.
- **Admin.** Submit `登录` as the seeded admin. The helper posts `{username, password}` to `/api/staff/login` with `X-Classroom-Request: staff-login`. Status 200, role `admin`, scope `all`. `GET /api/staff/me` with `__Host-classroom` returns the same role and scope.
- **Class teacher.** Submit `登录` with the seeded phone in `username`. Status 200, role `class_teacher`, scope `own-classes`. `GET /api/exams` returns 403.
- **Instructor.** Submit `登录` with the seeded phone in `username`. Status 200, role `instructor`, scope `own-classes`. `GET /api/exams` returns 403.
- **Examiner.** Submit `考评员登录`. The helper posts `{name, idNumber, phone}`. Status 200, role `examiner`, scope `unfinished-scoring`. The response body has no id number. The same phone in the password form returns 401.
- **Proof.** Run `node .cursor/skills/verify-classroom/scripts/verify-classroom.mjs drive login`. `login/proof.json` lists these four results and `login/staff.html` is the fetched page.

## Gotchas

- The password form label is `账号或手机号`. Admins type the account name. Class teachers and instructors type the phone. The posted field is still `username`.
- A student who uses this form is signed out and stays on `/staff`. Use the candidate page for `student`.
- `staff` remains a legacy role with scope `legacy-staff` and password login. This drive does not create one.
- An examiner created with a password and no id number still uses the password form. The seeded examiner uses the three identity fields, and the password form must fail.
- Scope `own-classes` does not select class rows. This repo has no class list yet, so those roles receive 403 on the existing exam route.
- Scope `unfinished-scoring` is returned on the session. This drive does not open a scoring screen.
- The cookie is `Secure`. The helper sends it on `http://127.0.0.1`. A browser on another plain HTTP host will drop it.
