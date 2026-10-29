function classroom_fill_policy($usecase, $answers) {
    if ((string)$usecase !== '0' || !is_array($answers) || count($answers) !== 1) { return false; }
    $answer = reset($answers);
    if (!is_array($answer) || !isset($answer['answer'], $answer['fraction']) || !is_string($answer['answer']) || trim($answer['answer']) === '' || mb_strlen($answer['answer']) > 4000 || !is_numeric($answer['fraction']) || abs((float)$answer['fraction'] - 1) > 0.000001) { return false; }
    return preg_match('/(?<!\\\\)\*/u', $answer['answer']) === 0;
}
