define('CLI_SCRIPT',true);require '/var/www/html/config.php';require_once $CFG->dirroot.'/course/lib.php';\core\session\manager::set_user(get_admin());
$input=json_decode(stream_get_contents(STDIN),true,8,JSON_THROW_ON_ERROR);$username=$input['username']??null;if(!is_string($username)||!preg_match('/^(?:[a-z][a-z0-9_-]{2,39}|1[3-9][0-9]{9})$/',$username))throw new RuntimeException('Invalid username');
$users=classroom_enrolled_students(2);$taken=$DB->record_exists('user',['username'=>$username,'mnethostid'=>$CFG->mnet_localhost_id]);echo json_encode(['available'=>!$taken&&count($users)<50]);
