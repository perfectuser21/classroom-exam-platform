export function decideOpenCvAction(probe) {
 if (probe?.status === 'ready' && typeof probe.version === 'string' && /^\d+(\.\d+){1,3}$/.test(probe.version)) return probe.version==='4.13.0'?'already_ready':'stop';
 if (probe?.status === 'missing') return 'install';
 if (probe?.status === 'error') return 'stop';
 throw Error('无法判断 OpenCV 状态');
}
