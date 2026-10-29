import {isAbsolute} from 'node:path';
const keys={op:'CLASSROOM_OP_BIN',docker:'CLASSROOM_DOCKER_BIN'};
export function runtimeBin(name,env=process.env){const key=keys[name];if(!key)throw Error('程序名称无效');const value=env[key];if(value===undefined||value==='')return name;if(typeof value!=='string'||!isAbsolute(value)||value.includes('\0'))throw Error('程序路径无效');return value}
