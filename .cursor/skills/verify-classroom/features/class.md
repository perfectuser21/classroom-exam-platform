# Classes and roster

The gateway drive creates and edits a class attached to a department, specialty and teacher, downloads the CSV template, imports existing student accounts and checks exported usernames, removal, and assigned versus unassigned teacher access. The drive uses synthetic accounts and isolated state. It exercises HTTP APIs; it does not automate the browser or provision Moodle users. The CSV contains a `username` header and one existing student phone number per row.
