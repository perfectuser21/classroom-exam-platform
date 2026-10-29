import {randomBytes} from 'node:crypto';
export class StaffSessions{
 constructor({identity,clock=Date.now,ttl=8*60*60*1000,max=100}){Object.assign(this,{identity,clock,ttl,max});this.sessions=new Map()}
 create(username){for(const [key,value] of this.sessions)if(value.expires<=this.clock())this.sessions.delete(key);if(this.sessions.size>=this.max)throw Error('会话数量已满');if(!this.identity(username))throw Error('账号不可用');const token=randomBytes(32).toString('base64url');this.sessions.set(token,{username,expires:this.clock()+this.ttl});return token}
 get(token){if(typeof token!=='string'||!/^[a-zA-Z0-9_-]{43}$/.test(token))return null;const session=this.sessions.get(token);if(!session)return null;if(session.expires<=this.clock()){this.sessions.delete(token);return null}const user=this.identity(session.username);if(!user)this.sessions.delete(token);return user||null}
 revoke(username){for(const [token,session] of this.sessions)if(session.username===username)this.sessions.delete(token)}
 delete(token){this.sessions.delete(token)}
}
