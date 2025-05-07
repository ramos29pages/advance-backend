import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  // "https://co.ingrammicro.com/cep/app/product/productdetails?id=6281595",
  // "https://co.ingrammicro.com/cep/app/product/productdetails?id=5735761",
  // "https://co.ingrammicro.com/cep/app/product/productdetails?id=6281595",
  // "https://co.ingrammicro.com/cep/app/product/productdetails?id=6281596",
  // "https://co.ingrammicro.com/cep/app/product/productdetails?id=6281597"

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }
}
