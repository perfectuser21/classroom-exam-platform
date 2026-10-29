const kinds=['software','anaconda','portable','onnx','environment','labelme','material','answer','cleanup'];
export function deviceBusy(name,stores,except){
 if(typeof name!=='string'||!name||!stores||!kinds.includes(except)||kinds.some(k=>!stores[k]?.locks||typeof stores[k].locks.has!=='function'))throw Error('设备任务状态不可用');
 return kinds.some(k=>k!==except&&stores[k].locks.has(name));
}
