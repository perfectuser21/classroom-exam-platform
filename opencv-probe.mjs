export function readOpenCv(result) {
 if(result?.status==='ok' && typeof result.version==='string' && /^\d+(\.\d+){1,3}$/.test(result.version)) return {status:'ready',version:result.version};
 if(result?.status==='missing') return {status:'missing'};
 if(result?.status==='error') return {status:'error'};
 throw Error('OpenCV 检查结果无效');
}
