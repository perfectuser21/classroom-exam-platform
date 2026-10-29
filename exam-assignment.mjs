export function planExamRelease({paper,job,enrolled,assignments}){
 if(!paper||typeof paper.id!=='string'||!Array.isArray(paper.papers)||paper.papers.length<1||paper.papers.length>2||!job||job.paperId!==paper.id||job.status!=='completed'||!Array.isArray(job.papers)||job.papers.length!==paper.papers.length)throw Error('试卷尚未全部创建');
 const versions=paper.papers.map(p=>p.version);if(new Set(versions).size!==versions.length||versions.some(v=>!['A','B'].includes(v)))throw Error('试卷版本无效');
 if(!Array.isArray(enrolled)||enrolled.length<5||enrolled.length>50||enrolled.some(id=>!Number.isSafeInteger(id)||id<1)||new Set(enrolled).size!==enrolled.length)throw Error('课程须有 5 至 50 名有效考生');
 if(!Array.isArray(assignments)||assignments.length!==5)throw Error('需要为五名考生全部分配试卷');
 const seen=new Set(),groups=versions.map(version=>{const entries=job.papers.filter(p=>p.version===version&&p.status==='created');if(entries.length!==1||!Number.isSafeInteger(entries[0].quizId)||entries[0].quizId<1||!Number.isSafeInteger(entries[0].courseModuleId)||entries[0].courseModuleId<1)throw Error('试卷记录无效');return {version,quizId:entries[0].quizId,courseModuleId:entries[0].courseModuleId,studentIds:[]}});
 if(new Set(groups.map(x=>x.quizId)).size!==groups.length||new Set(groups.map(x=>x.courseModuleId)).size!==groups.length)throw Error('试卷记录重复');
 for(const entry of assignments){if(!Number.isSafeInteger(entry?.studentId)||!enrolled.includes(entry.studentId)||seen.has(entry.studentId))throw Error('考生重复或不在试点课程');const group=groups.find(g=>g.version===entry.version);if(!group)throw Error('试卷版本无效');seen.add(entry.studentId);group.studentIds.push(entry.studentId)}
 if(groups.some(g=>!g.studentIds.length))throw Error('每个试卷版本至少分配一名考生');return groups;
}
