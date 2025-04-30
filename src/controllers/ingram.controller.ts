/* Controlador NestJS: ingram.controller.ts */
import { Controller, Post, Body, Get } from '@nestjs/common';
import { IngramService } from '../services/ingram.service';

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

  @Get()
  test(@Body() dto: PriceRequestDto) {
    console.log(dto);

    return 'Hello world';
  }
}
