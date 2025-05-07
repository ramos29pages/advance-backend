/* Controlador NestJS: ingram.controller.ts */
import { Controller, Post, Body, Get, Param } from '@nestjs/common';
import { IngramService } from '../services/ingram.service';
import { ProductDetails, ProductoIngram, ProductAndDetailsResponse } from 'src/models/ingram.models';

class PriceRequestDto {
  ingramPartNumbers: string[];
}

@Controller('ingram')
export class IngramController {
  constructor(private readonly ingramService: IngramService) {}

  @Post('products')
  async priceAvailability(@Body() dto: PriceRequestDto) {
    //array de 5000mil skus
    const result = await this.ingramService.processProducts(
      dto.ingramPartNumbers,
    );

    return result;
  }

  @Post('products-details')
  async getOne(
    @Body() dto: PriceRequestDto
  ): Promise<ProductAndDetailsResponse> {
    return this.ingramService.getProductsAndDetailsBatch(dto.ingramPartNumbers);
  }

  @Get()
  test(@Body() dto: PriceRequestDto) {
    console.log(dto);

    return 'API ingram is running.';
  }
}

