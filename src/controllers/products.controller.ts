// src/products/products.controller.ts
import { Controller, Post, Body, Get } from '@nestjs/common';
import { ProductsService } from '../services/products.service';
import { ProductAndDetailsResponse } from '../models/ingram.models';

@Controller('advance-products')
export class ProductsController {
  constructor(private readonly svc: ProductsService) {}

  @Post('batch')
  async saveBatch(@Body() payload: ProductAndDetailsResponse) {
    await this.svc.saveAll(payload);
    return { message: 'Batch guardado' };
  }

  @Get()
  async list() {
    return this.svc.findAll();
  }
}
