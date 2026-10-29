function classroom_multiple_policy($fractions) {
    if (!is_array($fractions) || count($fractions) < 2 || count($fractions) > 10) { return false; }
    $correct = [];
    foreach ($fractions as $value) {
        if (!is_numeric($value)) { return false; }
        $value = (float)$value;
        if ($value > 0 && $value <= 1) { $correct[] = $value; }
        else if (abs($value + 1) > 0.000001) { return false; }
    }
    if (!$correct || abs(array_sum($correct) - 1.0) > 0.00001) { return false; }
    $expected = 1.0 / count($correct);
    foreach ($correct as $value) { if (abs($value - $expected) > 0.00001) { return false; } }
    return true;
}
