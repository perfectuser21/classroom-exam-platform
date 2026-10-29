define('CLI_SCRIPT', true);
require '/var/www/html/config.php';
require_once $CFG->dirroot . '/question/format/xml/format.php';
require_once $CFG->dirroot . '/question/editlib.php';
\core\session\manager::set_user(get_admin());
$input = json_decode(stream_get_contents(STDIN), true, 32, JSON_THROW_ON_ERROR);
if (!is_array($input) || !isset($input['name'], $input['xml']) || !preg_match('/^草稿-[a-zA-Z0-9-]+$/u', $input['name']) || strlen($input['xml']) > 14050000) { throw new RuntimeException('Invalid input'); }
$course = get_course(2);
$module = get_coursemodule_from_id('quiz', 2, $course->id, false, MUST_EXIST);
$context = context_module::instance($module->id);
$category = $DB->get_record('question_categories', ['id' => 2, 'contextid' => $context->id], '*', MUST_EXIST);
$category->context = $context;
$PAGE->set_context($context);
$sql = 'SELECT q.id FROM {question} q JOIN {question_versions} v ON v.questionid = q.id JOIN {question_bank_entries} e ON e.id = v.questionbankentryid WHERE e.questioncategoryid = :category AND q.name = :name';
$existing = $DB->get_records_sql($sql, ['category' => $category->id, 'name' => $input['name']]);
if (count($existing) > 1) { throw new RuntimeException('Ambiguous existing question'); }
if (count($existing) === 1) { $item = reset($existing); echo json_encode(['ok' => true, 'name' => $input['name'], 'moodleId' => (int)$item->id]); exit; }
$file = tempnam(sys_get_temp_dir(), 'classroom-');
if ($file === false) { throw new RuntimeException('Temporary file unavailable'); }
try {
    if (file_put_contents($file, $input['xml']) === false) { throw new RuntimeException('Temporary file unavailable'); }
    $format = new qformat_xml();
    $format->setCategory($category); $format->setContexts([$context]); $format->setCourse($course);
    $format->setFilename($file); $format->setRealfilename('classroom-question.xml');
    $format->setMatchgrades('error'); $format->setStoponerror(true); $format->set_display_progress(false);
    $transaction = $DB->start_delegated_transaction();
    ob_start();
    $ok = $format->importpreprocess() && $format->importprocess() && $format->importpostprocess();
    ob_end_clean();
    $ids = $format->questionids;
    if (!$ok || count($ids) !== 1 || !$DB->record_exists('question', ['id' => $ids[0], 'name' => $input['name']])) { throw new RuntimeException('Question import unconfirmed'); }
    $transaction->allow_commit();
    echo json_encode(['ok' => true, 'name' => $input['name'], 'moodleId' => (int)$ids[0]]);
} finally { unlink($file); }
