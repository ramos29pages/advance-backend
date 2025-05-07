// product-scraper.service.ts
import { Injectable, Logger } from '@nestjs/common';
import * as puppeteer from 'puppeteer';
import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { ProductDetails } from 'src/models/ingram.models';

@Injectable()
export class ProductScraperService {
  private readonly logger = new Logger(ProductScraperService.name);
  private browserPool: puppeteer.Browser[] = [];
  private readonly MAX_BROWSERS = 3;
  private readonly MAX_PAGES_PER_BROWSER = 3;
  private readonly RETRY_ATTEMPTS = 3;
  private readonly CACHE_DIR = './product_cache';
  private readonly USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Safari/605.1.15',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/119.0',
    'Mozilla/5.0 (iPad; CPU OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1',
  ];
  
  private activeScrapes = 0;
  private readonly SCRAPE_CONCURRENCY_LIMIT = 5;

  constructor() {
    this.setupCacheDirectory();
  }

  private setupCacheDirectory() {
    if (!fs.existsSync(this.CACHE_DIR)) {
      fs.mkdirSync(this.CACHE_DIR, { recursive: true });
    }
  }

  private getCacheFilePath(url: string): string {
    // Crear un hash simple pero único para la URL
    const urlHash = Buffer.from(url).toString('base64')
      .replace(/\//g, '_').replace(/\+/g, '-').replace(/=/g, '');
    return path.join(this.CACHE_DIR, `${urlHash}.json`);
  }

  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private getRandomUserAgent(): string {
    return this.USER_AGENTS[Math.floor(Math.random() * this.USER_AGENTS.length)];
  }

  private async rotateIP(): Promise<void> {
    // Simular cambio de IP (en producción, esto podría usar un proxy real)
    this.logger.log('Rotando IP...');
    await this.delay(1000);
  }

  private async createBrowser(): Promise<puppeteer.Browser> {
    // Generar un directorio único para cada instancia del navegador
    const userDataDir = `./puppeteer_cache_${randomUUID()}`;
    
    return puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-web-security',
        '--disable-features=IsolateOrigins,site-per-process',
        `--window-size=${1366 + Math.floor(Math.random() * 100)},${768 + Math.floor(Math.random() * 50)}`,
        '--disable-notifications',
      ],
      userDataDir,
      defaultViewport: {
        width: 1366 + Math.floor(Math.random() * 100),
        height: 768 + Math.floor(Math.random() * 50),
      },
    });
  }

  private async getBrowser(): Promise<puppeteer.Browser> {
    // Buscar un navegador que tenga menos de MAX_PAGES_PER_BROWSER páginas abiertas
    for (const browser of this.browserPool) {
      try {
        const pages = await browser.pages();
        if (pages.length < this.MAX_PAGES_PER_BROWSER) {
          return browser;
        }
      } catch (error) {
        // Este navegador puede estar en mal estado, lo eliminaremos
        const index = this.browserPool.indexOf(browser);
        if (index > -1) {
          this.browserPool.splice(index, 1);
        }
        try {
          await browser.close();
        } catch {
          // Ignorar errores al cerrar
        }
      }
    }

    // Si no hay navegadores disponibles o todos están llenos, crear uno nuevo
    if (this.browserPool.length < this.MAX_BROWSERS) {
      const newBrowser = await this.createBrowser();
      this.browserPool.push(newBrowser);
      return newBrowser;
    }

    // Si hemos alcanzado el límite de navegadores, usar el primero (política circular)
    const browser = this.browserPool.shift();
    if (!browser) {
      throw new Error('No se pudo obtener un navegador válido');
    }
    
    // Cerrar todas las páginas existentes para limpiar recursos
    try {
      const pages = await browser.pages();
      await Promise.all(pages.map(page => page.close().catch(() => {})));
    } catch {
      // Ignorar errores
    }
    
    this.browserPool.push(browser);
    return browser;
  }

  async scrapeProductDetails(url: string): Promise<ProductDetails | null> {
    // Verificar caché primero
    const cacheFile = this.getCacheFilePath(url);
    if (fs.existsSync(cacheFile)) {
      try {
        const cachedData = fs.readFileSync(cacheFile, 'utf-8');
        return JSON.parse(cachedData);
      } catch (error) {
        this.logger.warn(`Error al leer caché: ${(error as Error).message}`);
        // Continuar con el scraping si hay error en la caché
      }
    }

    // Aplicar límite de concurrencia
    while (this.activeScrapes >= this.SCRAPE_CONCURRENCY_LIMIT) {
      await this.delay(500 + Math.random() * 500);
    }

    this.activeScrapes++;
    let result: ProductDetails | null = null;

    try {
      // Intentar scrapear con reintentos
      for (let attempt = 1; attempt <= this.RETRY_ATTEMPTS; attempt++) {
        try {
          result = await this.doScrape(url);
          if (result) {
            // Guardar en caché
            fs.writeFileSync(cacheFile, JSON.stringify(result, null, 2));
            break;
          }

          if (attempt < this.RETRY_ATTEMPTS) {
            this.logger.log(`Intento ${attempt} fallido, reintentando después de pausa...`);
            await this.delay(2000 + Math.random() * 3000 * attempt);
            await this.rotateIP();
          }
        } catch (error) {
          this.logger.warn(`Error en intento ${attempt}: ${(error as Error).message}`);
          if (attempt === this.RETRY_ATTEMPTS) throw error;

          // Esperar más tiempo entre reintentos
          await this.delay(3000 + Math.random() * 5000 * attempt);
          await this.rotateIP();
        }
      }
    } finally {
      this.activeScrapes--;
    }

    return result;
  }

  private async doScrape(url: string): Promise<ProductDetails | null> {
    const browser = await this.getBrowser();
    let page: puppeteer.Page | undefined;

    try {
      page = await browser.newPage();
      
      // Configurar página para evadir detección
      await this.setupPageAntiDetection(page);

      // Navegar a la página con gestión de tiempos de espera más inteligente
      await page.goto(url, { 
        waitUntil: 'networkidle2', 
        timeout: 30000 
      });

      // Esperar a que la página cargue completamente
      try {
        await this.waitForPageLoad(page);
      } catch (error) {
        this.logger.warn(`Tiempo de espera excedido, continuando: ${(error as Error).message}`);
        // Continuar incluso si hay timeout, intentaremos extraer lo que podamos
      }

      // Extraer los datos
      const detalles = await this.extractData(page);
      return detalles;

    } catch (error) {
      this.logger.error(`Error en doScrape: ${(error as Error).message}`);
      throw error;
    } finally {
      if (page) {
        try {
          await page.close();
        } catch {
          // Ignorar errores al cerrar la página
        }
      }
    }
  }

  private async setupPageAntiDetection(page: puppeteer.Page): Promise<void> {
    // Configurar un user agent aleatorio
    const userAgent = this.getRandomUserAgent();
    await page.setUserAgent(userAgent);
    
    // Configurar encabezados HTTP
    await page.setExtraHTTPHeaders({ 
      'Accept-Language': 'es-CO,es;q=0.9,en;q=0.8',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
      'Accept-Encoding': 'gzip, deflate, br',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
    });

    // Evadir la detección de webdriver
    await page.evaluateOnNewDocument(() => {
      // Eliminar propiedades que revelan que es un navegador automatizado
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
      Object.defineProperty(navigator, 'languages', { get: () => ['es-CO', 'es', 'en-US', 'en'] });
      
      // Sobreescribir funciones de detección comunes
      // @ts-ignore
      window.chrome = { runtime: {} };
      
      // Simular movimiento aleatorio de mouse
      const origQuery = window.navigator.permissions.query;
      // @ts-ignore
      window.navigator.permissions.query = (parameters) => (
        parameters.name === 'notifications' 
          ? Promise.resolve({ state: Notification.permission }) 
          : origQuery(parameters)
      );
    });

    // Habilitar caché para recursos repetidos
    await page.setCacheEnabled(true);

    // Configurar un viewport aleatorio para parecer más humano
    await page.setViewport({
      width: 1366 + Math.floor(Math.random() * 100),
      height: 768 + Math.floor(Math.random() * 50),
      deviceScaleFactor: 1,
      hasTouch: false,
      isLandscape: true,
      isMobile: false,
    });

    // Interceptar solicitudes para optimizar velocidad y evitar recursos innecesarios
    await page.setRequestInterception(true);
    page.on('request', req => {
      const resourceType = req.resourceType();
      const url = req.url();
      
      // Bloquear recursos no esenciales
      if (
        ['stylesheet', 'font', 'media', 'image'].includes(resourceType) ||
        url.includes('google-analytics') ||
        url.includes('facebook') ||
        url.includes('analytics') ||
        url.includes('tracker') ||
        url.includes('advertisement')
      ) {
        req.abort();
      } else {
        req.continue();
      }
    });
  }

  private async waitForPageLoad(page: puppeteer.Page): Promise<void> {
    // Esperar al título del producto con lógica de reintento
    try {
      await page.waitForSelector('span[data-testid="pdp_ProductTitle"]', { 
        timeout: 10000, 
        visible: true 
      });
    } catch (error) {
      // Intenta un selector alternativo
      try {
        await page.waitForFunction(() => {
          return document.querySelector('span[data-testid="pdp_ProductTitle"]') || 
                 document.querySelector('.product-title') ||
                 document.querySelector('h1');
        }, { timeout: 5000 });
      } catch (secondError) {
        // Lanza error si ningún selector funcionó
        throw new Error(`No se encontró el título del producto: ${(error as Error).message}`);
      }
    }

    // Simular comportamiento humano con scroll aleatorio
    await this.simulateHumanBehavior(page);
  }

  private async simulateHumanBehavior(page: puppeteer.Page): Promise<void> {
    // Simular scroll natural
    await page.evaluate(async () => {
      const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
      
      const height = document.body.scrollHeight;
      const sections = 5;
      
      for (let i = 0; i < sections; i++) {
        window.scrollTo({
          top: (height / sections) * i,
          behavior: 'smooth'
        });
        
        await delay(300 + Math.random() * 500);
      }
      
      // Volver arriba
      window.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
    });
    
    // Pausa natural después del scroll
    await this.delay(500 + Math.random() * 1000);
  }

  private async extractData(page: puppeteer.Page): Promise<ProductDetails> {
    return await page.evaluate(() => {
      const getElement = (selector: string) => document.querySelector(selector);
      const getAllElements = (selector: string) => Array.from(document.querySelectorAll(selector));
      const getTextContent = (element: Element | null) => element?.textContent?.trim() ?? null;
      
      // Función para intentar múltiples selectores
      const trySelectorsForText = (selectors: string[]): string | null => {
        for (const selector of selectors) {
          const element = getElement(selector);
          if (element) {
            const text = getTextContent(element);
            if (text) return text;
          }
        }
        return null;
      };
      
      // Función para extraer imágenes con selectores alternativos
      const extractImages = (): string[] => {
        // Intentar primero con el selector original
        const primaryImages = getAllElements('div[data-element="ThumbnailsBox"] img')
          .map(img => img.getAttribute('src') ?? '')
          .filter(src => src !== '');
        
        if (primaryImages.length > 0) return primaryImages;
        
        // Selectores alternativos para imágenes
        const alternativeSelectors = [
          'div.product-images img', 
          '.gallery img', 
          '.product-gallery img', 
          'img.product-image'
        ];
        
        for (const selector of alternativeSelectors) {
          const images = getAllElements(selector)
            .map(img => img.getAttribute('src') ?? '')
            .filter(src => src !== '');
          
          if (images.length > 0) return images;
        }
        
        return [];
      };
      
      // Extraer especificaciones con manejo robusto
      const extractSpecifications = (): Record<string, Record<string, string>> => {
        const specs: Record<string, Record<string, string>> = {};
        
        try {
          // Intentar el selector original primero
          const rows = getAllElements('div[data-testid="TechnicalSpecification"] tr');
          
          if (rows.length > 0) {
            let currentSection: string = 'General';
            specs[currentSection] = {};
            
            rows.forEach(row => {
              const header = row.querySelector('td[colspan="2"]');
              if (header?.textContent) {
                currentSection = header.textContent.trim();
                specs[currentSection] = {};
              } else {
                const columns = row.querySelectorAll('td');
                if (columns.length >= 2) {
                  const key = columns[0]?.textContent?.trim() ?? '';
                  const value = columns[1]?.textContent?.trim() ?? '';
                  if (key) specs[currentSection][key] = value;
                }
              }
            });
            
            return specs;
          }
          
          // Intentar con selectores alternativos
          const specDivs = getAllElements('.specifications div, .product-specs div, .tech-specs div');
          if (specDivs.length > 0) {
            let currentSection = 'General';
            specs[currentSection] = {};
            
            specDivs.forEach(div => {
              const title = div.querySelector('h3, h4, strong');
              if (title?.textContent) {
                currentSection = title.textContent.trim();
                specs[currentSection] = {};
              } else {
                const keyElement = div.querySelector('.spec-name, .spec-key');
                const valueElement = div.querySelector('.spec-value, .spec-val');
                
                if (keyElement && valueElement) {
                  const key = keyElement.textContent?.trim() ?? '';
                  const value = valueElement.textContent?.trim() ?? '';
                  if (key) specs[currentSection][key] = value;
                }
              }
            });
          }
        } catch (error) {
          // Si hay un error, devolver al menos una sección vacía
          specs['General'] = {};
        }
        
        return specs;
      };
      
      // Extraer garantía e información adicional
      const extractWarrantyInfo = (): Record<string, string> => {
        const info: Record<string, string> = {};
        
        try {
          // Intentar selector original
          const warrantySection = getElement('div[data-testid="warrantyAndInfo"]');
          
          if (warrantySection) {
            const paragraphs = getAllElements('div[data-testid="warrantyAndInfo"] p')
              .map(p => p.textContent?.trim() ?? '')
              .filter(t => t !== '');
            
            if (paragraphs.length > 1) {
              paragraphs.slice(1).forEach(line => {
                const parts = line.split(' ');
                if (parts.length > 1) {
                  const key = parts.slice(0, -1).join(' ');
                  const value = parts.slice(-1)[0];
                  info[key] = value;
                }
              });
            }
            
            return info;
          }
          
          // Intentar selectores alternativos
          const warrantyDivs = getAllElements('.warranty, .warranty-info, .additional-info');
          if (warrantyDivs.length > 0) {
            warrantyDivs.forEach(div => {
              const text = div.textContent?.trim() ?? '';
              if (text.includes(':')) {
                const [key, value] = text.split(':').map(part => part.trim());
                if (key && value) info[key] = value;
              }
            });
          }
        } catch (error) {
          // Proporcionar al menos información por defecto
          info['Garantía'] = 'No especificada';
        }
        
        return info;
      };
      
      // Construir y devolver el objeto de detalles del producto
      return {
        titulo: trySelectorsForText([
          'span[data-testid="pdp_ProductTitle"]',
          'h1.product-title',
          'h1',
          '.product-name'
        ]),
        categorias: (() => {
          // Intentar selectores originales
          const primaryCategories = getAllElements('button[data-testid*="-category"]')
            .map(el => el.textContent?.trim() ?? '')
            .filter(t => t !== '');
          
          if (primaryCategories.length > 0) return primaryCategories;
          
          // Selectores alternativos
          const alternativeSelectors = [
            '.breadcrumb li',
            '.categories a',
            '.product-categories span',
            'nav.product-nav a'
          ];
          
          for (const selector of alternativeSelectors) {
            const categories = getAllElements(selector)
              .map(el => el.textContent?.trim() ?? '')
              .filter(t => t !== '' && t !== 'Home' && t !== 'Inicio');
            
            if (categories.length > 0) return categories;
          }
          
          return [];
        })(),
        descripcion: trySelectorsForText([
          'div[data-testid="OverviewDescription"]',
          '.product-description',
          '#description',
          '.description',
          '.overview'
        ]),
        imagenes: extractImages(),
        etiquetas: 'ingram',
        especificaciones_tecnicas: extractSpecifications(),
        garantia_e_informacion_adicional: extractWarrantyInfo(),
      };
    });
  }

  // Método para limpiar recursos cuando la aplicación se apaga
  async onApplicationShutdown(): Promise<void> {
    // Cerrar todos los navegadores
    await Promise.all(
      this.browserPool.map(browser => browser.close().catch(() => {}))
    );
    this.browserPool = [];
    
    this.logger.log('Todos los navegadores cerrados correctamente');
  }

  // Método para ejecutar scraping en lotes
  async scrapeMultipleProducts(urls: string[]): Promise<(ProductDetails | null)[]> {
    // Usar un proceso por lotes para evitar sobrecarga
    const batchSize = 10;
    const results: (ProductDetails | null)[] = [];
    
    for (let i = 0; i < urls.length; i += batchSize) {
      const batch = urls.slice(i, i + batchSize);
      const batchPromises = batch.map(url => this.scrapeProductDetails(url));
      
      // Procesar este lote
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
      
      // Pequeña pausa entre lotes para evitar sobrecarga
      if (i + batchSize < urls.length) {
        await this.delay(2000 + Math.random() * 3000);
      }
    }
    
    return results;
  }
}