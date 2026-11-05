export const roleMatrix={
 admin:{scope:'all',login:'password',ownPassword:false},
 staff:{scope:'legacy-staff',login:'password',ownPassword:false},
 class_teacher:{scope:'own-classes',login:'phone',ownPassword:false},
 instructor:{scope:'own-classes',login:'phone',ownPassword:false},
 examiner:{scope:'unfinished-scoring',login:'password',ownPassword:false},
 student:{scope:'self',login:'phone',ownPassword:true}
};
export const roles=new Set(Object.keys(roleMatrix));
export function presentIdentity(username,role){
 const rule=roleMatrix[role];
 if(!rule||typeof username!=='string')return null;
 return {username,role,scope:rule.scope};
}
