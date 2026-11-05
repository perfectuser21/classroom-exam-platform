define('CLI_SCRIPT', true);
require '/var/www/html/config.php';
require_once $CFG->dirroot . '/group/lib.php';
require_once $CFG->dirroot . '/course/lib.php';
\core\session\manager::set_user(get_admin());
$input = json_decode(stream_get_contents(STDIN), true, 32, JSON_THROW_ON_ERROR);
if (empty($CFG->enableavailability) || !is_array($input) || !preg_match('/^[a-f0-9-]{36}$/', $input['paperId'] ?? '') || !is_array($input['groups'] ?? null) || count($input['groups']) < 1 || count($input['groups']) > 2) { throw new RuntimeException('Invalid pilot assignment'); }
$course = get_course(2); $eligibleids = classroom_enrolled_students($course->id);
if (count($eligibleids) < 1 || count($eligibleids) > 50) { throw new RuntimeException('Course student count unsupported'); }
$assigned = []; $versions = []; $records = [];
foreach ($input['groups'] as $group) {
    if (!is_array($group) || !in_array($group['version'] ?? '', ['A', 'B'], true) || isset($versions[$group['version']]) || !is_int($group['quizId'] ?? null) || !is_int($group['courseModuleId'] ?? null) || !is_array($group['studentIds'] ?? null) || count($group['studentIds']) < 1) { throw new RuntimeException('Invalid group'); }
    $versions[$group['version']] = true;
    foreach ($group['studentIds'] as $id) { if (!is_int($id) || !in_array($id, $eligibleids, true) || isset($assigned[$id])) { throw new RuntimeException('Invalid student'); } $assigned[$id] = true; }
    $key = 'classroom-' . $input['paperId'] . '-' . $group['version'];
    $cm = $DB->get_record('course_modules', ['id' => $group['courseModuleId'], 'course' => $course->id, 'idnumber' => $key], '*', MUST_EXIST);
    if ((int)$cm->instance !== $group['quizId'] || $cm->visible || !empty($cm->availability)) { throw new RuntimeException('Quiz is not a clean hidden pilot'); }
    if ($DB->record_exists('groups', ['courseid' => $course->id, 'idnumber' => $key])) { throw new RuntimeException('Existing group needs review'); }
    $records[] = ['key' => $key, 'cm' => $cm, 'version' => $group['version'], 'studentIds' => $group['studentIds']];
}
$assignedids = array_map('intval', array_keys($assigned)); sort($assignedids);
if (!classroom_participants($eligibleids, $assignedids)) { throw new RuntimeException('Invalid assigned students'); }
$transaction = $DB->start_delegated_transaction(); $result = [];
foreach ($records as $record) {
    $groupid = groups_create_group((object)['courseid' => $course->id, 'name' => '试点分组 ' . $record['key'], 'idnumber' => $record['key']]);
    if (!$groupid) { throw new RuntimeException('Group creation failed'); }
    foreach ($record['studentIds'] as $studentid) { if (!groups_add_member($groupid, $studentid)) { throw new RuntimeException('Group membership failed'); } }
    $tree = new \core_availability\tree((object)['op' => '&', 'c' => [(object)['type' => 'group', 'id' => (int)$groupid]], 'showc' => [false]]);
    $availability = json_encode($tree->save(), JSON_THROW_ON_ERROR);
    $DB->set_field('course_modules', 'availability', $availability, ['id' => $record['cm']->id]);
    $saved = $DB->get_record('course_modules', ['id' => $record['cm']->id], 'id,visible,availability', MUST_EXIST);
    $members = groups_get_members($groupid, 'u.id'); $memberids = array_map('intval', array_keys($members)); sort($memberids); $expected = $record['studentIds']; sort($expected);
    if ($saved->visible || $saved->availability !== $availability || $memberids !== $expected) { throw new RuntimeException('Assignment verification failed'); }
    $result[] = ['version' => $record['version'], 'groupId' => (int)$groupid, 'courseModuleId' => (int)$record['cm']->id, 'count' => count($memberids)];
}
rebuild_course_cache($course->id, true);
foreach ($result as $group) {
    $info = new \core_availability\info_module(get_fast_modinfo($course->id)->get_cm($group['courseModuleId']));
    foreach ($eligibleids as $studentid) {
        $details = ''; $allowed = $info->is_available($details, false, $studentid); $member = groups_is_member($group['groupId'], $studentid);
        if ($allowed !== $member) { throw new RuntimeException('Availability verification failed'); }
    }
}
$transaction->allow_commit(); rebuild_course_cache($course->id, true);
echo json_encode(['ok' => true, 'paperId' => $input['paperId'], 'hidden' => true, 'groups' => $result]);
