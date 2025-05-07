// src/database/database.providers.ts
import { Provider } from '@nestjs/common';
import { createPool } from 'mysql2/promise';

export const databaseProviders: Provider[] = [
  {
    provide: 'MYSQL_POOL',
    useFactory: async () => {
      const pool = createPool({
        host: 'advanceit.co',         // tu host MySQL :contentReference[oaicite:1]{index=1}
        user: 'ramosdev',        // usuario exacto :contentReference[oaicite:2]{index=2}
        password: 'Wma@aTRT59YR',     // contraseña reseteada 
        database: 'advance_products',    // nombre de la BD :contentReference[oaicite:4]{index=4}
        port: 3306,
        waitForConnections: true,
        connectionLimit: 10,          // pool size recomendado :contentReference[oaicite:5]{index=5}
        queueLimit: 0,
      });
      return pool;
    },
  },
];
