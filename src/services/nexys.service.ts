import { Injectable, Logger } from '@nestjs/common';
import { createClient } from 'soap';
import { NEXSYS_CONFIG } from '../config/env.config';

@Injectable()
export class NexsysService {
  private readonly logger = new Logger(NexsysService.name);
  private soapClient: any;

  constructor() {
    this.initClient();
  }

  private async initClient() {
    try {
      this.soapClient = await new Promise((resolve, reject) => {
        createClient(NEXSYS_CONFIG.WSDL_URL, (err, client) => {
          if (err) reject(err);
          resolve(client);
        });
      });
      this.logger.log('API SOAP Nexys inicializado correctamente');
    } catch (error) {
      this.logger.error('Error al inicializar el cliente SOAP:', error.message);
    }
  }

  // Método para StoreProductByMarks
  async storeProductByMark(mark: string) {
    const args = {
      Marks: mark,
      WSClient: {
        username: 'arturo.esguerra@advanceit.co',
        passwd: 'Gpv32[5}(,+p',
        country: 'CO',
      },
    };
    return new Promise((resolve, reject) => {
      this.soapClient.StoreProductByMarks(args, (err, result) => {
        if (err) {
          this.logger.error('Error en StoreProductByMarks:', err.message);
          reject(err);
        } else {
          resolve(result);
        }
      });
    });
  }

  // Método para StoreProductBySKU
  async storeProductBySKU(sku: string) {
    const args = {
      SKU: sku,
      WSClient: NEXSYS_CONFIG.CREDENTIALS,
    };
    return new Promise((resolve, reject) => {
      this.soapClient.StoreProductBySKU(args, (err, result) => {
        if (err) {
          this.logger.error('Error en StoreProductBySKU:', err.message);
          reject(err);
        } else {
          resolve(result);
        }
      });
    });
  }

  // Método para StoreProducts (paginación)
  async storeProducts(offset: number, perPage: number) {
    const args = {
      Offset: offset,
      PerPage: perPage,
      WSClient: {
        username: 'arturo.esguerra@advanceit.co',
        passwd: 'Gpv32[5}(,+p',
        country: 'CO',
      },
    };
    return new Promise((resolve, reject) => {
      this.soapClient.StoreProducts(args, (err, result) => {
        if (err) {
          this.logger.error('Error en StoreProducts:', err.message);
          reject(err);
        } else {
          resolve(result);
        }
      });
    });
  }
}
