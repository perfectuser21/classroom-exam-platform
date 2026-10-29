import {localMoodleJson} from './moodle-local.mjs';
export const moodleBase='https://singer-airport-decorating-radar.trycloudflare.com';
export async function moodleCandidateCall(fn,params,token){
 const path=fn==='login'?'/login/token.php':'/webservice/rest/server.php';
 const p=fn==='login'?{...params,service:'classroom_candidate'}:{...params,wstoken:token,wsfunction:fn,moodlewsrestformat:'json'};
 return localMoodleJson(path,p);
}
