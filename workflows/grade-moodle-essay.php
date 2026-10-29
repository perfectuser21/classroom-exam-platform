define('CLI_SCRIPT', true);
require '/var/www/html/config.php';
require_once $CFG->dirroot . '/mod/quiz/locallib.php';
\core\session\manager::set_user(get_admin());
$input = json_decode(stream_get_contents(STDIN), true, 16, JSON_THROW_ON_ERROR);
foreach (['quizId', 'attemptId', 'slot', 'questionId', 'studentId'] as $key) { if (!isset($input[$key]) || !is_int($input[$key]) || $input[$key] < 1) { throw new RuntimeException('Invalid identifier'); } }
if (!isset($input['score'], $input['maxScore'], $input['responseHash'], $input['reason'], $input['actor']) || !is_numeric($input['score']) || !is_numeric($input['maxScore']) || !is_string($input['responseHash']) || !preg_match('/^[a-f0-9]{64}$/', $input['responseHash']) || !is_string($input['reason']) || trim($input['reason']) === '' || mb_strlen($input['reason']) > 3000 || !is_string($input['actor']) || !preg_match('/^[a-zA-Z0-9_-]{1,64}$/', $input['actor'])) { throw new RuntimeException('Invalid grade'); }
$score = (float)$input['score']; $max = (float)$input['maxScore'];
if (!is_finite($score) || !is_finite($max) || $max <= 0 || $max > 100 || $score < 0 || $score > $max || abs(round($score * 100) - $score * 100) > 0.000001) { throw new RuntimeException('Invalid score'); }
$transaction = $DB->start_delegated_transaction();
$record = $DB->get_record_sql('SELECT * FROM {quiz_attempts} WHERE id = :id AND quiz = :quiz AND userid = :student FOR UPDATE', ['id' => $input['attemptId'], 'quiz' => $input['quizId'], 'student' => $input['studentId']], MUST_EXIST);
if ($record->state !== 'finished') { throw new RuntimeException('Attempt not finished'); }
$usage = question_engine::load_questions_usage_by_activity($record->uniqueid);
if (!in_array($input['slot'], $usage->get_slots(), true)) { throw new RuntimeException('Slot missing'); }
$question = $usage->get_question_attempt($input['slot']);
if ($question->get_question()->qtype->name() !== 'essay' || (int)$question->get_question_id() !== $input['questionId'] || abs((float)$question->get_max_mark() - $max) > 0.000001 || $question->get_state()->is_graded()) { throw new RuntimeException('Question changed or already graded'); }
$answer = $question->get_last_qt_var('answer', ''); if ($answer instanceof question_file_loader) { $answer = (string)$answer; }
if (!is_string($answer) || !hash_equals($input['responseHash'], hash('sha256', $answer))) { throw new RuntimeException('Answer changed'); }
$usage->manual_grade($input['slot'], '仲裁人 '.$input['actor'].'：'.$input['reason'], $score, FORMAT_PLAIN);
question_engine::save_questions_usage_by_activity($usage);
$DB->update_record('quiz_attempts', (object)['id' => $record->id, 'timemodified' => time(), 'sumgrades' => $usage->get_total_mark()]);
$attempt = \mod_quiz\quiz_attempt::create($record->id);
$attempt->get_quizobj()->get_grade_calculator()->recompute_final_grade((int)$record->userid);
$readback = question_engine::load_questions_usage_by_activity($record->uniqueid)->get_question_attempt($input['slot']);
if (!$readback->get_state()->is_graded() || abs((float)$readback->get_mark() - $score) > 0.00001) { throw new RuntimeException('Grade verification failed'); }
$transaction->allow_commit();
echo json_encode(['confirmed' => true, 'quizId' => $input['quizId'], 'attemptId' => $input['attemptId'], 'slot' => $input['slot'], 'score' => $score], JSON_THROW_ON_ERROR);
