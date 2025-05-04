// product-scraper.service.ts
import { Injectable, Logger } from '@nestjs/common';
import * as puppeteer from 'puppeteer';

export interface ProductDetails {
  titulo: string | null;
  categorias: string[];
  descripcion: string | null;
  imagenes: string[];
  etiquetas: string;
  especificaciones_tecnicas: Record<string, Record<string, string>>;
  garantia_e_informacion_adicional: Record<string, string>;
}

@Injectable()
export class ProductScraperService {
  private readonly logger = new Logger(ProductScraperService.name);
  private browser?: puppeteer.Browser;

  // Inicializa el navegador una sola vez para reutilizarlo
  private async getBrowser() {
    if (!this.browser) {
      this.browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--single-process',
        ],
        userDataDir: './puppeteer_cache',
      });
    }
    return this.browser;
  }

  async scrapeProductDetails(url: string): Promise<ProductDetails | null> {
    let page: puppeteer.Page | undefined;
    try {
      const browser = await this.getBrowser();
      page = await browser.newPage();

      // Simular navegador real
      await page.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ' +
        'AppleWebKit/537.36 (KHTML, like Gecko) ' +
        'Chrome/120.0.0.0 Safari/537.36'
      );
      await page.setExtraHTTPHeaders({ 'Accept-Language': 'es-CO,es;q=0.9' });

      // Habilitar caché para recursos repetidos
      await page.setCacheEnabled(true);

      // Bloquear recursos no esenciales para acelerar carga
      await page.setRequestInterception(true);
      page.on('request', req => {
        const t = req.resourceType();
        if (['stylesheet', 'font', 'media'].includes(t)) req.abort();
        else req.continue();
      });

      // Navegar hasta DOMContentLoaded (más rápido que networkidle0) ([latenode.com](https://latenode.com/blog/understanding-waituntil-in-puppeteer-networkidle0-networkidle2-and-domcontentloaded?utm_source=chatgpt.com))
      await page.goto(url, { waitUntil: 'networkidle0', timeout: 60000 });

      console.log(page.browser());

      // Esperar selector visible dentro de 6s para mayor robustez
      await page.waitForSelector('span[data-testid="pdp_ProductTitle"]', { timeout: 60000, visible: true });

      // Extraer datos en contexto navegador
      const detalles = await page.evaluate(() => {
        const qs = (s: string) => document.querySelector(s);
        const qsa = (s: string) => Array.from(document.querySelectorAll(s));

        return {
          titulo: qs('span[data-testid="pdp_ProductTitle"]')?.textContent?.trim() ?? null,
          categorias: qsa('button[data-testid*="-category"]')
            .map(el => el.textContent?.trim() ?? '')
            .filter(t => t !== ''),
          descripcion: qs('div[data-testid="OverviewDescription"]')?.textContent?.trim() ?? null,
          imagenes: qsa('div[data-element="ThumbnailsBox"] img')
            .map(img => img.getAttribute('src') ?? '')
            .filter(src => src !== ''),
          etiquetas: 'ingram',
          especificaciones_tecnicas: (() => {
            const specs: Record<string, Record<string, string>> = {};
            let current: string | null = null;
            qsa('div[data-testid="TechnicalSpecification"] tr').forEach(row => {
              const header = row.querySelector('td[colspan="2"]');
              if (header?.textContent) {
                current = header.textContent.trim();
                specs[current] = {};
              } else if (current) {
                const cols = row.querySelectorAll('td');
                const key = cols[0]?.textContent?.trim() ?? '';
                const val = cols[1]?.textContent?.trim() ?? '';
                if (key) specs[current][key] = val;
              }
            });
            return specs;
          })(),
          garantia_e_informacion_adicional: (() => {
            const info: Record<string, string> = {};
            const sec = qs('div[data-testid="warrantyAndInfo"]');
            if (sec) {
              const lines = Array.from(sec.querySelectorAll('p'))
                .map(p => p.textContent?.trim() ?? '')
                .filter(t => t !== '');
              lines.slice(1).forEach(line => {
                const parts = line.split(' ');
                const key = parts.slice(0, -1).join(' ');
                const val = parts.slice(-1)[0];
                info[key] = val;
              });
            }
            return info;
          })(),
        };
      });

      await page.close();
      return detalles;
    } catch (error) {
      this.logger.error('Error en Puppeteer:', (error as Error).message);
      if (page) await page.close();
      return null;
    }
  }
}
