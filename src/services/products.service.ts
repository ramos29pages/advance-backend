// src/products/products.service.ts
import { Injectable, Inject } from '@nestjs/common';
import { Pool, RowDataPacket } from 'mysql2/promise';
import {
  ProductAdvance,
  ProductAndDetailsResponse,
} from '../models/ingram.models';
import { Logger } from '@nestjs/common';
import { closeSync } from 'fs';

@Injectable()
export class ProductsService {

  private readonly logger = new Logger(ProductsService.name);

  constructor(
    @Inject('MYSQL_POOL') private pool: Pool,
  ) {}



  /** Persiste un arreglo de ProductAdvance en la BD */
  async saveAll(response: ProductAndDetailsResponse): Promise<void> {
    const conn = await this.pool.getConnection();        // transacción :contentReference[oaicite:10]{index=10}
    try {
      await conn.beginTransaction();

      for (const item of response.data) {
        const { _sku, product, details } = item;

        // Insertar o actualizar por SKU
        await conn.query(
          `INSERT INTO advance_products (sku, product_json, details_json)
           VALUES (?, ?, ?)
           ON DUPLICATE KEY UPDATE
             product_json = VALUES(product_json),
             details_json = VALUES(details_json),
             updated_at = NOW();`,
          [
            _sku,
            JSON.stringify(product),
            details ? JSON.stringify(details) : null,
          ],
        );                                           // JSON en MySQL :contentReference[oaicite:11]{index=11}
      }

      
      await conn.commit();
      this.logger.log('Se han registrado exitosamente los productos');
    } catch (err) {
      await conn.rollback();
      this.logger.log(`Error encontrado ${err}`);
      throw err;
    } finally {
      conn.release();
    }
  }

  /** Recupera todos los registros y los convierte a ProductAdvance[] */
  async findAll(): Promise<ProductAdvance[]> {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      'SELECT sku, product_json, details_json FROM advance_products;'
    );

    console.log('Cantidad de productos advance encontrados :: ', rows.length);

    return rows.map(r => ({
      _sku: r.sku,
      product: JSON.parse(r.product_json) as any,
      details: r.details_json ? JSON.parse(r.details_json) : null,
    }));
  }
}
