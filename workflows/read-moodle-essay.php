define('CLI_SCRIPT', true);
require '/var/www/html/config.php';
require_once $CFG->dirroot . '/mod/quiz/locallib.php';
\core\session\manager::set_user(get_admin());
$input = json_decode(stream_get_contents(STDIN), true, 8, JSON_THROW_ON_ERROR);
foreach (['quizId', 'attemptId', 'slot'] as $key) { if (!isset($input[$key]) || !is_int($input[$key]) || $input[$key] < 1) { throw new RuntimeException('Invalid identifier'); } }
$attempt = $DB->get_record('quiz_attempts', ['id' => $input['attemptId'], 'quiz' => $input['quizId'], 'state' => 'finished'], '*', MUST_EXIST);
$usage = question_engine::load_questions_usage_by_activity($attempt->uniqueid);
if (!in_array($input['slot'], $usage->get_slots(), true)) { throw new RuntimeException('Slot missing'); }
$question = $usage->get_question_attempt($input['slot']);
if ($question->get_question()->qtype->name() !== 'essay') { throw new RuntimeException('Not essay'); }
$answer = $question->get_last_qt_var('answer', '');
if ($answer instanceof question_file_loader) { $answer = (string)$answer; }
if (!is_string($answer) || mb_strlen($answer) > 10000) { throw new RuntimeException('Answer invalid'); }
echo json_encode(['quizId' => (int)$input['quizId'], 'attemptId' => (int)$input['attemptId'], 'slot' => (int)$input['slot'], 'questionId' => (int)$question->get_question_id(), 'studentId' => (int)$attempt->userid, 'state' => $attempt->state, 'graded' => $question->get_state()->is_graded(), 'maxScore' => (float)$question->get_max_mark(), 'answer' => $answer], JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE);
