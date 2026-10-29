import {createHash,createHmac} from 'node:crypto';import {isIP} from 'node:net';
const host='dnspod.tencentcloudapi.com',domain='zenithjoy.tech',contentType='application/json; charset=utf-8';
const reads=new Set(['DescribeDomain','DescribeDomainPurview','DescribeRecord','DescribeRecordList']);
const hash=x=>createHash('sha256').update(x).digest('hex'),hmac=(key,data)=>createHmac('sha256',key).update(data).digest();
function check(action,p,{allowWrites,expectedAddress,canDelete}){
 if(!p||Array.isArray(p)||p.Domain!==domain)throw Error('DNS 范围无效');
 if(reads.has(action))return;
 if(!allowWrites)throw Error('DNS 修改未启用');
 if(action==='CreateRecord'){
  const keys=Object.keys(p).sort().join(',');
  if(p.SubDomain==='exam'&&p.RecordType==='A'&&p.RecordLine==='默认'&&p.TTL===600&&isIP(p.Value)===4&&p.Value===expectedAddress&&keys==='Domain,RecordLine,RecordType,SubDomain,TTL,Value')return;
  if(p.SubDomain==='_acme-challenge.exam'&&p.RecordType==='TXT'&&p.RecordLine==='默认'&&p.TTL===600&&/^[A-Za-z0-9_-]{43}$/.test(p.Value)&&/^classroom-acme-[0-9a-f-]{36}$/i.test(p.Remark)&&keys==='Domain,RecordLine,RecordType,Remark,SubDomain,TTL,Value')return;
  throw Error('DNS 记录超出授权范围');
 }
 if(action==='DeleteRecord'&&Object.keys(p).sort().join(',')==='Domain,RecordId'&&Number.isSafeInteger(p.RecordId)&&p.RecordId>0&&typeof canDelete==='function')return;
 throw Error('DNS 操作不允许');
}
export function createDnsClient({secretId,secretKey,allowWrites=false,expectedAddress,canDelete,fetcher=fetch,clock=()=>Math.floor(Date.now()/1000)}){
 if(typeof secretId!=='string'||!secretId||typeof secretKey!=='string'||!secretKey||typeof fetcher!=='function')throw Error('DNS 凭据不可用');
 return async(action,params)=>{
  check(action,params,{allowWrites,expectedAddress,canDelete});
  if(action==='DeleteRecord'&&!await canDelete(params.RecordId))throw Error('DNS 删除未获得记录所有权');
  const timestamp=clock();if(!Number.isSafeInteger(timestamp)||timestamp<1)throw Error('系统时间无效');const date=new Date(timestamp*1000).toISOString().slice(0,10),body=JSON.stringify(params),scope=date+'/dnspod/tc3_request';
  const canonical='POST\n/\n\ncontent-type:'+contentType+'\nhost:'+host+'\n\ncontent-type;host\n'+hash(body),stringToSign='TC3-HMAC-SHA256\n'+timestamp+'\n'+scope+'\n'+hash(canonical),key=hmac(hmac(hmac(Buffer.from('TC3'+secretKey),date),'dnspod'),'tc3_request'),signature=createHmac('sha256',key).update(stringToSign).digest('hex');
  const authorization='TC3-HMAC-SHA256 Credential='+secretId+'/'+scope+', SignedHeaders=content-type;host, Signature='+signature;
  let response,data;try{response=await fetcher('https://'+host+'/',{method:'POST',headers:{Authorization:authorization,'Content-Type':contentType,'X-TC-Action':action,'X-TC-Version':'2021-03-23','X-TC-Timestamp':String(timestamp)},body,redirect:'error',signal:AbortSignal.timeout(15000)});if(!response.ok)throw Error();data=await response.json()}catch{throw Error('DNS 接口未确认')}
  if(!data?.Response||typeof data.Response!=='object')throw Error('DNS 回执无效');if(data.Response.Error)throw Object.assign(Error('DNS 接口拒绝操作'),{code:String(data.Response.Error.Code||'UNKNOWN')});return data.Response;
 };
}
