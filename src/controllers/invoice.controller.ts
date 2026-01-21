import type { Request, Response } from "express";
import { XMLService } from "#services/xml.service.js";
import { PrismaClient } from "@prisma/client/extension";
import type { AddendaInputData } from "#root/interfaces/addenda.interface.js";

const prisma = new PrismaClient();
const xmlService = new XMLService();

export const uploadInvoice = async (req: Request, res: Response) => {
  try {
    // @ts-ignore
    if (!req.file) {
      return res
        .status(400)
        .json({ message: "No se subió ningún archivo XML" });
    }

    // Convertir el buffer del archivo a cadena
    // @ts-ignore
    const xmlContent = req.file.buffer.toString("utf-8");

    // Parsear XML con el servicio
    const data = xmlService.parseInvoice(xmlContent);

    //Devolcer información parseada

    res.json({
      success: true,
      data,
      xmlContent,
    });
  } catch (error) {
    console.error("Error al subir la factura:", error);
    res.status(500).json({ message: "Error al procesar la factura" });
  }
};

export const createInvoice = async (req: Request, res: Response) => {
  try {
    /**
     * Desestructura la información recibida en el body'
     * xmlContent: string - Contenido XML original de la factura
     * fileName: string - Nombre del archivo XML
     * data: object - Datos necesarios para la generación de la addenda
     */
    const { xmlContent, fileName, data } = req.body;

    if (!xmlContent || !data) {
      return res.status(400).json({
        error: "Faltan datos requeridos (xmlContent o data de formulario)",
      });
    }

    const userId = 1; // Temporal hasta implementar autenticación
    

    // Parsear el XML para obtener datos del CFDI
    const cfdiData = await xmlService.parseInvoice(xmlContent);

    

    const generatedXml = xmlService.generateSorianaAddenda(
      xmlContent, 
      data as AddendaInputData, 
      cfdiData
    );

    const savedInvoice = await prisma.invoice.create({
      data: {
        fileName: fileName || `factura-${cfdiData.serie}${cfdiData.folio}.xml`,
        uuid: cfdiData.uuid || null,     // Si lo extrajiste, si no, opcional

        xmlContent: xmlContent,          // El original
        addendaContent: generatedXml,    // El resultado final

        inputData: data,                 // El JSON de configuración que usó el usuario

        totalAmount: parseFloat(cfdiData.total), // Prisma Decimal acepta números o strings numéricos
        providerId: data.proveedor,      // Dato clave para búsquedas

        userId: userId                   // Relación con el usuario
      }
    });

    res.status(201).json({
      message: "Addenda generada y guardada exitosamente",
      invoiceId: savedInvoice.id,
      xmlWithAddenda: generatedXml, // El frontend usará esto para descargar el archivo
      details: {
        folio: `${cfdiData.serie}-${cfdiData.folio}`,
        total: cfdiData.total
      }
    });

  } catch (error: any) {
    console.error("Error en createInvoice:", error);
    
    if (error.message.includes("Comprobante")) {
      return res.status(400).json({ error: "El XML proporcionado no es un CFDI válido." });
    }

    res.status(500).json({ 
      error: "Error interno al procesar la factura",
      details: error.message 
    });
  }
};
