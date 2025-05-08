/* Controlador NestJS: ingram.controller.ts */
import { Controller, Post, Body, Get, Param } from '@nestjs/common';
import { IngramService } from '../services/ingram.service';
import { ProductDetails, ProductoIngram, ProductAndDetailsResponse } from 'src/models/ingram.models';
import { ProductsService } from './../services/products.service';

class PriceRequestDto {
  ingramPartNumbers: string[];
}

@Controller('ingram')
export class IngramController {
  constructor(private readonly ingramService: IngramService, private productsService: ProductsService) {}

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

    let response = await this.ingramService.getProductsAndDetailsBatch(dto.ingramPartNumbers);
    if(response.success){
      await this.productsService.saveAll(response);
    }
    return response;
  }

  @Get()
  test(@Body() dto: PriceRequestDto) {
    console.log(dto);

    return 'API ingram is running.';
  }
}

