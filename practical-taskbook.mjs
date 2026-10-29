export function taskbookText(task){
 if(!task||typeof task.title!=='string'||typeof task.description!=='string'||![3,4,5].includes(task.level)||!Number.isInteger(task.durationMinutes)||!Array.isArray(task.formats)||!Array.isArray(task.rubric))throw Error('任务书数据无效');
 return ['实操考试任务书','',`任务：${task.title}`,`等级：${task.level} 级`,`建议时长：${task.durationMinutes} 分钟`,'','任务说明',task.description,'',`交付格式：${task.formats.join('、')}`,'','评分细则',...task.rubric.map(r=>`${r.criterion}：${r.points} 分`),''].join('\r\n');
}
