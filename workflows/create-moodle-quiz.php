define('CLI_SCRIPT', true);
require '/var/www/html/config.php';
require_once $CFG->dirroot . '/course/modlib.php';
require_once $CFG->dirroot . '/mod/quiz/locallib.php';
\core\session\manager::set_user(get_admin());
$input = json_decode(stream_get_contents(STDIN), true, 32, JSON_THROW_ON_ERROR);
if (!is_array($input) || !preg_match('/^[a-f0-9-]{36}$/', $input['paperId'] ?? '') || !in_array($input['version'] ?? '', ['A', 'B'], true) || !is_string($input['name'] ?? null) || mb_strlen($input['name']) < 1 || mb_strlen($input['name']) > 100 || !is_int($input['duration'] ?? null) || $input['duration'] < 5 || $input['duration'] > 240 || !is_array($input['questions'] ?? null) || count($input['questions']) < 1 || count($input['questions']) > 100) { throw new RuntimeException('Invalid input'); }
if (!is_int($input['deadline'] ?? null) || $input['deadline'] < 0 || ($input['deadline'] !== 0 && $input['deadline'] <= time())) { throw new RuntimeException('Invalid deadline'); }
$course = get_course(2); $moduleid = $DB->get_field('modules', 'id', ['name' => 'quiz'], MUST_EXIST);
$key = 'classroom-' . $input['paperId'] . '-' . $input['version'];
$sourcecontext = context_module::instance(2);
$sourcecategory = $DB->get_record('question_categories', ['id' => 2, 'contextid' => $sourcecontext->id], '*', MUST_EXIST);
$seen = []; $total = 0;
foreach ($input['questions'] as $q) {
    if (!is_array($q) || !preg_match('/^[a-f0-9-]{36}$/', $q['id'] ?? '') || !is_int($q['moodleId'] ?? null) || !is_numeric($q['points'] ?? null) || $q['points'] <= 0 || $q['points'] > 100 || isset($seen[$q['moodleId']])) { throw new RuntimeException('Invalid question'); }
    $params = ['questionid' => $q['moodleId'], 'categoryid' => $sourcecategory->id, 'name' => '草稿-' . $q['id']];
    $sql = 'SELECT q.id FROM {question} q JOIN {question_versions} v ON v.questionid = q.id JOIN {question_bank_entries} e ON e.id = v.questionbankentryid WHERE q.id = :questionid AND e.questioncategoryid = :categoryid AND q.name = :name';
    if (!$DB->record_exists_sql($sql, $params)) { throw new RuntimeException('Question is not in pilot bank'); }
    $seen[$q['moodleId']] = true; $total += (float)$q['points'];
}
function verify_pilot_quiz($cm, $input, $total) {
    global $DB;
    if ($cm->visible || (int)$cm->course !== 2) { return false; }
    $quiz = $DB->get_record('quiz', ['id' => $cm->instance, 'course' => 2]);
    if (!$quiz || (int)$quiz->questionsperpage !== 0 || (int)$quiz->timelimit !== $input['duration'] * 60 || (int)$quiz->timeclose !== $input['deadline'] || abs((float)$quiz->sumgrades - $total) > 0.0001 || abs((float)$quiz->grade - $total) > 0.0001) { return false; }
    $sql = 'SELECT slot.id, version.questionid, slot.maxmark FROM {quiz_slots} slot JOIN {question_references} ref ON ref.itemid = slot.id AND ref.component = :component AND ref.questionarea = :area JOIN {question_versions} version ON version.questionbankentryid = ref.questionbankentryid AND version.version = COALESCE(ref.version, (SELECT MAX(v2.version) FROM {question_versions} v2 WHERE v2.questionbankentryid = ref.questionbankentryid)) WHERE slot.quizid = :quizid ORDER BY slot.slot';
    $slots = array_values($DB->get_records_sql($sql, ['component' => 'mod_quiz', 'area' => 'slot', 'quizid' => $quiz->id]));
    if (count($slots) !== count($input['questions'])) { return false; }
    foreach ($slots as $i => $slot) { if ((int)$slot->questionid !== $input['questions'][$i]['moodleId'] || abs((float)$slot->maxmark - (float)$input['questions'][$i]['points']) > 0.0001) { return false; } }
    return true;
}
$existing = $DB->get_record('course_modules', ['course' => $course->id, 'module' => $moduleid, 'idnumber' => $key]);
if ($existing) {
    if (!verify_pilot_quiz($existing, $input, $total)) { throw new RuntimeException('Existing quiz needs review'); }
    echo json_encode(['ok' => true, 'paperId' => $input['paperId'], 'version' => $input['version'], 'quizId' => (int)$existing->instance, 'courseModuleId' => (int)$existing->id, 'hidden' => true]); exit;
}
$record = (object)[
 'modulename' => 'quiz', 'module' => $moduleid, 'course' => $course->id, 'section' => 0, 'visible' => 0, 'visibleoncoursepage' => 0,
 'cmidnumber' => $key, 'name' => '试点草稿 ' . $input['name'] . ' [' . $input['version'] . ']', 'intro' => '试点草稿，尚未开放。', 'introformat' => FORMAT_PLAIN,
 'timeopen' => 0, 'timeclose' => $input['deadline'], 'timelimit' => $input['duration'] * 60, 'preferredbehaviour' => 'deferredfeedback', 'attempts' => 1,
 'attemptonlast' => 0, 'grademethod' => QUIZ_GRADEHIGHEST, 'decimalpoints' => 2, 'questiondecimalpoints' => -1, 'questionsperpage' => 0,
 'shuffleanswers' => 0, 'sumgrades' => 0, 'grade' => $total, 'overduehandling' => 'autosubmit', 'graceperiod' => 0,
 'quizpassword' => '', 'subnet' => '', 'browsersecurity' => '', 'delay1' => 0, 'delay2' => 0, 'showuserpicture' => 0, 'showblocks' => 0,
 'navmethod' => QUIZ_NAVMETHOD_FREE, 'groupmode' => 0, 'groupingid' => 0
];
$PAGE->set_context(context_course::instance($course->id));
$transaction = $DB->start_delegated_transaction();
ob_start();
$created = add_moduleinfo($record, $course);
$quiz = $DB->get_record('quiz', ['id' => $created->instance], '*', MUST_EXIST);
$quiz->cmid = $created->coursemodule;
foreach ($input['questions'] as $q) { if (quiz_add_quiz_question($q['moodleId'], $quiz, 0, (float)$q['points']) === false) { throw new RuntimeException('Cannot add question'); } }
\mod_quiz\quiz_settings::create($quiz->id)->get_grade_calculator()->recompute_quiz_sumgrades();
$createdcm = $DB->get_record('course_modules', ['id' => $quiz->cmid], '*', MUST_EXIST);
if (!verify_pilot_quiz($createdcm, $input, $total)) { throw new RuntimeException('Quiz verification failed'); }
ob_end_clean();
$transaction->allow_commit();
echo json_encode(['ok' => true, 'paperId' => $input['paperId'], 'version' => $input['version'], 'quizId' => (int)$quiz->id, 'courseModuleId' => (int)$quiz->cmid, 'hidden' => true]);
