export class DraftSaver {
 constructor({key,storage,send}){this.key=key;this.storage=storage;this.send=send;this.flight=null;this.version=0;this.status='saved';this.draft=null;const raw=storage.getItem(key);if(raw){const value=JSON.parse(raw);if(!value||typeof value!=='object'||Array.isArray(value))throw Error('本地草稿损坏');this.draft=value;this.status='unsent';this.version=1}}
 update(value){if(!value||typeof value!=='object'||Array.isArray(value))throw Error('答案格式错误');const copy=JSON.parse(JSON.stringify(value));this.storage.setItem(this.key,JSON.stringify(copy));this.draft=copy;this.version++;this.status='unsent'}
 async flush(){if(this.flight)return this.flight;if(!this.draft)return;this.flight=this.run();try{await this.flight}finally{this.flight=null}}
 async run(){while(this.draft){const version=this.version,copy=JSON.parse(JSON.stringify(this.draft));this.status='saving';try{await this.send(copy)}catch{this.status='unsent';return}if(this.version===version){this.storage.removeItem(this.key);this.draft=null;this.status='saved'}else{this.status='unsent'}}}
 clear(){this.storage.removeItem(this.key);this.draft=null;this.version++;this.status='saved'}
}
export async function retryCandidate({saver,active,expired,finished,submitting,submit,report}){
 if(!saver||!active()||finished||submitting)return;
 if(expired){await submit(false,true);return}
 if(!saver.draft||saver.flight)return;
 await saver.flush();if(active())report();
}
