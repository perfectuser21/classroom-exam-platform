const packages=[
 {id:'labelme-cp312-candidate',software:'labelme',version:'7.9.1',python:['3.12'],filename:'labelme-7.9.1-win-cp312-candidate.zip',size:379816799,sha256:'312eb983ef5e88b776c45e9c8cc96bf150bde4944a60724aba2d20de16c1bc40'},
 {id:'labelme-cp313-candidate',software:'labelme',version:'7.9.1',python:['3.13'],filename:'labelme-7.9.1-win-cp313-candidate.zip',size:379778645,sha256:'4c62a68b6a186308f84535f4bb5c6566e910d237af7bc9a2836bd7fd8d1e4886'}
];
export function labelmeWheelhouses(){return structuredClone(packages)}
