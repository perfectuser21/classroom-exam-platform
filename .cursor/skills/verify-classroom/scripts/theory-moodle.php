define('CLI_SCRIPT', true);
require '/var/www/html/config.php';
require_once $CFG->dirroot . '/user/lib.php';
require_once $CFG->dirroot . '/enrol/locallib.php';
require_once $CFG->dirroot . '/webservice/lib.php';
require_once $CFG->dirroot . '/group/lib.php';
require_once $CFG->dirroot . '/course/lib.php';
require_once $CFG->libdir . '/questionlib.php';
\core\session\manager::set_user(get_admin());
$input = json_decode(stream_get_contents(STDIN), true, 32, JSON_THROW_ON_ERROR);
$action = $input['action'] ?? '';
function shared_fingerprint() {
    global $DB;
    $users = $DB->get_records_sql("SELECT DISTINCT u.id,u.username,u.password,u.suspended,u.deleted,u.idnumber FROM {user} u JOIN {user_enrolments} ue ON ue.userid=u.id JOIN {enrol} e ON e.id=ue.enrolid WHERE e.courseid=2 AND (u.idnumber IS NULL OR u.idnumber NOT LIKE :marker) ORDER BY u.id", ['marker' => 'classroom-verify-%']);
    $rows = [];
    foreach ($users as $u) {
        $rows[] = [$u, array_values($DB->get_records('user_enrolments', ['userid'=>$u->id], 'id', 'id,enrolid,userid,status,timestart,timeend')), array_values($DB->get_records('role_assignments', ['userid'=>$u->id], 'id', 'id,roleid,contextid,userid')), array_values($DB->get_records('external_services_users', ['userid'=>$u->id], 'id', 'id,externalserviceid,userid'))];
    }
    return hash('sha256', json_encode($rows, JSON_THROW_ON_ERROR));
}
if ($action === 'doctor') {
    $ok = (bool)$DB->get_record('external_services', ['shortname'=>'classroom_candidate','enabled'=>1]) && (bool)$DB->get_record('role', ['shortname'=>'classroom_ws_pilot']) && (bool)$DB->get_record('question_categories', ['id'=>2]) && !empty($CFG->enableavailability);
    echo json_encode(['ok'=>$ok, 'sharedFingerprint'=>shared_fingerprint()]); exit;
}
$run = $input['runId'] ?? '';
$username = $input['username'] ?? '';
if (!is_string($run) || !preg_match('/^[a-f0-9-]{36}$/', $run) || !is_string($username) || !preg_match('/^1[3-9][0-9]{9}$/', $username)) { throw new RuntimeException('Invalid disposable identity'); }
$marker = 'classroom-verify-' . $run;
if ($action === 'provision') {
    $password = $input['password'] ?? '';
    if (!is_string($password) || strlen($password) < 24 || strlen($password) > 128 || $DB->record_exists('user', ['username'=>$username,'mnethostid'=>$CFG->mnet_localhost_id])) { throw new RuntimeException('Disposable identity unavailable'); }
    $transaction = $DB->start_delegated_transaction();
    $user = (object)['username'=>$username, 'password'=>$password, 'firstname'=>'R4', 'lastname'=>'Verify', 'email'=>$run.'@exam.invalid', 'idnumber'=>$marker, 'auth'=>'manual', 'confirmed'=>1, 'mnethostid'=>$CFG->mnet_localhost_id];
    $id = user_create_user($user, true, true);
    $manual = enrol_get_plugin('manual'); $instance = null;
    foreach (enrol_get_instances(2, true) as $entry) { if ($entry->enrol === 'manual') { $instance = $entry; break; } }
    if (!$manual || !$instance) { throw new RuntimeException('Enrollment unavailable'); }
    $student = $DB->get_record('role', ['shortname'=>'student'], '*', MUST_EXIST);
    $manual->enrol_user($instance, $id, $student->id);
    $role = $DB->get_record('role', ['shortname'=>'classroom_ws_pilot'], '*', MUST_EXIST);
    role_assign($role->id, $id, context_system::instance()->id);
    $service = $DB->get_record('external_services', ['shortname'=>'classroom_candidate','enabled'=>1], '*', MUST_EXIST);
    (new webservice())->add_ws_authorised_user((object)['externalserviceid'=>$service->id,'userid'=>$id]);
    $transaction->allow_commit();
    echo json_encode(['ok'=>true,'userId'=>(int)$id]); exit;
}
if ($action !== 'cleanup') { throw new RuntimeException('Invalid verification action'); }
$paperids = $input['paperIds'] ?? []; $questionids = $input['questionIds'] ?? [];
if (!is_array($paperids) || count($paperids)>4 || !is_array($questionids) || count($questionids)>10) { throw new RuntimeException('Invalid cleanup manifest'); }
foreach (array_merge($paperids, $questionids) as $id) { if (!is_string($id) || !preg_match('/^[a-f0-9-]{36}$/', $id)) { throw new RuntimeException('Invalid resource identity'); } }
$user = $DB->get_record('user', ['username'=>$username,'mnethostid'=>$CFG->mnet_localhost_id]);
if ($user && ($user->idnumber !== $marker || is_siteadmin($user))) { throw new RuntimeException('Refusing unowned user'); }
// Validate all resources before deletion. Only this run's paper/question receipts are accepted.
$cms = []; $groups = []; $questions = [];
foreach ($paperids as $id) {
    foreach (['A','B'] as $v) {
        $key = 'classroom-'.$id.'-'.$v;
        $cm = $DB->get_record('course_modules', ['course'=>2,'idnumber'=>$key]);
        if ($cm) {
            $quiz = $DB->get_record('quiz', ['id'=>$cm->instance,'course'=>2], '*', MUST_EXIST);
            if (strpos($quiz->name, $run) === false) { throw new RuntimeException('Refusing unowned quiz'); }
            $cms[] = $cm;
        }
        $g = $DB->get_record('groups', ['courseid'=>2,'idnumber'=>$key]); if ($g) { $groups[] = $g; }
    }
}
foreach ($questionids as $id) {
    foreach ($DB->get_records('question', ['name'=>'草稿-'.$id]) as $q) {
        if (strpos($q->questiontext, $run) === false) { throw new RuntimeException('Refusing unowned question'); }
        $questions[] = $q;
    }
}
foreach ($cms as $cm) { course_delete_module($cm->id, false); }
foreach ($groups as $g) { if (!groups_delete_group($g)) { throw new RuntimeException('Group cleanup failed'); } }
foreach ($questions as $q) { question_delete_question($q->id); }
$userid = $user ? (int)$user->id : (int)($input['userId'] ?? 0);
if ($user) { webservice::delete_user_ws_tokens($user->id); if (!delete_user($user)) { throw new RuntimeException('User cleanup failed'); } }
if ($userid > 0) {
    $deleted = $DB->get_record('user', ['id'=>$userid]);
    if (!$deleted || !$deleted->deleted || $deleted->username === $username) { throw new RuntimeException('User deletion unconfirmed'); }
    // Moodle retains an anonymized deleted-user tombstone. Purge this disposable user's history.
    foreach (['grade_grades_history','quiz_grades','logstore_standard_log'] as $table) { $DB->delete_records($table, ['userid'=>$userid]); }
    foreach (['external_tokens','external_services_users','user_enrolments','role_assignments','groups_members','grade_grades','quiz_attempts'] as $table) {
        if ($DB->record_exists($table, ['userid'=>$userid])) { throw new RuntimeException('Disposable user data remains'); }
    }
}
foreach ($cms as $cm) { if ($DB->record_exists('course_modules', ['id'=>$cm->id]) || $DB->record_exists('quiz', ['id'=>$cm->instance]) || $DB->record_exists('quiz_attempts', ['quiz'=>$cm->instance]) || $DB->record_exists('grade_items', ['itemmodule'=>'quiz','iteminstance'=>$cm->instance])) { throw new RuntimeException('Quiz cleanup unconfirmed'); } }
foreach ($groups as $g) { if ($DB->record_exists('groups', ['id'=>$g->id])) { throw new RuntimeException('Group remains'); } }
foreach ($questions as $q) { if ($DB->record_exists('question', ['id'=>$q->id])) { throw new RuntimeException('Question remains'); } }
rebuild_course_cache(2, true);
if (!hash_equals($input['sharedFingerprint'] ?? '', shared_fingerprint())) { throw new RuntimeException('Shared pilot identity fingerprint changed'); }
echo json_encode(['ok'=>true,'deletedUser'=>$userid>0,'deletedQuizzes'=>count($cms),'deletedQuestions'=>count($questions),'sharedAccountsUnchanged'=>true]);
