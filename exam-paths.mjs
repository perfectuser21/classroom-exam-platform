const reserved=/^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;
function identifier(value){if(typeof value!=='string'||!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/.test(value)||reserved.test(value))throw Error('考试或考生标识无效');return value}
export function examPaths(examId,studentId){const exam=identifier(examId),student=identifier(studentId),base=`E:\\ClassroomExam\\${exam}\\${student}`;return {materials:`${base}\\materials`,answers:`${base}\\answers`}}
export function moodleExamKey(id){if(!/^[1-9]\d{0,9}$/.test(String(id)))throw Error('考试编号无效');return 'exam-'+id}
