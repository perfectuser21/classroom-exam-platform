import {readFileSync} from 'node:fs';
import {gzipSync} from 'node:zlib';
import {anacondaManifest} from './anaconda-workflow.mjs';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function anacondaCommand(id){
 if(typeof id!=='string'||!uuid.test(id))throw Error('安装任务标识无效');const m=anacondaManifest(),source=readFileSync(new URL('./workflows/install-anaconda.ps1',import.meta.url),'utf8');const original=`$installer = 'D:\\ClassroomExam\\Installers\\${m.filename}'`,replacement=`$installer = 'D:\\ClassroomExam\\Installers\\${id}\\${m.filename}'`;
 if(source.split(original).length!==2||!source.includes(m.sha256))throw Error('安装脚本与清单不一致');const script=source.replace(original,replacement),compressed=gzipSync(Buffer.from(script,'utf8')).toString('base64');const wrapper="$b=[Convert]::FromBase64String('"+compressed+"');$m=New-Object IO.MemoryStream(,$b);$g=New-Object IO.Compression.GZipStream($m,[IO.Compression.CompressionMode]::Decompress);$r=New-Object IO.StreamReader($g,[Text.Encoding]::UTF8);& ([ScriptBlock]::Create($r.ReadToEnd()))";const command='powershell.exe -NoProfile -NonInteractive -EncodedCommand '+Buffer.from(wrapper,'utf16le').toString('base64');if(command.length>=8000)throw Error('安装命令过长');return command;
}
