import { parseStringPromise } from "xml2js";
import type { AddendaInputData, ComprobanteData } from '#interfaces/addenda.interface.js';

export class XMLService {

  async parseInvoice(xmlContent: string): Promise<ComprobanteData> {
    const result = await parseStringPromise(xmlContent);
    
    if (!result || !result["cfdi:Comprobante"]) {
      throw new Error("No se encontró el nodo cfdi:Comprobante en el XML.");
    }
    
    const comprobante = result["cfdi:Comprobante"]['$'];
    
    // EXTRAER CONCEPTOS
    const conceptosRaw = result["cfdi:Comprobante"]["cfdi:Conceptos"]?.[0]["cfdi:Concepto"] || [];

    // Mapaer para limpiar la data y calcular lo que falta (index, IVA)
    const conceptosProcesados = conceptosRaw.map((c: any, index: number) => {
        // Buscar el IVA en los traslados del concepto
        const traslados = c["cfdi:Impuestos"]?.[0]["cfdi:Traslados"]?.[0]["cfdi:Traslado"] || [];
        const ivaNode = traslados.find((t: any) => t['$'].Impuesto === '002');
        
        return {
            ...c['$'], 
            index: index, 
            TasaIVA: ivaNode 
                ? (parseFloat(ivaNode['$'].TasaOCuota) * 100).toFixed(2) 
                : "0.00"
        };
    });

    const impuestosGlobalesNode = result["cfdi:Comprobante"]["cfdi:Impuestos"]?.[0]["cfdi:Traslados"]?.[0]["cfdi:Traslado"];
    let totalIva = "0.00";
    if (impuestosGlobalesNode) {
        // Si es array iteramos, si es objeto único lo usamos (xml2js a veces varía)
        const trasladosG = Array.isArray(impuestosGlobalesNode) ? impuestosGlobalesNode : [impuestosGlobalesNode];
        const ivaG = trasladosG.find((t:any) => t['$'].Impuesto === '002');
        if(ivaG) totalIva = ivaG['$'].Importe;
    }

    const uuid = result["cfdi:Comprobante"]["cfdi:Complemento"]?.[0]["tfd:TimbreFiscalDigital"]?.[0]['$'].UUID || '';

    const comprobanteData: ComprobanteData = {
      uuid,
      serie: comprobante.Serie || "",
      folio: comprobante.Folio || "",
      fecha: comprobante.Fecha || "",
      subTotal: comprobante.SubTotal || "0.00",
      total: comprobante.Total || "0.00",
      impuestos: { TasaIVA: totalIva }, 
      conceptos: conceptosProcesados,
    };

    return comprobanteData;
  }

  generateSorianaAddenda(originalXML: string, data: AddendaInputData, cfdiData: ComprobanteData): string {
    const remision = `${cfdiData.serie}${cfdiData.folio}`;
    
    const fechaRemision = cfdiData.fecha ? cfdiData.fecha.substring(0, 10) : "";

    const tarimas = data.tarimas;

    const productosEnTarimas = tarimas.flatMap(tarima => 
      tarima.productos.map(producto => ({
        Codigo: producto.codigo,
        Cantidad: producto.cantidad,
        NumeroTarima: tarima.numero,
      }))
    );

    const cantidadTotalBultos = productosEnTarimas
        .reduce((acc, p) => acc + parseFloat(p.Cantidad.toString()), 0)
        .toFixed(2);

    // Generar XML de Artículos (Iterando los conceptos originales del XML)
    const articulosXML = cfdiData.conceptos
      .map((p: any) => `
        <Articulos Id="Articulos${p.index}" RowOrder="${p.index}">
            <Proveedor>${data.proveedor}</Proveedor>
            <Remision>${remision}</Remision>
            <FolioPedido>${data.folioPedido}</FolioPedido>
            <Tienda>${data.tienda}</Tienda>
            <Codigo>${p.NoIdentificacion || "FALTA_CODIGO"}</Codigo> 
            <CantidadUnidadCompra>${p.Cantidad}</CantidadUnidadCompra>
            <CostoNetoUnidadCompra>${p.ValorUnitario}</CostoNetoUnidadCompra>
            <PorcentajeIEPS>0.00</PorcentajeIEPS>
            <PorcentajeIVA>${p.TasaIVA}</PorcentajeIVA>
        </Articulos>`
      ).join("");

    // Generar XML de Cajas
    const cajasTarimasXML = tarimas.map((tarima, index) => `
        <CajasTarimas Id="CajaTarima${index}" RowOrder="${index}">
            <Proveedor>${data.proveedor}</Proveedor>
            <Remision>${remision}</Remision>
            <NumeroCajaTarima>${tarima.numero}</NumeroCajaTarima>
            <CodigoBarraCajaTarima>${tarima.codigoBarra}</CodigoBarraCajaTarima>
            <SucursalDistribuir>${data.entrega}</SucursalDistribuir>
            <CantidadArticulos>${cfdiData.conceptos.length}</CantidadArticulos>
        </CajasTarimas>`
    ).join("");

    // Generar XML de ArticulosPorCaja
    const articulosPorTarimaXML = productosEnTarimas.map((p, index) => `
        <ArticulosPorCajaTarima Id="ArticulosPorCajaTarima${index}" RowOrder="${index}">
            <Proveedor>${data.proveedor}</Proveedor>
            <Remision>${remision}</Remision>
            <FolioPedido>${data.folioPedido}</FolioPedido>
            <NumeroCajaTarima>${p.NumeroTarima}</NumeroCajaTarima>
            <SucursalDistribuir>${data.entrega}</SucursalDistribuir>
            <Codigo>${p.Codigo}</Codigo>
            <CantidadUnidadCompra>${p.Cantidad}</CantidadUnidadCompra>
        </ArticulosPorCajaTarima>`
    ).join("");

    // Bloque Final
    const addendaBlock = `<cfdi:Addenda>
    <DSCargaRemisionProv>
        <Remision Id="Remision0" RowOrder="0">
            <Proveedor>${data.proveedor}</Proveedor>
            <Remision>${remision}</Remision>
            <Consecutivo>0</Consecutivo>
            <FechaRemision>${fechaRemision}</FechaRemision>
            <Tienda>${data.tienda}</Tienda>
            <TipoMoneda>1</TipoMoneda>
            <TipoBulto>1</TipoBulto>
            <EntregaMercancia>${data.entrega}</EntregaMercancia>
            <CumpleReqFiscales>true</CumpleReqFiscales>
            <CantidadBultos>${cantidadTotalBultos}</CantidadBultos>
            <Subtotal>${cfdiData.subTotal}</Subtotal>
            <Descuentos>0.00</Descuentos>
            <IEPS>0.00</IEPS>
            <IVA>${cfdiData.impuestos.TasaIVA}</IVA>
            <OtrosImpuestos>0.00</OtrosImpuestos>
            <Total>${cfdiData.total}</Total>
            <CantidadPedidos>1</CantidadPedidos>
            <FechaEntregaMercancia>${data.fechaEntrega}</FechaEntregaMercancia>
            <EmpaqueEnCajas>true</EmpaqueEnCajas>
            <EmpaqueEnTarimas>true</EmpaqueEnTarimas>
            <CantidadCajasTarimas>${tarimas.length}</CantidadCajasTarimas>
            <Cita>${data.cita}</Cita>
        </Remision>
        <Pedidos Id="Pedidos0" RowOrder="0">
            <Proveedor>${data.proveedor}</Proveedor>
            <Remision>${remision}</Remision>
            <FolioPedido>${data.folioPedido}</FolioPedido>
            <Tienda>${data.tienda}</Tienda>
            <CantidadArticulos>${cfdiData.conceptos.length}</CantidadArticulos>
        </Pedidos>
        ${articulosXML.trim()}
        ${cajasTarimasXML.trim()}
        ${articulosPorTarimaXML.trim()}
    </DSCargaRemisionProv>
</cfdi:Addenda>`;

    // Retornamos el XML original con la addenda inyectada antes del cierre
    // OJO: Si solo quieres el bloque, deja el return addendaBlock.
    // Si quieres el XML completo listo para descargar:
    return originalXML.replace('</cfdi:Comprobante>', `${addendaBlock}\n</cfdi:Comprobante>`);
  }
}