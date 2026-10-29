export class AdminLimiter{
 constructor({clock=Date.now,maxAttempts=20,windowMs=60000,maxBuckets=1000}={}){Object.assign(this,{clock,maxAttempts,windowMs,maxBuckets});this.buckets=new Map()}
 allowed(address){const item=this.buckets.get(address);if(!item)return true;if(this.clock()-item.since>=this.windowMs){this.buckets.delete(address);return true}return item.count<this.maxAttempts}
 fail(address){if(typeof address!=='string'||!address)address='unknown';const now=this.clock();let item=this.buckets.get(address);if(!item||now-item.since>=this.windowMs){if(!item&&this.buckets.size>=this.maxBuckets)this.buckets.delete(this.buckets.keys().next().value);item={since:now,count:0};this.buckets.set(address,item)}item.count++}
 success(address){this.buckets.delete(address)}
}
