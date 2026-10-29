// A quiz is managed here only when this installation has a successful creation receipt.
export function groupExams(exams, jobs) {
 if (!Array.isArray(jobs)) return {managed: exams, other: []};
 const ids = new Set(jobs.flatMap(job => Array.isArray(job.papers) ? job.papers : [])
  .filter(p => p.status === 'created' && Number.isSafeInteger(p.quizId))
  .map(p => p.quizId));
 return {managed: exams.filter(exam => ids.has(exam.id)), other: exams.filter(exam => !ids.has(exam.id))};
}
