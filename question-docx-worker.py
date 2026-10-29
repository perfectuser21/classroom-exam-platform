import base64, io, json, os, resource, sys, zipfile
try:
    resource.setrlimit(resource.RLIMIT_AS, (1024 * 1024 * 1024,) * 2)
    resource.setrlimit(resource.RLIMIT_CPU, (15, 15))
except (ValueError, OSError):
    pass
MAX_INPUT=5*1024*1024
MAX_TOTAL=32*1024*1024
HEADERS=['等级','题型','题干']+['选项'+x for x in 'ABCDEFGHIJ']+['正确答案','分值']
W='{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'
A='{http://schemas.openxmlformats.org/drawingml/2006/main}'
R='{http://schemas.openxmlformats.org/officeDocument/2006/relationships}'
ALLOW_IMAGES=os.environ.get('CLASSROOM_WORD_IMAGES')=='1'
def fail(message):
    print(json.dumps({'error':message},ensure_ascii=False));sys.exit(0)
def main():
    data=sys.stdin.buffer.read(MAX_INPUT+1)
    if not data or len(data)>MAX_INPUT:fail('文件为空或超过 5 MB')
    try:
        from defusedxml import ElementTree as ET
        with zipfile.ZipFile(io.BytesIO(data)) as archive:
            entries=archive.infolist();names=[x.filename for x in entries]
            if len(entries)>200 or len(names)!=len(set(names)):fail('Word 内容不安全')
            total=0
            for item in entries:
                name=item.filename
                if name.startswith('/') or '\\' in name or '..' in name.split('/') or item.flag_bits&1:fail('Word 内容不安全')
                if name.startswith(('word/embeddings/','word/activeX/')) or name.endswith('vbaProject.bin') or (name.startswith('word/media/') and not ALLOW_IMAGES):fail('暂不支持图片、嵌入文件或宏')
                if item.file_size>8*1024*1024 or (item.compress_size and item.file_size>item.compress_size*200):fail('Word 内容过大')
                total+=item.file_size
                if total>MAX_TOTAL:fail('Word 内容过大')
                content=archive.read(item)
                if len(content)!=item.file_size:fail('Word 内容损坏')
                if name.endswith(('.xml','.rels')):
                    upper=content.upper()
                    if b'<!DOCTYPE' in upper or b'<!ENTITY' in upper or b'\x00' in content:fail('Word 包含不支持的外部内容')
                    if name.endswith('.rels') and any(str(el.attrib.get('TargetMode','')).lower()=='external' for el in ET.fromstring(content).iter()):fail('Word 包含不支持的外部内容')
            root=ET.fromstring(archive.read('word/document.xml'))
            relationships={}
            if ALLOW_IMAGES and 'word/_rels/document.xml.rels' in names:
                relroot=ET.fromstring(archive.read('word/_rels/document.xml.rels'))
                for rel in relroot:
                    if rel.attrib.get('Type','').endswith('/image'):
                        rid=rel.attrib.get('Id');target=rel.attrib.get('Target','')
                        if not rid or rid in relationships or not target.startswith('media/') or any(x in target for x in ('..','%','\\',':','?','#')):fail('图片关系路径无效')
                        path='word/'+target
                        if path not in names:fail('图片文件缺失')
                        relationships[rid]=path
            image_data={name:archive.read(name) for name in names if name.startswith('word/media/')}
        if any(el.tag in (W+'pict',W+'object',W+'altChunk',W+'instrText') or (el.tag==W+'drawing' and not ALLOW_IMAGES) for el in root.iter()):fail('暂不支持图片、嵌入文件或域')
        all_drawings=list(root.iter(W+'drawing'));used_drawings=[];used_images=set();image_count=0;image_total=0
        body=root.find(W+'body')
        if body is None:fail('Word 文档无效')
        tables=body.findall(W+'tbl')
        if not tables or len(tables)>1000:fail('没有题目表格或超过 1000 题')
        rows=[]
        for index,table in enumerate(tables):
            trs=table.findall(W+'tr')
            if len(trs)!=len(HEADERS):fail('第 %s 个题目表格的字段数量不符'%(index+1))
            values=[];row_image=None
            for expected,tr in zip(HEADERS,trs):
                cells=tr.findall(W+'tc')
                if len(cells)!=2 or any(c.find('.//'+W+'tbl') is not None for c in cells):fail('第 %s 个题目表格格式不符'%(index+1))
                def cell_text(cell):
                    paragraphs=[]
                    for p in cell.findall(W+'p'):
                        parts=[]
                        for el in p.iter():
                            if el.tag==W+'t':parts.append(el.text or '')
                            elif el.tag in (W+'br',W+'cr'):parts.append('\n')
                            elif el.tag==W+'tab':parts.append('\t')
                        paragraphs.append(''.join(parts))
                    return '\n'.join(paragraphs).strip()
                drawings=[(n,list(c.iter(W+'drawing'))) for n,c in enumerate(cells)]
                for column,items in drawings:
                    for drawing in items:
                        used_drawings.append(drawing)
                        if not ALLOW_IMAGES or expected!='题干' or column!=1 or row_image is not None:fail('图片只能放在题干右侧，每题最多一张')
                        blips=list(drawing.iter(A+'blip'))
                        if len(blips)!=1 or blips[0].attrib.get(R+'link') or not blips[0].attrib.get(R+'embed'):fail('图片格式不支持')
                        rid=blips[0].attrib[R+'embed'];path=relationships.get(rid);image=image_data.get(path)
                        if not image or len(image)>1024*1024:fail('图片缺失或超过 1 MB')
                        image_count+=1;image_total+=len(image)
                        if image_count>50 or image_total>2*1024*1024:fail('图片数量或总大小超过限制')
                        used_images.add(path);row_image=base64.b64encode(image).decode('ascii')
                label=cell_text(cells[0]);value=cell_text(cells[1])
                if label!=expected or len(value)>10000:fail('第 %s 个题目表格字段不符'%(index+1))
                values.append(value)
            if any(values) or row_image:
                row={'row':index+2,'values':values,'error':False}
                if row_image:row['image']=row_image
                rows.append(row)
        if len(used_drawings)!=len(all_drawings) or set(image_data)!=used_images:fail('文档中存在位置不支持的图片')
        print(json.dumps({'rows':rows},ensure_ascii=False,allow_nan=False))
    except Exception:
        fail('Word 文档无法解析，请检查模板和内容')
if __name__=='__main__':main()
