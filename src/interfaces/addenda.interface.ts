// src/interfaces/addenda.interface.ts


export interface ProductoInput {
  codigo: string;    // SKU o Código de Barras del producto
  cantidad: number;  // Cantidad asignada a la tarima
  numeroTarima?: number; 
}

export interface TarimaInput {
  numero: number;
  codigoBarra: string; // El SSCC de la tarima
  productos: ProductoInput[];
}

export interface AddendaInputData {
  proveedor: string;
  tienda: string;
  entrega: string;
  cita: string;
  folioPedido: string;
  fechaEntrega: string;
  tarimas: TarimaInput[];
}


export interface ConceptoCFDI {
  ClaveProdServ?: string;
  NoIdentificacion?: string;
  Cantidad: string;
  ClaveUnidad?: string;
  Unidad?: string;
  Descripcion: string;
  ValorUnitario: string;
  Importe: string;
  // Campos calculados por nosotros en el service
  index: number;      // Indispensable para el ordenamiento en la Addenda
  TasaIVA: string;    // Calculado desde los impuestos del concepto
  [key: string]: any; // Permite otros campos extra del XML si fueran necesarios
}

export interface ImpuestosComprobante {
  TasaIVA?: string;
  // Puedes agregar TotalTraslados, TotalRetenciones si los necesitas a futuro
}

export interface ComprobanteData {
  uuid: string;
  serie: string;
  folio: string;
  fecha: string;
  subTotal: string;
  total: string;
  moneda?: string;
  impuestos: ImpuestosComprobante;
  conceptos: ConceptoCFDI[];
}