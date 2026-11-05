import {randomBytes} from 'node:crypto';
export class CandidateSessions {
 constructor({clock=()=>Date.now(),ttl=5*60*60*1000,maxSessions=500,allowed=()=>true}={}){this.allowed=allowed;this.clock=clock;this.ttl=ttl;this.maxSessions=maxSessions;this.sessions=new Map()}
 create(token,username){if(typeof token!=='string'||!token)throw Error('登录失败');if(this.sessions.size>=this.maxSessions)this.sessions.delete(this.sessions.keys().next().value);const id=randomBytes(32).toString('hex');this.sessions.set(id,{token,username,expires:this.clock()+this.ttl});return id}
 get(id){const s=this.sessions.get(id);if(!s||s.expires<=this.clock()||!this.allowed(s.username)){this.sessions.delete(id);return null}s.expires=this.clock()+this.ttl;return s.token}
 delete(id){this.sessions.delete(id)}
}
export function validateQuizId(value){if(!/^[1-9]\d{0,9}$/.test(String(value)))throw Error('考试编号无效');return Number(value)}
export function allowedAnswers(data){if(!data||Array.isArray(data)||typeof data!=='object'||Object.keys(data).length>1200)throw Error('答题数据无效');for(const [k,v] of Object.entries(data)){if(typeof v!=='string'||v.length>10000||(/^q\d+:\d+_answer$/.test(k)&&v.length>2000&&data[k+'format']!=='2'))throw Error('答题字段无效');if(/^q\d+:\d+_choice[0-9]$/.test(k)){if(!['0','1'].includes(v))throw Error('多选答案无效')}else if(/^q\d+:\d+_answerformat$/.test(k)){if(v!=='2')throw Error('简答格式无效')}else if(!/^q\d+:\d+_(?:answer|:sequencecheck)$/.test(k))throw Error('答题字段无效')}return data}
