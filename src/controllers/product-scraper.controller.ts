import { Controller, Post, Body } from "@nestjs/common";
import { ProductScraperService } from "../services/product-scraper.service";

interface ProductRequest {
  sku: string;
}

@Controller("scraper")
export class ProductScraperController {
  constructor(private readonly scraper: ProductScraperService) {}

  @Post("product")
  async bySku(@Body() body: ProductRequest) {

    // let URL = `https://co.ingrammicro.com/cep/app/product/productdetails?id=6281595`;
    let URL = `https://co.ingrammicro.com/cep/app/product/productdetails?id=${body.sku}`;
    return this.scraper.scrapeProductDetails(URL);
  }
}