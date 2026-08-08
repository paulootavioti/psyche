INSERT INTO plans(key,name,modules_json,limits_json,active,created_at) VALUES
('essential','Essencial','["core","clinical","communication"]','{"users":1,"units":1,"patients":300,"storage_mb":1024}',true,now()),
('professional','Profissional','["core","clinical","finance","communication","analytics","telehealth"]','{"users":5,"units":2,"patients":1500,"storage_mb":5120}',true,now()),
('clinic','Clínica','["core","clinical","finance","inventory","communication","marketing","analytics","telehealth"]','{"users":50,"units":10,"patients":15000,"storage_mb":51200}',true,now()),
('enterprise','Enterprise','["core","clinical","finance","inventory","communication","marketing","analytics","telehealth"]','{"users":null,"units":null,"patients":null,"storage_mb":null}',true,now())
ON CONFLICT(key) DO UPDATE SET name=excluded.name,modules_json=excluded.modules_json,limits_json=excluded.limits_json,active=excluded.active;
