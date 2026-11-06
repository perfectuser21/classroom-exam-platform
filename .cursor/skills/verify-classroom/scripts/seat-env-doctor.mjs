import {mkdirSync,writeFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
const run=resolve(process.argv[2]||'.classroom-evidence/current');
mkdirSync(run,{recursive:true,mode:0o700});
// CleanupPreviewJobs is deliberately read-only. Never infer deletion from a preview.
const lines=[
 'FAIL R6 Doctor: one-click cleanup execution and post-delete verification are not implemented; existing cleanup is preview only',
 'FAIL R6 Doctor: one-click catalog installation and a real Windows seat health check have not been verified end-to-end',
 'FAIL R6 Doctor: no disposable Windows test seat and owned exam-file fixture have been established for safe Drive'
];
writeFileSync(join(run,'seat-env-doctor.txt'),lines.join('\n')+'\n');
console.log(lines.join('\n'));
process.exitCode=1;
