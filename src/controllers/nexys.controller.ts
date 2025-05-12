import { Controller, Get, Query, HttpStatus } from '@nestjs/common';
import { NexsysService } from '../services/nexys.service';

@Controller('nexys')
export class NexsysController {
  constructor(private readonly nexsysService: NexsysService) {}

  // Endpoint REST para StoreProductByMarks
  @Get('products-by-mark')
  async getProductByMark(@Query('mark') mark: string) {
    try {
      const response = await this.nexsysService.storeProductByMark(mark);
      return { data: response, status: HttpStatus.OK };
    } catch (error) {
      return { error: 'SOAP request failed', details: error.message, status: HttpStatus.INTERNAL_SERVER_ERROR };
    }
  }

  // Endpoint REST para StoreProductBySKU
  @Get('product-by-sku')
  async getProductBySKU(@Query('sku') sku: string) {
    try {
      const response = await this.nexsysService.storeProductBySKU(sku);
      return { data: response, status: HttpStatus.OK };
    } catch (error) {
      return { error: 'SOAP request failed', details: error.message, status: HttpStatus.INTERNAL_SERVER_ERROR };
    }
  }

  // Endpoint REST para StoreProducts (paginación)
  @Get('all-products')
  async getAllProducts(
    @Query('offset') offset: number = 0,
    @Query('perPage') perPage: number = 10,
  ) {
    try {
      const response = await this.nexsysService.storeProducts(offset, perPage);
      return { data: response, status: HttpStatus.OK };
    } catch (error) {
      return { error: 'SOAP request failed', details: error.message, status: HttpStatus.INTERNAL_SERVER_ERROR };
    }
  }
}