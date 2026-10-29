function classroom_participants($eligible, $assigned) {
    if (!is_array($eligible) || count($eligible) < 5 || count($eligible) > 50 || !is_array($assigned) || count($assigned) !== 5) { return false; }
    foreach (array_merge($eligible, $assigned) as $id) { if (!is_int($id) || $id < 1) { return false; } }
    if (count(array_unique($eligible)) !== count($eligible) || count(array_unique($assigned)) !== 5) { return false; }
    return count(array_diff($assigned, $eligible)) === 0;
}
function classroom_enrolled_students($courseid) {
    global $DB;
    $context = context_course::instance($courseid);
    $role = $DB->get_record('role', ['shortname' => 'student'], 'id', MUST_EXIST);
    $enrolled = get_enrolled_users($context, 'mod/quiz:attempt', 0, 'u.id,u.suspended');
    $ids = [];
    foreach ($enrolled as $user) { if (!$user->suspended && user_has_role_assignment($user->id, $role->id, $context->id)) { $ids[] = (int)$user->id; } }
    sort($ids); return $ids;
}
