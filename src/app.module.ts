import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { IngramController } from './controllers/ingram.controller';
import { IngramService } from './services/ingram.service';

@Module({
  imports: [
    HttpModule,
    ConfigModule.forRoot({
      isGlobal: true, // para que las variables de entorno estén disponibles en toda la aplicación
    }),
  ],
  controllers: [AppController, IngramController],
  providers: [AppService, IngramService],
})
export class AppModule {}
