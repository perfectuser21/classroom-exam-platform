function classroom_essay_policy($options) {
    return is_array($options) && ($options['responseformat'] ?? null) === 'plain'
        && (string)($options['responserequired'] ?? '') === '1'
        && (string)($options['attachments'] ?? '') === '0'
        && (string)($options['attachmentsrequired'] ?? '') === '0';
}
