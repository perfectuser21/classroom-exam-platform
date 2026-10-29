const escape=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&apos;');
function safeText(x){return typeof x==='string'&&x.length>0&&!/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(x)}
export function questionXml(questions){
 if(!Array.isArray(questions)||questions.length<1||questions.length>100)throw Error('题目数量无效');
 const body=questions.map(q=>{
  if(!q||!['single','truefalse','multiple','fill','essay'].includes(q.type)||typeof q.id!=='string'||!/^[a-zA-Z0-9-]+$/.test(q.id)||!safeText(q.stem)||!Array.isArray(q.options)||!Array.isArray(q.answers)||!Number.isFinite(q.points)||q.points<=0||q.points>100)throw Error('题目不支持导入');
  if(['fill','essay'].includes(q.type)){if(q.options.length||q.answers.length||!safeText(q.reference)||q.reference.length>(q.type==='fill'?2000:5000))throw Error('填空参考答案无效')}else if(q.options.length<2||q.options.length>10||q.options.some(x=>!safeText(x))||!q.answers.length||new Set(q.answers).size!==q.answers.length||q.answers.some(x=>!Number.isInteger(x)||x<0||x>=q.options.length))throw Error('题目不支持导入');
  if(q.type==='multiple'&&q.gradingPolicy!=='partial_no_wrong')throw Error('多选评分规则未确认');if(!['multiple','fill','essay'].includes(q.type)&&q.answers.length!==1)throw Error('答案无效');
  if(q.type==='truefalse'&&(q.options.length!==2||q.options[0]!=='正确'||q.options[1]!=='错误'))throw Error('判断题无效');
  let questionText;if(q.image!==undefined){if(!q.image||q.image.name!=='question.png'||typeof q.image.data!=='string'||q.image.data.length<4||q.image.data.length>14000000||!/^[A-Za-z0-9+/]+={0,2}$/.test(q.image.data))throw Error('题目图片无效');const html='<p>'+escape(q.stem).replace(/\r?\n/g,'<br />')+'</p><img src="@@PLUGINFILE@@/question.png" alt="题目图片" />';questionText='<questiontext format="html"><text>'+escape(html)+'</text><file name="question.png" path="/" encoding="base64">'+q.image.data+'</file></questiontext>'}else{questionText='<questiontext format="plain_text"><text>'+escape(q.stem)+'</text></questiontext>'}
  if(q.type==='essay')return `<question type="essay"><name><text>草稿-${escape(q.id)}</text></name>${questionText}<defaultgrade>${q.points}</defaultgrade><responseformat>plain</responseformat><responsefieldlines>10</responsefieldlines><responserequired>1</responserequired><attachments>0</attachments><graderinfo format="plain_text"><text>${escape(q.reference)}</text></graderinfo></question>`;
  if(q.type==='fill')return `<question type="shortanswer"><name><text>草稿-${escape(q.id)}</text></name>${questionText}<defaultgrade>${q.points}</defaultgrade><usecase>0</usecase><answer fraction="100"><text>${escape(q.reference.replaceAll('*','\\*'))}</text></answer></question>`;
  const kind=q.type==='truefalse'?'truefalse':'multichoice',options=q.type==='truefalse'?['true','false']:q.options;
  const fraction=i=>q.type==='multiple'?(q.answers.includes(i)?Number((100/q.answers.length).toFixed(7)):-100):(i===q.answers[0]?100:0);
  return `<question type="${kind}"><name><text>草稿-${escape(q.id)}</text></name>${questionText}<defaultgrade>${q.points}</defaultgrade>${q.type!=='truefalse'?`<single>${q.type==='multiple'?'false':'true'}</single><shuffleanswers>false</shuffleanswers>`:''}${options.map((value,i)=>`<answer fraction="${fraction(i)}"><text>${escape(value)}</text></answer>`).join('')}</question>`;
 });
 return '<?xml version="1.0" encoding="UTF-8"?><quiz>'+body.join('')+'</quiz>';
}
