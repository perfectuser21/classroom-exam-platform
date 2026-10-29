define('CLI_SCRIPT', true);
require '/var/www/html/config.php';
require_once $CFG->dirroot . '/mod/quiz/locallib.php';
\core\session\manager::set_user(get_admin());
$input = json_decode(stream_get_contents(STDIN), true, 8, JSON_THROW_ON_ERROR);
if (!is_array($input) || !isset($input['quizId']) || !is_int($input['quizId']) || $input['quizId'] < 1) { throw new RuntimeException('Invalid quiz'); }
$DB->get_record('quiz', ['id' => $input['quizId'], 'course' => 2], '*', MUST_EXIST);
$attempts = $DB->get_records('quiz_attempts', ['quiz' => $input['quizId'], 'state' => 'finished'], 'id', '*', 0, 501);
if (count($attempts) > 500) { throw new RuntimeException('Too many attempts'); }
$rows = [];
foreach ($attempts as $attempt) {
    $usage = question_engine::load_questions_usage_by_activity($attempt->uniqueid);
    foreach ($usage->get_slots() as $slot) {
        $question = $usage->get_question_attempt($slot);
        if ($question->get_question()->qtype->name() !== 'essay') { continue; }
        $answer = $question->get_last_qt_var('answer', ''); if ($answer instanceof question_file_loader) { $answer = (string)$answer; }
        if (!is_string($answer) || mb_strlen($answer) > 10000 || count($rows) >= 500) { throw new RuntimeException('Invalid or excessive answers'); }
        $rows[] = ['quizId' => (int)$input['quizId'], 'attemptId' => (int)$attempt->id, 'slot' => (int)$slot, 'questionId' => (int)$question->get_question_id(), 'studentId' => (int)$attempt->userid, 'state' => $attempt->state, 'graded' => $question->get_state()->is_graded(), 'maxScore' => (float)$question->get_max_mark(), 'answer' => $answer];
    }
}
echo json_encode($rows, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE);
