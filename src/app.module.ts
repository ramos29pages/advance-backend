import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { IngramController } from './controllers/ingram.controller';
import { IngramService } from './services/ingram.service';
import { ProductScraperController } from './controllers/product-scraper.controller';
import { ProductScraperService } from './services/product-scraper.service';
import { DatabaseModule } from './database/database.module';
import { ProductsController } from './controllers/products.controller';
import { ProductsService } from './services/products.service';

@Module({
  imports: [
    HttpModule,
    DatabaseModule,
    ConfigModule.forRoot({
      isGlobal: true, // para que las variables de entorno estén disponibles en toda la aplicación
    }),
  ],
  controllers: [AppController, IngramController, ProductScraperController, ProductsController],
  providers: [AppService, IngramService, ProductScraperService, ProductsService],
})
export class AppModule {}
