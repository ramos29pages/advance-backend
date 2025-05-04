import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { IngramController } from './controllers/ingram.controller';
import { IngramService } from './services/ingram.service';
import { ProductScraperController } from './controllers/product-scraper.controller';
import { ProductScraperService } from './services/product-scraper.service';

@Module({
  imports: [
    HttpModule,
    ConfigModule.forRoot({
      isGlobal: true, // para que las variables de entorno estén disponibles en toda la aplicación
    }),
  ],
  controllers: [AppController, IngramController, ProductScraperController],
  providers: [AppService, IngramService, ProductScraperService],
})
export class AppModule {}
