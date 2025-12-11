import type { Request, Response } from 'express';
import { XMLService } from '#services/xml.service.js';
import { PrismaClient } from '@prisma/client/extension';

const prisma = new PrismaClient();
const xmlService = new XMLService();

export const uploadInvoice = async (req: Request, res: Response) => {
    try{
        // @ts-ignore
        if(!req.file){
            return res.status(400).json({ message: 'No se subió ningún archivo XML' });
        }

        // Convertir el buffer del archivo a cadena
        // @ts-ignore
        const xmlContent = req.file.buffer.toString('utf-8');

        // Parsear XML con el servicio
        const data = xmlService.parseInvoice(xmlContent);

        //Devolcer información parseada

        res.json({
            success: true,
            data,
            xmlContent

        });


    }catch(error){      
        console.error('Error al subir la factura:', error);
        res.status(500).json({ message: 'Error al procesar la factura' });
    }

}

export const generateAndSave = async (req: Request, res: Response) => {
    try{
        const { datosGlobales, tarimas, productos, xmlContent, userId  } = req.body;

        const addendaXml = xmlService.generateSorianaAddenda({
            xmlContent,
            datosGlobales,
            tarimas,
            productos
        });

        const newInvoice = await prisma.invoice.create({
            data: {
                fileName: `factura_${Date.now()}.xml`,
                orifinalXml: xmlContent,
                addendaXml: addendaXml,
                total : parseFloat(xmlService.parseInvoice(xmlContent)?.Total || '0'),
                userId: userId
            }
        });

        res.json({
            success: true,
            addendaXml,
            invoiceId: newInvoice.id
        });
    
    }catch(error){
        console.error('Error al generar y guardar la factura:', error);
        res.status(500).json({ message: 'Error al generar y guardar la factura' });
    }
}