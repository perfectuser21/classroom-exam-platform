const image=(value,repo)=>typeof value==='string'&&new RegExp('^'+repo.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'@sha256:[0-9a-f]{64}$').test(value);
export function runtimeManifest({node,npm,architecture,moodleImage,databaseImage}={}){
 if(typeof node!=='string'||!/^v\d+\.\d+\.\d+$/.test(node)||typeof npm!=='string'||!/^\d+\.\d+\.\d+$/.test(npm)||!['arm64','x64'].includes(architecture)||!image(moodleImage,'moodlehq/moodle-php-apache')||!image(databaseImage,'postgres'))throw Error('恢复运行环境信息无效');
 return {version:1,node,npm,architecture,moodleImage,databaseImage};
}
