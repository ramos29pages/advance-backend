// // src/products/products.dto.ts

// export interface ProductoIngram {
//     id: string;
//     SKU: string;
//     nombre: string;
//     descripcion: string;
//     precio: number | null;
//     descuentos: boolean;
//     estado: string;
//     disponibilidad: boolean;
//     imagen: string;
//     marca: string;
//     categoria: string;
//     cantidad: number;
//     warehouse: string | null;
//     warehouseId: string | null;
//     precioRetail: number | string;
//     etiquetas: string[];
//   }
  
//   export interface ProductDetails {
//     titulo: string | null;
//     categorias: string[];
//     descripcion: string | null;
//     imagenes: string[];
//     etiquetas: string;
//     especificaciones_tecnicas: Record<string, Record<string, string>>;
//     garantia_e_informacion_adicional: Record<string, string>;
//   }
  
//   export interface ProductAndDetailsResponse {
//     success: boolean;
//     found: number;
//     nulls: number;
//     failed: number;
//     data: Array<{ _sku: string; product: ProductoIngram; details: ProductDetails | null }>;
//   }
  