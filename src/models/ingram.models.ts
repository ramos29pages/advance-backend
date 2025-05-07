export interface ProductoIngram {
    id: string;
    SKU: string;
    nombre: string;
    descripcion: string;
    precio: number | null;
    descuentos: boolean;
    estado: string;
    disponibilidad: boolean;
    imagen: string;
    marca: string;
    categoria: string;
    cantidad: number;
    warehouse: string | null;
    warehouseId: string | null;
    precioRetail: number | string;
    etiquetas: string[];
  }