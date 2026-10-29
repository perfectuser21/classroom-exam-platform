import io
import base64
import json
import os
import re
import resource
import sys
import warnings
import zipfile

os.environ['OPENPYXL_LXML'] = 'False'
try:
    resource.setrlimit(resource.RLIMIT_AS, (1024 * 1024 * 1024, 1024 * 1024 * 1024))
    resource.setrlimit(resource.RLIMIT_CPU, (15, 15))
except (ValueError, OSError):
    pass

MAX_INPUT = 5 * 1024 * 1024
MAX_TOTAL = 32 * 1024 * 1024
MAX_ENTRY = 8 * 1024 * 1024
HEADERS = ['等级', '题型', '题干'] + ['选项' + c for c in 'ABCDEFGHIJ'] + ['正确答案', '分值']
ALLOW_IMAGES = os.environ.get('CLASSROOM_XLSX_IMAGES') == '1'

def fail(message):
    print(json.dumps({'error': message}, ensure_ascii=False))
    sys.exit(0)

def main():
    data = sys.stdin.buffer.read(MAX_INPUT + 1)
    if not data or len(data) > MAX_INPUT:
        fail('文件为空或超过 5 MB')
    try:
        with zipfile.ZipFile(io.BytesIO(data)) as archive:
            entries = archive.infolist()
            if len(entries) > 200:
                fail('工作簿内容过多')
            total = 0
            for item in entries:
                name = item.filename
                if name.startswith('/') or '\\' in name or '..' in name.split('/') or item.flag_bits & 1:
                    fail('工作簿内容不安全')
                if item.is_dir():
                    continue
                if name.startswith('xl/externalLinks/') or name.endswith('vbaProject.bin'):
                    fail('不支持外部链接或宏')
                if name.startswith('xl/media/') and (not ALLOW_IMAGES or not re.fullmatch(r'xl/media/[A-Za-z0-9_.-]+\.(png|jpe?g|gif|webp)', name, re.IGNORECASE)):
                    fail('图片格式不支持或图片导入尚未启用')
                if item.file_size > MAX_ENTRY or (item.compress_size and item.file_size > item.compress_size * 200):
                    fail('工作簿内容过大')
                total += item.file_size
                if total > MAX_TOTAL:
                    fail('工作簿内容过大')
                content = archive.read(item)
                if len(content) != item.file_size:
                    fail('工作簿内容损坏')
                if name.endswith(('.xml', '.rels')):
                    upper = content.upper()
                    if b'<!DOCTYPE' in upper or b'<!ENTITY' in upper or b'\x00' in content:
                        fail('工作簿包含不支持的 XML 内容')
                    if name.endswith('.rels'):
                        from defusedxml.ElementTree import fromstring
                        root = fromstring(content)
                        if any(node.attrib.get('TargetMode', '').lower() == 'external' for node in root.iter()):
                            fail('不支持外部链接或外部图片')
    except Exception:
        fail('不是有效的 Excel 工作簿')
    try:
        import openpyxl
        from openpyxl.xml import DEFUSEDXML
        if not DEFUSEDXML:
            fail('表格解析保护不可用')
        if ALLOW_IMAGES:
            from PIL import Image
            Image.MAX_IMAGE_PIXELS = 20000000
            warnings.simplefilter('error', Image.DecompressionBombWarning)
            warnings.filterwarnings('error', category=UserWarning, module=r'openpyxl\.reader\.drawings')
        book = openpyxl.load_workbook(io.BytesIO(data), read_only=not ALLOW_IMAGES, data_only=False, keep_links=False)
        if '题目录入' not in book.sheetnames:
            fail('缺少题目录入工作表')
        if len(book.sheetnames) > 10:
            fail('工作表数量过多')
        sheet = book['题目录入']
        if sheet.max_row is None or sheet.max_column is None:
            sheet.calculate_dimension(force=True)
        if (sheet.max_row or 0) > 1001 or (sheet.max_column or 0) > 15:
            fail('最多支持 1000 行、15 列，请使用下载的模板')
        header = [cell.value for cell in next(sheet.iter_rows(min_row=1, max_row=1, min_col=1, max_col=15))]
        if header != HEADERS:
            fail('表头与模板不一致')
        rows = []
        for number, row in enumerate(sheet.iter_rows(min_row=2, max_col=15), start=2):
            values = []
            invalid = False
            for cell in row:
                value = cell.value
                if getattr(cell, 'data_type', None) in ('f', 'e') or isinstance(value, bool) or (value is not None and not isinstance(value, (str, int, float))):
                    invalid = True
                    value = None
                if isinstance(value, str) and len(value) > 10000:
                    invalid = True
                    value = None
                values.append(value)
            if invalid or any(value is not None and str(value).strip() for value in values):
                rows.append({'row': number, 'values': values, 'error': invalid})
        if ALLOW_IMAGES:
            images = {}
            total_images = 0
            for current in book.worksheets:
                for image in current._images:
                    if current.title != '题目录入':
                        fail('图片只能放在题目录入工作表')
                    anchor = getattr(image.anchor, '_from', None)
                    if anchor is None or anchor.col != 2 or anchor.row < 1 or anchor.row >= 1001:
                        fail('图片左上角须位于对应题目的 C 列单元格')
                    number = anchor.row + 1
                    if number in images:
                        fail('第 %d 行有多张图片，每题最多一张' % number)
                    raw = image._data()
                    if not raw or len(raw) > 1024 * 1024:
                        fail('第 %d 行图片为空或超过 1 MB' % number)
                    total_images += len(raw)
                    if total_images > 2 * 1024 * 1024 or len(images) >= 50:
                        fail('图片总量超过 2 MB 或 50 张')
                    images[number] = base64.b64encode(raw).decode('ascii')
            by_number = {row['row']: row for row in rows}
            for number, image in images.items():
                if number not in by_number:
                    fail('第 %d 行图片没有对应题目' % number)
                by_number[number]['image'] = image
        print(json.dumps({'rows': rows}, ensure_ascii=False, allow_nan=False))
    except Exception:
        fail('工作簿无法解析，请检查模板和单元格内容')

if __name__ == '__main__':
    main()
