/* Servicio NestJS: ingram.service.ts */
import { Injectable, HttpException, HttpStatus, Logger, NotFoundException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { ConfigService } from '@nestjs/config';
import { v4 as uuidv4 } from 'uuid';
import { ingramPartDellNumbers } from 'src/constants/ingramPartDellNumbers';
import { ProductScraperService } from './product-scraper.service';
import { ProductoIngram } from 'src/models/ingram.models';
import pLimit from 'p-limit';
import { ProductDetails } from 'src/models/ingram.models';
import { SKUS } from './../constants/ingramPartNumbers';


interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: string;
}

interface PriceAvailabilityBody {
  products: { ingramPartNumber: string }[];
}

@Injectable()
export class IngramService {
  private clientId: string | undefined;
  private clientSecret: string | undefined;
  private customerNumber: string | undefined;
  private senderId: string | undefined;
  private URL_XADVANTAGE: string =
    'https://co.ingrammicro.com/cep/app/product/productdetails?id=';

  private readonly logger = new Logger(IngramService.name);
  private readonly batchSize = 50;


  constructor(
    private httpService: HttpService,
    private config: ConfigService,
    private scraperService: ProductScraperService,
  ) {
    this.clientId = this.config.get<string>('INGRAM_CLIENT_ID');
    this.clientSecret = this.config.get<string>('INGRAM_CLIENT_SECRET');
    this.customerNumber = this.config.get<string>('INGRAM_CUSTOMER_NUMBER');
    this.senderId = this.config.get<string>('INGRAM_SENDER_ID');
    // console.log('SKUS DELL LOADES:: ', ingramPartDellNumbers);
    this.logger.log(`cantidade de productos Dell ${ingramPartDellNumbers.length}`);
   }

  private async getAccessToken(): Promise<string> {
    const url = 'https://api.ingrammicro.com:443/oauth/oauth30/token';
    const payload = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: this.clientId ?? '',
      client_secret: this.clientSecret ?? '',
    });

    try {
      const response$ = this.httpService.post<TokenResponse>(
        url,
        payload.toString(),
        {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        },
      );
      const response = await firstValueFrom(response$);
      return response.data.access_token;
    } catch (err) {
      console.log(err);
      throw new HttpException(
        'Error obteniendo token de Ingram',
        HttpStatus.BAD_GATEWAY,
      );
    }
  }

  async getPriceAndAvailability(ingramPartNumbers: string[]): Promise<any> {
    const token = await this.getAccessToken();
    const url =
      'https://api.ingrammicro.com:443/resellers/v6/catalog/priceandavailability?includeAvailability=true&includePricing=true';
    const correlationId: string = uuidv4();
    const headers = {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'IM-CustomerNumber': this.customerNumber,
      'IM-CountryCode': 'CO',
      'IM-SenderID': this.senderId,
      'IM-CorrelationID': correlationId,
    };

    const body: PriceAvailabilityBody = {
      products: ingramPartNumbers.map((num) => ({ ingramPartNumber: num })),
    };

    try {
      const response$ = this.httpService.post(url, body, { headers });
      const response = await firstValueFrom(response$);
      return response.data;
    } catch (err) {
      console.log(err);
      throw new HttpException('Error en API de Ingram', HttpStatus.BAD_GATEWAY);
    }
  }

  async processSingleProduct(
    ingramPartNumber: string,
  ): Promise<ProductoIngram> {
    this.logger.log(`🚀 Procesando producto ${ingramPartNumber}`);
  
    const productsData = await this.getPriceAndAvailability([ingramPartNumber]);  // corregido
  
    // Filtrar sólo los disponibles
    const availableProducts = productsData.filter(
      p => p.availability?.available === true,
    );
  
    if (availableProducts.length === 0) {
      throw new NotFoundException(`Producto ${ingramPartNumber} no disponible`);
    }
  
    // Transformar todos, pero devolver solo el primero
    const transformed = availableProducts.map(p => this.transformProduct(p));
    this.logger.log(`**Proceso completado. Producto disponible`);
  
    return transformed[0];           // ← aquí devolvemos un solo objeto  
  }
  

  /** Extraer y normalizar un solo producto */
  private transformProduct(product: any): ProductoIngram {
    const wh = product.availability?.availabilityByWarehouse?.[0] ?? {};
    return {
      id: uuidv4(),
      SKU: product.ingramPartNumber,
      nombre: product.description || 'no-existe',
      descripcion: product.vendorName || '',
      precio: product.pricing?.customerPrice ?? null,
      descuentos: product.pricing?.webDiscountsAvailable ?? false,
      estado: product.productStatusCode,
      disponibilidad: true, // ya filtramos, siempre es true
      imagen: 'https://aslan.es/wp-content/uploads/2019/05/IngramMicro.png',
      marca: product.vendorName || '',
      categoria: 'Ingram',
      cantidad: wh.quantityAvailable ?? 0,
      warehouse: wh.location ?? null,
      warehouseId: wh.warehouseId ?? null,
      precioRetail: product.pricing?.retailPrice ?? '',
      etiquetas: ['Ingram'],
    };
  }

  async processProducts(
    ingramPartNumbers: string[],
  ): Promise<ProductoIngram[]> {
    const results: ProductoIngram[] = [];
    const totalBatches = Math.ceil(ingramPartNumbers.length / this.batchSize);

    for (let i = 0; i < ingramPartNumbers.length; i += this.batchSize) {
      const batch = ingramPartNumbers.slice(i, i + this.batchSize);
      const batchIndex = i / this.batchSize + 1;
      this.logger.log(`🚀 Procesando lote ${batchIndex} de ${totalBatches}`);

      const productsData = await this.getPriceAndAvailability(batch);
      if (!productsData?.length) continue;

      // Filtrar primero los que tienen availability.available === true
      const availableProducts = productsData.filter(
        (p) => p.availability?.available === true,
      );

      // Transformar solo los filtrados
      const transformed = availableProducts.map((p) =>
        this.transformProduct(p),
      );
      results.push(...transformed);
    }

    this.logger.log(
      `**Proceso completado. Productos disponibles: ${results.length}`,
    );
    return results;
  }

  async getProductsAndDetails(SKU: string): Promise<{ _sku: string; product: ProductoIngram; details: ProductDetails | null } | null> {
    try {
      // Intentamos obtener el producto. Si no existe, processSingleProduct lanza NotFoundException
      const product = await this.processSingleProduct(SKU);
  
      // Si lo obtuvimos, scrapeamos sus detalles
      const details = await this.scraperService.scrapeProductDetails(
        `https://co.ingrammicro.com/cep/app/product/productdetails?id=${SKU}`
      );
  
      return { _sku: SKU, product, details };
    } catch (err) {
      // Si no existe o da cualquier error, lo registramos y devolvemos null para saltarlo en el batch
      this.logger.warn(`⚠️ Producto ${SKU} saltado: ${err.message}`);
      return null;
    }
  }


  async getProductsAndDetailsBatch(
    skus: string[],
  ): Promise<ProductAndDetailsResponse> {
    const limit = pLimit(10);
    const tasks = skus.map(sku =>
      limit(() => this.getProductsAndDetails(sku))
    );
  
    // Ejecutamos todas las promesas
    const results = await Promise.all(tasks);
  
    // Separamos los que sí tienen valor de los null
    const data = results.filter(item => item !== null) as Array<{
      _sku: string;
      product: ProductoIngram;
      details: ProductDetails | null;
    }>;
  
    const found = data.length;
    const nulls = results.length - found;
    const failed = 0;                   // getProductsAndDetails siempre captura internamente errores y devuelve null
    const success = failed === 0;       // true si no hubo fallos inesperados
  
    return { success, found, nulls, failed, data };
  }

}

interface ProductAndDetailsResponse {
  success: boolean;
  found: number;    // cuántos productos se obtuvieron correctamente
  nulls: number;    // cuántos SKUs devolvieron null (no encontrados o error interno)
  failed: number;   // cuántos fallos inesperados (si los hubiera)
  data: Array<{ _sku: string; product: ProductoIngram; details: ProductDetails | null }>;
}
