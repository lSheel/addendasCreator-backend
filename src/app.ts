import express from 'express';
import cors from "cors";
// import cookieParser from "cookie-parser";
import dotenv from 'dotenv'

//routes
import invoiceRoutes from '#routes/invoice.routes.js';

dotenv.config();
const app = express();

app.use(cors({
    origin: '*',
    credentials: true,
}));

// app.use(cookieParser());
app.use(express.urlencoded({ extended: true})); // Aumentar límite para XMLs grandes

app.use(express.json({ limit: '10mb' })); // Aumentar límite para XMLs grandes


app.use('/api/invoices', invoiceRoutes);

export const startServer = (port: number) => {
    const httpServer = app.listen(port, () => {
        console.log(`Servidor iniciado en el puerto ${port}`);
    });

    return httpServer;
}

export const stopServer = (httpServer : ReturnType<typeof app.listen>) => {
    httpServer.close();
}


export default app;
