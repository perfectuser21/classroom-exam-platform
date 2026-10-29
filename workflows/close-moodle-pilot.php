define('CLI_SCRIPT', true);
require '/var/www/html/config.php';
require_once $CFG->dirroot . '/course/lib.php';
\core\session\manager::set_user(get_admin());
$input = json_decode(stream_get_contents(STDIN), true, 32, JSON_THROW_ON_ERROR);
if (!is_array($input) || !preg_match('/^[a-f0-9-]{36}$/', $input['paperId'] ?? '') || !is_array($input['modules'] ?? null) || count($input['modules']) < 1 || count($input['modules']) > 2) { throw new RuntimeException('Invalid close request'); }
$course = get_course(2); $seen = []; $modules = [];
foreach ($input['modules'] as $module) {
    if (!is_array($module) || !in_array($module['version'] ?? '', ['A', 'B'], true) || isset($seen[$module['version']]) || !is_int($module['quizId'] ?? null) || !is_int($module['courseModuleId'] ?? null)) { throw new RuntimeException('Invalid module'); }
    $seen[$module['version']] = true;
    $key = 'classroom-' . $input['paperId'] . '-' . $module['version'];
    $cm = $DB->get_record('course_modules', ['id' => $module['courseModuleId'], 'course' => $course->id, 'idnumber' => $key], '*', MUST_EXIST);
    if ((int)$cm->instance !== $module['quizId'] || empty($cm->availability)) { throw new RuntimeException('Pilot identity changed'); }
    $modules[] = ['version' => $module['version'], 'id' => (int)$cm->id, 'quizId' => (int)$cm->instance];
}
$transaction = $DB->start_delegated_transaction();
foreach ($modules as $module) { $cm = $DB->get_record('course_modules', ['id' => $module['id']], '*', MUST_EXIST); if ($cm->visible) { set_coursemodule_visible($module['id'], 0, 0, false); } $check = $DB->get_record('course_modules', ['id' => $module['id']], 'id,visible', MUST_EXIST); if ($check->visible) { throw new RuntimeException('Close not confirmed'); } }
$transaction->allow_commit(); rebuild_course_cache($course->id, true);
echo json_encode(['ok' => true, 'paperId' => $input['paperId'], 'closed' => true, 'modules' => $modules]);
