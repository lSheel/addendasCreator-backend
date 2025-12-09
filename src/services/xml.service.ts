import { XMLParser } from "fast-xml-parser";
import { json } from "stream/consumers";

interface ComprobanteData {
  Serie: string;
  Folio: string;
  Fecha: string;
  SubTotal: string;
  Moneda: string;
  Total: string;
  Impuestos: any;
  CantidadArticulos: number;
}

interface AddendaInput {
  xmlContent: string;
  datosGlobales: {
    proveedor: string;
    tienda: string;
    entrega: string;
    cita: string;
    folioPedido: string;
    fechaEntrega: string;
  };
  tarimas: any[];
  productos: any[];
}

export class XMLService {
  private parser: XMLParser;
  // Configuración para que el parser mantenga atributos como propiedades
  constructor() {
    this.parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "",
    });
  }

  /**
   * Extrae los datos del comprobante del XML proporcionado.
   * @param xmlContent Contenido del XML como cadena.
   * @returns Objeto con los datos extraídos del comprobante.
   */
  parseInvoice(xmlContent: string): ComprobanteData | null {
    const jsonObj = this.parser.parse(xmlContent);

    const comprobante = jsonObj["cfdi:Comprobante"] || jsonObj["Comprobante"];
    if (!comprobante)
      throw new Error("No se encontró el nodo Comprobante en el XML.");

    const data: ComprobanteData = {
      Serie: comprobante.Serie || "",
      Folio: comprobante.Folio || "",
      Fecha: comprobante.Fecha || "",
      SubTotal: comprobante.SubTotal || "0.00",
      Moneda: comprobante.Moneda || "MXN",
      Total: comprobante.Total || "0.00",
      Impuestos: comprobante.Impuestos || {},
      CantidadArticulos: comprobante.Conceptos?.length || 0,
    };

    return data;
  }

  /**
   * Genera el bloque XML de la Addenda
   * @param input Datos necesarios para construir la Addenda
   * @returns Cadena XML de la Addenda
   */

  generateSorianaAddenda(input: AddendaInput): string {
    const { datosGlobales, productos, tarimas, xmlContent } = input;

    const datosCDFI = this.parseInvoice(xmlContent);
    const remision = `${datosCDFI?.Serie}${datosCDFI?.Folio}`;
    const totalTarimas = tarimas.length;

    const articulosXML = productos
      .map(
        (p: any) => `
        <Articulos Id="Articulos${p.index}" RowOrder="${p.index}">
            <Proveedor>${datosGlobales.proveedor}</Proveedor>
            <Remision>${remision}</Remision>
            <FolioPedido>${datosGlobales.folioPedido}</FolioPedido>
            <Tienda>${datosGlobales.tienda}</Tienda>
            <Codigo>${p.Codigo}</Codigo>
            <CantidadUnidadCompra>${p.Cantidad}</CantidadUnidadCompra>
            <CostoNetoUnidadCompra>${p.ValorUnitario}</CostoNetoUnidadCompra>
            <PorcentajeIEPS>0.00</PorcentajeIEPS>
            <PorcentajeIVA>${p.TasaIVA}</PorcentajeIVA>
            </Articulos>`
      )
      .join("");

    const cajasTarimasXML = tarimas
    .map((tarima, index) => {
      return `
        <CajasTarimas Id="CajaTarima${index}" RowOrder="${index}">
            <Proveedor>${datosGlobales.proveedor}</Proveedor>
            <Remision>${remision}</Remision>
            <NumeroCajaTarima>${tarima.numero}</NumeroCajaTarima>
            <CodigoBarraCajaTarima>${tarima.codigoBarra}</CodigoBarraCajaTarima>
            <SucursalDistribuir>${datosGlobales.entrega}</SucursalDistribuir>
            <CantidadArticulos>${datosCDFI?.CantidadArticulos}</CantidadArticulos>
        </CajasTarimas>`;
    })
    .join("");

    const articulosPorTarimaXML = productos
    .map(
      (p) => `
        <ArticulosPorCajaTarima Id="ArticulosPorCajaTarima${p.index}" RowOrder="${p.index}">
            <Proveedor>${datosGlobales.proveedor}</Proveedor>
            <Remision>${remision}</Remision>
            <FolioPedido>${datosGlobales.folioPedido}</FolioPedido>
            <NumeroCajaTarima>${p.NumeroTarima}</NumeroCajaTarima>
            <SucursalDistribuir>${datosGlobales.entrega}</SucursalDistribuir>
            <Codigo>${p.Codigo}</Codigo>
            <CantidadUnidadCompra>${p.Cantidad}</CantidadUnidadCompra>
        </ArticulosPorCajaTarima>`
    )
    .join("");

    const addendaBlock = `<cfdi:Addenda>
    <DSCargaRemisionProv>
        <Remision Id="Remision0" RowOrder="0">
            <Proveedor>${datosGlobales.proveedor}</Proveedor>
            <Remision>${remision}</Remision>
            <Consecutivo>0</Consecutivo>
            <FechaRemision>${datosCDFI?.Fecha}</FechaRemision>
            <Tienda>${datosGlobales.tienda}</Tienda>
            <TipoMoneda>1</TipoMoneda>
            <TipoBulto>1</TipoBulto>
            <EntregaMercancia>${datosGlobales.entrega}</EntregaMercancia>
            <CumpleReqFiscales>true</CumpleReqFiscales>
            <CantidadBultos>${productos.length}</CantidadBultos>
            <Subtotal>${datosCDFI?.SubTotal}</Subtotal>
            <Descuentos>0.00</Descuentos>
            <IEPS>0.00</IEPS>
            <IVA>${datosCDFI?.Impuestos.TasaIVA}</IVA>
            <OtrosImpuestos>0.00</OtrosImpuestos>
            <Total>${datosCDFI?.Total}</Total>
            <CantidadPedidos>1</CantidadPedidos>
            <FechaEntregaMercancia>${datosGlobales.fechaEntrega}</FechaEntregaMercancia>
            <EmpaqueEnCajas>true</EmpaqueEnCajas>
            <EmpaqueEnTarimas>true</EmpaqueEnTarimas>
            <CantidadCajasTarimas>${totalTarimas}</CantidadCajasTarimas>
            <Cita>${datosGlobales.cita}</Cita>
        </Remision>
        <Pedidos Id="Pedidos0" RowOrder="0">
            <Proveedor>${datosGlobales.proveedor}</Proveedor>
            <Remision>${remision}</Remision>
            <FolioPedido>${datosGlobales.folioPedido}</FolioPedido>
            <Tienda>${datosGlobales.tienda}</Tienda>
            <CantidadArticulos>${datosCDFI?.CantidadArticulos}</CantidadArticulos>
        </Pedidos>
        ${articulosXML.trim()}
        ${cajasTarimasXML.trim()}
        ${articulosPorTarimaXML.trim()}
    </DSCargaRemisionProv>
</cfdi:Addenda>`;

    return addendaBlock.trim();
  }


  
}
