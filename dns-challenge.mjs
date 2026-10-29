import {randomUUID} from 'node:crypto';
const zone='zenithjoy.tech',name='_acme-challenge.exam',host='exam.zenithjoy.tech';
const valid=s=>typeof s==='string'&&/^[A-Za-z0-9_-]{43}$/.test(s);
const uuid=s=>typeof s==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
function checkRecord(record,receipt){return record?.Id===receipt.recordId&&record.SubDomain===name&&record.RecordType==='TXT'&&record.Value===receipt.validation&&record.Remark==='classroom-acme-'+receipt.operationId}
export async function createChallenge({identifier,validation,api,persist}){
 if(identifier!==host||!valid(validation)||typeof api!=='function'||typeof persist!=='function')throw Error('证书验证请求无效');
 const operationId=randomUUID(),intent={state:'creating',operationId,validation};await persist(intent);
 let result;try{result=await api('CreateRecord',{Domain:zone,SubDomain:name,RecordType:'TXT',RecordLine:'默认',Value:validation,TTL:600,Remark:'classroom-acme-'+operationId})}catch{throw Object.assign(Error('DNS 创建结果未知，需按操作编号核实'),{code:'CREATE_UNCONFIRMED',operationId})}
 if(!Number.isSafeInteger(result?.RecordId)||result.RecordId<1)throw Object.assign(Error('DNS 创建结果未确认'),{code:'CREATE_UNCONFIRMED',operationId});
 const receipt={state:'created',operationId,recordId:result.RecordId,validation};
 try{await persist(receipt)}catch{throw Object.assign(Error('DNS 记录回执保存失败，需核实'),{code:'RECEIPT_UNCONFIRMED',recordId:receipt.recordId})}
 const current=await api('DescribeRecord',{Domain:zone,RecordId:receipt.recordId});
 if(!checkRecord(current?.RecordInfo,receipt))throw Object.assign(Error('DNS 记录内容未确认'),{code:'RECORD_UNCONFIRMED',recordId:receipt.recordId});
 return receipt;
}
export async function removeChallenge({receipt,api}){
 if(!receipt||!Number.isSafeInteger(receipt.recordId)||receipt.recordId<1||!valid(receipt.validation)||!uuid(receipt.operationId)||typeof api!=='function')throw Error('证书验证回执无效');
 const current=await api('DescribeRecord',{Domain:zone,RecordId:receipt.recordId});
 if(!checkRecord(current?.RecordInfo,receipt))throw Error('验证记录已改变，禁止删除');
 await api('DeleteRecord',{Domain:zone,RecordId:receipt.recordId});
}
