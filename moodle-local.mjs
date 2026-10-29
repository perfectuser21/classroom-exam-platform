import http from 'node:http';
function localRequest(path,params,{port=18088,host='singer-airport-decorating-radar.trycloudflare.com',timeout=15000,maxBytes=16*1024*1024,signal}={}){
 if(typeof path!=='string'||!path.startsWith('/')||path.startsWith('//'))throw Error('本机考试服务路径无效');
 const body=new URLSearchParams(params).toString();
 return new Promise((resolve,reject)=>{
  let settled=false,timer;
  const abort=()=>{req.destroy();done(Error('本机考试服务请求取消'))};
  const done=(error,value)=>{if(settled)return;settled=true;clearTimeout(timer);signal?.removeEventListener('abort',abort);error?reject(error):resolve(value)};
  const req=http.request({hostname:'127.0.0.1',port,path,method:'POST',headers:{host,'x-forwarded-proto':'https','content-type':'application/x-www-form-urlencoded','content-length':Buffer.byteLength(body)}},res=>{
   if(res.statusCode!==200){res.resume();done(Error('本机考试服务响应异常'));return}
   let size=0;const parts=[];
   res.on('data',part=>{size+=part.length;if(size>maxBytes){req.destroy();done(Error('本机考试服务响应过大'));return}parts.push(part)});
   res.on('error',()=>done(Error('本机考试服务读取失败')));
   res.on('end',()=>done(null,{data:Buffer.concat(parts),headers:res.headers}));
  });
  req.on('error',()=>done(Error('本机考试服务不可用')));
  timer=setTimeout(()=>{req.destroy();done(Error('本机考试服务超时'))},timeout);
  if(signal?.aborted){abort();return}signal?.addEventListener('abort',abort,{once:true});req.end(body);
 });
}
export async function localMoodleJson(path,params,options){
 const result=await localRequest(path,params,options);
 try{return JSON.parse(result.data.toString('utf8'))}catch{throw Error('本机考试服务响应无效')}
}
export async function localMoodleImageFetch(url,options={},settings={}){
 const origin=settings.origin||'https://singer-airport-decorating-radar.trycloudflare.com',u=new URL(url);
 if(u.origin!==origin||u.username||u.password||u.search||u.hash||!u.pathname.startsWith('/webservice/pluginfile.php/')||options.method!=='POST'||!(options.body instanceof URLSearchParams))throw Error('图片请求无效');
 const result=await localRequest(u.pathname,options.body,{...settings,maxBytes:5*1024*1024,signal:options.signal});
 return new Response(result.data,{status:200,headers:{'content-type':result.headers['content-type']||'application/octet-stream','content-length':String(result.data.length)}});
}
