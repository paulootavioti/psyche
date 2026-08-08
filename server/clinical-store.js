import { postgresPool, withTenant } from './db/postgres.js';

export function postgresClinicalStore(pool=postgresPool()){
  return{
    kind:'postgres',
    async listRecords(clinicId,patientId,{type=null,actorRole,actorId}){
      return withTenant(pool,clinicId,async client=>{
        const conditions=['r.patient_id=$1','r.clinic_id=$2'],values=[patientId,clinicId];
        if(type){values.push(type);conditions.push(`r.type=$${values.length}`);}
        if(actorRole!=='admin'){values.push(actorId);conditions.push(`(r.visibility='record' OR r.professional_id=$${values.length})`);}
        const{rows}=await client.query(`SELECT r.*,u.name professional_name FROM clinical_records r JOIN users u ON u.id=r.professional_id WHERE ${conditions.join(' AND ')} ORDER BY r.occurred_at DESC,r.created_at DESC LIMIT 500`,values);
        return rows;
      });
    },
    async createRecord(clinicId,record){
      return withTenant(pool,clinicId,async client=>{
        await client.query('SELECT pg_advisory_xact_lock(hashtext($1),hashtext($2))',[`${clinicId}:${record.patientId}`,record.type]);
        const version=Number((await client.query('SELECT COALESCE(MAX(version),0)+1 version FROM clinical_records WHERE clinic_id=$1 AND patient_id=$2 AND type=$3',[clinicId,record.patientId,record.type])).rows[0].version);
        const{rows}=await client.query(`INSERT INTO clinical_records(id,clinic_id,patient_id,professional_id,session_id,type,title,content_encrypted,visibility,status,version,occurred_at,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,[record.id,clinicId,record.patientId,record.professionalId,record.sessionId,record.type,record.title,record.contentEncrypted,record.visibility,record.status,version,record.occurredAt,record.createdAt]);
        return rows[0];
      });
    },
    async removeRecord(clinicId,id){return withTenant(pool,clinicId,client=>client.query('DELETE FROM clinical_records WHERE id=$1 AND clinic_id=$2',[id,clinicId]));},
    close(){return pool.end();}
  };
}
