const manifest={id:'anaconda',version:'2025.12-2',filename:'Anaconda3-2025.12-2-Windows-x86_64.exe',source:'https://repo.anaconda.com/archive/Anaconda3-2025.12-2-Windows-x86_64.exe',sha256:'2e0b8e40ec7600793f116250f5c1775c866833bac32d184ad575ecc0d360a88f',size:1200681984,target:'D:\\Anaconda3'};
export function anacondaManifest(){return structuredClone(manifest)}
export function anacondaPlan(probe){
 if(!probe||probe.probe!=='complete'||typeof probe.existing!=='boolean'||typeof probe.usable!=='boolean')return 'stop';
 if(probe.existing)return probe.usable&&typeof probe.path==='string'&&probe.path.toLowerCase()===manifest.target.toLowerCase()?'already_ready':'stop';
 if(probe.usable||probe.targetExists!==false||!Number.isSafeInteger(probe.dFreeBytes)||probe.dFreeBytes<15*1024**3||probe.installerVerified!==true)return 'stop';
 return 'install';
}
