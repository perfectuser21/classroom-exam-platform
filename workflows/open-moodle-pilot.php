define('CLI_SCRIPT', true);
require '/var/www/html/config.php';
require_once $CFG->dirroot . '/group/lib.php';
require_once $CFG->dirroot . '/course/lib.php';
\core\session\manager::set_user(get_admin());
$input = json_decode(stream_get_contents(STDIN), true, 32, JSON_THROW_ON_ERROR);
if (empty($CFG->enableavailability) || !is_array($input) || !preg_match('/^[a-f0-9-]{36}$/', $input['paperId'] ?? '') || !is_array($input['groups'] ?? null) || count($input['groups']) < 1 || count($input['groups']) > 2) { throw new RuntimeException('Invalid release'); }
$course = get_course(2); $eligible = classroom_enrolled_students($course->id);
if (count($eligible) < 1 || count($eligible) > 50) { throw new RuntimeException('Course student count unsupported'); }
$assigned = []; $versions = []; $modules = [];
foreach ($input['groups'] as $group) {
    if (!is_array($group) || !in_array($group['version'] ?? '', ['A', 'B'], true) || isset($versions[$group['version']]) || !is_int($group['quizId'] ?? null) || !is_int($group['courseModuleId'] ?? null) || !is_int($group['groupId'] ?? null) || !is_array($group['studentIds'] ?? null) || count($group['studentIds']) < 1) { throw new RuntimeException('Invalid version'); }
    $versions[$group['version']] = true;
    foreach ($group['studentIds'] as $id) { if (!is_int($id) || !in_array($id, $eligible, true) || isset($assigned[$id])) { throw new RuntimeException('Invalid student'); } $assigned[$id] = true; }
    $key = 'classroom-' . $input['paperId'] . '-' . $group['version'];
    $cm = $DB->get_record('course_modules', ['id' => $group['courseModuleId'], 'course' => $course->id, 'idnumber' => $key], '*', MUST_EXIST);
    $storedgroup = $DB->get_record('groups', ['id' => $group['groupId'], 'courseid' => $course->id, 'idnumber' => $key], '*', MUST_EXIST);
    if ($cm->visible || (int)$cm->instance !== $group['quizId'] || empty($cm->availability)) { throw new RuntimeException('Quiz is not prepared and hidden'); }
    $quiz = $DB->get_record('quiz', ['id' => $group['quizId'], 'course' => $course->id], '*', MUST_EXIST);
    if ((int)$quiz->timelimit < 300 || (int)$quiz->timelimit > 14400 || ((int)$quiz->timeclose !== 0 && (int)$quiz->timeclose <= time()) || (int)$quiz->questionsperpage !== 0 || (int)$quiz->attempts !== 1) { throw new RuntimeException('Quiz settings not supported'); }
    $sql = 'SELECT slot.id, slot.page, q.id AS questionid, q.qtype FROM {quiz_slots} slot JOIN {question_references} ref ON ref.itemid = slot.id AND ref.component = :component AND ref.questionarea = :area JOIN {question_versions} version ON version.questionbankentryid = ref.questionbankentryid AND version.version = COALESCE(ref.version, (SELECT MAX(v2.version) FROM {question_versions} v2 WHERE v2.questionbankentryid = ref.questionbankentryid)) JOIN {question} q ON q.id = version.questionid WHERE slot.quizid = :quizid ORDER BY slot.slot';
    $slots = $DB->get_records_sql($sql, ['component' => 'mod_quiz', 'area' => 'slot', 'quizid' => $quiz->id]);
    if (!$slots || count($slots) !== $DB->count_records('quiz_slots', ['quizid' => $quiz->id])) { throw new RuntimeException('Quiz questions invalid'); }
    foreach ($slots as $slot) {
        if ((int)$slot->page !== 1 || !in_array($slot->qtype, ['multichoice', 'truefalse', 'shortanswer', 'essay'], true)) { throw new RuntimeException('Quiz question unsupported'); }
        if ($slot->qtype === 'essay') {
            if (($input['allowEssay'] ?? false) !== true) { throw new RuntimeException('Essay question not enabled'); }
            $options = (array)$DB->get_record('qtype_essay_options', ['questionid' => $slot->questionid], 'responseformat,responserequired,attachments,attachmentsrequired', MUST_EXIST);
            if (!classroom_essay_policy($options)) { throw new RuntimeException('Unsupported essay configuration'); }
        }
        if ($slot->qtype === 'shortanswer') {
            if (($input['allowFill'] ?? false) !== true) { throw new RuntimeException('Fill question not enabled'); }
            $usecase = $DB->get_field('qtype_shortanswer_options', 'usecase', ['questionid' => $slot->questionid], MUST_EXIST);
            $answers = $DB->get_records('question_answers', ['question' => $slot->questionid], 'id', 'id,answer,fraction');
            $policy = array_map(fn($answer) => ['answer' => $answer->answer, 'fraction' => $answer->fraction], array_values($answers));
            if (!classroom_fill_policy($usecase, $policy)) { throw new RuntimeException('Unsupported fill scoring policy'); }
        }
        if ($slot->qtype === 'multichoice' && (int)$DB->get_field('qtype_multichoice_options', 'single', ['questionid' => $slot->questionid], MUST_EXIST) !== 1) { $answers = $DB->get_records('question_answers', ['question' => $slot->questionid], 'id', 'id,fraction'); $fractions = array_map(fn($answer) => (float)$answer->fraction, array_values($answers)); if (!classroom_multiple_policy($fractions)) { throw new RuntimeException('Unsupported multiple scoring policy'); } }
    }

    $members = groups_get_members($storedgroup->id, 'u.id'); $memberids = array_map('intval', array_keys($members)); sort($memberids); $expected = $group['studentIds']; sort($expected);
    if ($memberids !== $expected) { throw new RuntimeException('Group membership changed'); }
    $info = new \core_availability\info_module(get_fast_modinfo($course->id)->get_cm($cm->id));
    foreach ($eligible as $id) { $details = ''; if ($info->is_available($details, false, $id) !== in_array($id, $expected, true)) { throw new RuntimeException('Availability changed'); } }
    $modules[] = ['version' => $group['version'], 'id' => (int)$cm->id, 'quizId' => (int)$cm->instance];
}
$ids = array_map('intval', array_keys($assigned)); sort($ids); if (!classroom_participants($eligible, $ids)) { throw new RuntimeException('Invalid assigned students'); }
$transaction = $DB->start_delegated_transaction();
foreach ($modules as $module) { set_coursemodule_visible($module['id'], 1, 1, false); $check = $DB->get_record('course_modules', ['id' => $module['id']], 'id,visible,availability', MUST_EXIST); if (!$check->visible || empty($check->availability)) { throw new RuntimeException('Release not confirmed'); } }
$transaction->allow_commit(); rebuild_course_cache($course->id, true);
echo json_encode(['ok' => true, 'paperId' => $input['paperId'], 'open' => true, 'modules' => $modules]);
