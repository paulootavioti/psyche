CREATE UNIQUE INDEX IF NOT EXISTS uq_clinical_record_version
  ON clinical_records(clinic_id,patient_id,type,version);
