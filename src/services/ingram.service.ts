/* Servicio NestJS: ingram.service.ts */
import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { ConfigService } from '@nestjs/config';
import { v4 as uuidv4 } from 'uuid';
import { SKUS } from 'src/constants/ingramPartNumbers';

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

  constructor(
    private httpService: HttpService,
    private config: ConfigService,
  ) {
    this.clientId = this.config.get<string>('INGRAM_CLIENT_ID');
    this.clientSecret = this.config.get<string>('INGRAM_CLIENT_SECRET');
    this.customerNumber = this.config.get<string>('INGRAM_CUSTOMER_NUMBER');
    this.senderId = this.config.get<string>('INGRAM_SENDER_ID');
    console.log('SKUS LOADES:: ',SKUS);
    console.log('SKUS LOADES length:: ',SKUS.length);
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

  async processProducts(ingramPartNumbers: string[]) {
    const batchSize = 50;
    const numProducts = ingramPartNumbers.length;
    const allResults: any[] = [];
  
    for (let i = 0; i < numProducts; i += batchSize) {
        const batch = ingramPartNumbers.slice(i, i + batchSize);
        console.log(`🚀 Procesando lote ${i / batchSize + 1} de ${Math.ceil(numProducts / batchSize)}`);
        const products = await this.getPriceAndAvailability(batch);
        allResults.push(...products);
    }
  
    console.log('🏁 ❇️❇️❇️ Proceso de obtención de productos completado.');
    console.log('❇️❇️❇️ Cantidad de productos encontrados==> ', allResults.length);
    return allResults;
  }
}


