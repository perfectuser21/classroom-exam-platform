import {test} from 'node:test';import {strict as assert} from 'node:assert';import {execFileSync} from 'node:child_process';import {parseQuestionDocx} from './question-docx.mjs';
function fixture({unsafe=false}={}){return execFileSync('./.venv/bin/python',['-c',`import io,zipfile,sys
b=io.BytesIO()
with zipfile.ZipFile(b,'w',zipfile.ZIP_DEFLATED) as z:
 z.writestr('word/document.xml',${JSON.stringify('<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:tbl>'+['等级','题型','题干',...'ABCDEFGHIJ'.split('').map(c=>'选项'+c),'正确答案','分值'].map((k,i)=>'<w:tr><w:tc><w:p><w:r><w:t>'+k+'</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>'+(['5','单选','示例题','答案一','答案二','','','','','','','','','A','1'][i])+'</w:t></w:r></w:p></w:tc></w:tr>').join('')+'</w:tbl></w:body></w:document>')})
 ${unsafe?"z.writestr('word/media/image.png',b'image')":"pass"}
sys.stdout.buffer.write(b.getvalue())`])}
test('按题目表格提取 Word 题目并对接现有题库格式',async()=>{const result=await parseQuestionDocx(fixture());assert.equal(result.rows.length,1);assert.deepEqual(result.rows[0].values.slice(0,5),['5','单选','示例题','答案一','答案二'])});
test('拒绝图片附件以及非 Word 数据',async()=>{await assert.rejects(()=>parseQuestionDocx(fixture({unsafe:true})));await assert.rejects(()=>parseQuestionDocx(Buffer.from('not a docx')))});
test('拒绝外部关联的 Word 文件',async()=>{const input=execFileSync('./.venv/bin/python',['-c',`import io,zipfile,sys
b=io.BytesIO()
with zipfile.ZipFile(b,'w') as z:
 z.writestr('word/document.xml','<x/>')
 z.writestr('word/_rels/document.xml.rels',"<Relationships><Relationship TargetMode='External' Target='https://example.org'/></Relationships>")
sys.stdout.buffer.write(b.getvalue())`]);await assert.rejects(()=>parseQuestionDocx(input),/外部内容/)});
function imageFixture({field='题干',duplicate=false,unsafePath=false}={}){const input=fixture();return execFileSync('./.venv/bin/python',['-c',`import sys,io,zipfile
raw=sys.stdin.buffer.read(); out=io.BytesIO(); image=bytes.fromhex('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c6360f8cfc000000401010018dd8db10000000049454e44ae426082')
with zipfile.ZipFile(io.BytesIO(raw)) as zin,zipfile.ZipFile(out,'w',zipfile.ZIP_DEFLATED) as z:
 for entry in zin.infolist():
  data=zin.read(entry.filename)
  if entry.filename=='word/document.xml':
   s=data.decode();s=s.replace('xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"','xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"')
   marker='<w:t>'+${JSON.stringify(field)}+'</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r>'
   picture='<w:drawing><a:blip r:embed="rIdImage"/></w:drawing>'*${duplicate?2:1}
   s=s.replace(marker,marker+picture);data=s.encode()
  z.writestr(entry,data)
 z.writestr('word/_rels/document.xml.rels','<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdImage" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="${unsafePath?'../../outside.png':'media/image.png'}"/></Relationships>')
 z.writestr('word/media/image.png',image)
sys.stdout.buffer.write(out.getvalue())`],{input})}
test('Word 题干嵌入图片可提取并保留题目内容',async()=>{const result=await parseQuestionDocx(imageFixture(),{allowImages:true});assert.equal(result.rows.length,1);assert.equal(result.rows[0].values[2],'示例题');assert.ok(Buffer.from(result.rows[0].image,'base64').length>30)});
test('Word 图片仅限题干且每题一张，关系路径不得逃逸',async()=>{for(const option of [{field:'选项A'},{duplicate:true},{unsafePath:true}])await assert.rejects(()=>parseQuestionDocx(imageFixture(option),{allowImages:true}))});
