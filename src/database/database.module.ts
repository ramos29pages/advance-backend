// src/database/database.module.ts
import { Module } from '@nestjs/common';
import { databaseProviders } from './database.provider';
import { ProductsController } from 'src/controllers/products.controller';

@Module({
  providers: [...databaseProviders],
  exports: [...databaseProviders],
})
export class DatabaseModule {}
