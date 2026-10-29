import http from 'node:http';
import {createCandidateHandler} from './candidate-api.mjs';
const base='https://singer-airport-decorating-radar.trycloudflare.com';
async function call(fn,params,token){
 const url=base+(fn==='login'?'/login/token.php':'/webservice/rest/server.php');
 const p=fn==='login'?{...params,service:'classroom_candidate'}:{...params,wstoken:token,wsfunction:fn,moodlewsrestformat:'json'};
 const r=await fetch(url,{method:'POST',body:new URLSearchParams(p),signal:AbortSignal.timeout(15000)});
 if(!r.ok)throw Error('考试服务不可用');return r.json();
}
const handler=createCandidateHandler({call});
http.createServer((req,res)=>{if(!req.url.startsWith('/api/candidate/')){res.writeHead(404);res.end();return}handler(req,res)}).listen(18102,'127.0.0.1',()=>console.log('考生接口本机测试启动'));
