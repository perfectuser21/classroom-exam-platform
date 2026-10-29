export function courseIds(courses){if(!Array.isArray(courses))throw Error('无法读取课程');return courses.map(x=>Number(x.id)).filter(x=>Number.isInteger(x)&&x>1)}
export async function loadMoodleExams(call){
 const ids=courseIds(await call('core_course_get_courses',{}));if(!ids.length)return [];
 const params=Object.fromEntries(ids.map((id,i)=>['courseids['+i+']',id]));
 const data=await call('mod_quiz_get_quizzes_by_courses',params);
 if(!Array.isArray(data?.quizzes))throw Error('考试列表不可用');
 return data.quizzes.map(q=>({id:q.id,name:q.name,course:q.course}));
}
