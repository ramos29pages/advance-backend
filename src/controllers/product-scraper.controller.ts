// product-scraper.controller.ts
import { Controller, Get, Post, Body, Query, UseInterceptors, UploadedFile, HttpStatus, HttpException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ProductScraperService } from '../services/product-scraper.service';
import * as fs from 'fs';
import * as path from 'path';
import * as csv from 'csv-parser';
import { createReadStream, writeFileSync } from 'fs';
import { join } from 'path';

interface ScrapeUrlDto {
  url: string;
}

interface ScrapeMultipleUrlsDto {
  urls: string[];
}

@Controller('scraper')
export class ProductScraperController {
  constructor(private readonly scraperService: ProductScraperService) {}

  @Post('single')
  async scrapeProduct(@Body() body: ScrapeUrlDto) {
    try {
      if (!body.url) {
        throw new HttpException('URL es requerida', HttpStatus.BAD_REQUEST);
      }
      
      const result = await this.scraperService.scrapeProductDetails(body.url);
      
      if (!result) {
        throw new HttpException('No se pudo extraer información del producto', HttpStatus.NOT_FOUND);
      }
      
      return {
        success: true,
        data: result
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      
      throw new HttpException(
        `Error al extraer información: ${(error as Error).message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Post('multiple')
  async scrapeMultipleProducts(@Body() body: ScrapeMultipleUrlsDto) {
    try {
      if (!body.urls || !Array.isArray(body.urls) || body.urls.length === 0) {
        throw new HttpException('Se requiere un array de URLs', HttpStatus.BAD_REQUEST);
      }
      
      // Limitar el número máximo de URLs para evitar abuso
      const MAX_URLS = 50;
      if (body.urls.length > MAX_URLS) {
        throw new HttpException(
          `Número máximo de URLs excedido. Máximo permitido: ${MAX_URLS}`,
          HttpStatus.BAD_REQUEST
        );
      }
      
      const results = await this.scraperService.scrapeMultipleProducts(body.urls);
      
      return {
        success: true,
        total: body.urls.length,
        successful: results.filter(r => r !== null).length,
        failed: results.filter(r => r === null).length,
        data: results
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      
      throw new HttpException(
        `Error al procesar múltiples URLs: ${(error as Error).message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Post('upload-csv')
  @UseInterceptors(FileInterceptor('file'))
  async uploadCSV(@UploadedFile() file) {
    if (!file) {
      throw new HttpException('No se subió ningún archivo', HttpStatus.BAD_REQUEST);
    }

    if (path.extname(file.originalname).toLowerCase() !== '.csv') {
      throw new HttpException('El archivo debe ser un CSV', HttpStatus.BAD_REQUEST);
    }

    // Guardar temporalmente el archivo
    const tempFilePath = join(process.cwd(), 'temp', `${Date.now()}_${file.originalname}`);
    const dir = path.dirname(tempFilePath);
    
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    writeFileSync(tempFilePath, file.buffer);
    
    try {
      // Procesar el CSV
      const urls: string[] = [];
      
      await new Promise<void>((resolve, reject) => {
        createReadStream(tempFilePath)
          .pipe(csv())
          .on('data', (row) => {
            // Intentar encontrar la columna URL (puede tener diferentes nombres)
            const url = row.url || row.URL || row.enlace || row.link || 
                       Object.values(row).find(val => 
                         typeof val === 'string' && 
                         (val.startsWith('http://') || val.startsWith('https://'))
                       );
            
            if (url) urls.push(url);
          })
          .on('end', () => resolve())
          .on('error', (error) => reject(error));
      });
      
      // Eliminar archivo temporal
      fs.unlinkSync(tempFilePath);
      
      if (urls.length === 0) {
        throw new HttpException(
          'No se encontraron URLs válidas en el archivo CSV', 
          HttpStatus.BAD_REQUEST
        );
      }
      
      // Iniciar proceso de scraping
      const jobId = Date.now().toString();
      this.processUrlsInBackground(jobId, urls);
      
      return {
        success: true,
        message: 'Procesamiento iniciado',
        jobId,
        totalUrls: urls.length
      };
    } catch (error) {
      // Asegurarse de limpiar el archivo temporal en caso de error
      if (fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath);
      }
      
      throw new HttpException(
        `Error al procesar el archivo CSV: ${(error as Error).message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get('job-status')
  async getJobStatus(@Query('jobId') jobId: string) {
    const resultsPath = join(process.cwd(), 'results', `${jobId}.json`);
    
    if (!jobId) {
      throw new HttpException('Se requiere un ID de trabajo', HttpStatus.BAD_REQUEST);
    }
    
    if (!fs.existsSync(resultsPath)) {
      // Verificar si el trabajo está en progreso
      const inProgressPath = join(process.cwd(), 'results', `${jobId}_in_progress.json`);
      
      if (fs.existsSync(inProgressPath)) {
        try {
          const progressData = JSON.parse(fs.readFileSync(inProgressPath, 'utf8'));
          return {
            success: true,
            status: 'in_progress',
            progress: progressData
          };
        } catch {
          return {
            success: true,
            status: 'in_progress',
            message: 'Trabajo en progreso'
          };
        }
      
      return {
        success: false,
        status: 'not_found',
        message: 'Trabajo no encontrado'
      };
    }
    
    try {
      const results = JSON.parse(fs.readFileSync(resultsPath, 'utf8'));
      return {
        success: true,
        status: 'completed',
        data: results
      };
    } catch (error) {
      throw new HttpException(
        `Error al leer resultados: ${(error as Error).message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }
  
  // @Get('download-results')
  // async downloadResults(@Query('jobId') jobId: string) {
  //   if (!jobId) {
  //     throw new HttpException('Se requiere un ID de trabajo', HttpStatus.BAD_REQUEST);
  //   }
    
  //   const resultsPath = join(process.cwd(), 'results', `${jobId}.json`);
    
  //   if (!fs.existsSync(resultsPath)) {
  //     throw new HttpException('Resultados no encontrados', HttpStatus.NOT_FOUND);
  //   }
    
  //   try {
  //     const results = fs.readFileSync(resultsPath, 'utf8');
  //     return JSON.parse(results);
  //   } catch (error) {
  //     throw new HttpException(
  //       `Error al leer resultados: ${(error as Error).message}`,
  //       HttpStatus.INTERNAL_SERVER_ERROR
  //     );
  //   }
  // }
}
  
  private async processUrlsInBackground(jobId: string, urls: string[]): Promise<void> {
    // Crear directorio de resultados si no existe
    const resultsDir = join(process.cwd(), 'results');
    if (!fs.existsSync(resultsDir)) {
      fs.mkdirSync(resultsDir, { recursive: true });
    }
    
    // Archivo para seguimiento de progreso
    const progressPath = join(resultsDir, `${jobId}_in_progress.json`);
    const finalPath = join(resultsDir, `${jobId}.json`);
    
    // Inicializar archivo de progreso
    const initialProgress = {
      totalUrls: urls.length,
      processed: 0,
      successful: 0,
      failed: 0,
      lastUpdated: new Date().toISOString()
    };
    
    fs.writeFileSync(progressPath, JSON.stringify(initialProgress, null, 2));
    
    // Procesar URLs en lotes para evitar sobrecarga
    const results: any[] = [];
    const batchSize = 5;
    
    try {
      // Dividir URLs en lotes
      for (let i = 0; i < urls.length; i += batchSize) {
        const batch = urls.slice(i, i + batchSize);
        const batchResults = await this.scraperService.scrapeMultipleProducts(batch);
        
        results.push(...batchResults);
        
        // Actualizar progreso
        const progress = {
          totalUrls: urls.length,
          processed: i + batch.length,
          successful: results.filter(r => r !== null).length,
          failed: results.filter(r => r === null).length,
          lastUpdated: new Date().toISOString()
        };
        
        fs.writeFileSync(progressPath, JSON.stringify(progress, null, 2));
      }
      
      // Guardar resultados finales
      fs.writeFileSync(finalPath, JSON.stringify({
        totalUrls: urls.length,
        successful: results.filter(r => r !== null).length,
        failed: results.filter(r => r === null).length,
        completedAt: new Date().toISOString(),
        results
      }, null, 2));
      
      // Eliminar archivo de progreso
      if (fs.existsSync(progressPath)) {
        fs.unlinkSync(progressPath);
      }
    } catch (error) {
      // En caso de error, guardar el progreso actual como resultado final
      fs.writeFileSync(finalPath, JSON.stringify({
        totalUrls: urls.length,
        successful: results.filter(r => r !== null).length,
        failed: results.filter(r => r === null).length,
        error: (error as Error).message,
        completedAt: new Date().toISOString(),
        results
      }, null, 2));
      
      // Eliminar archivo de progreso
      if (fs.existsSync(progressPath)) {
        fs.unlinkSync(progressPath);
      }
    }
  }
}