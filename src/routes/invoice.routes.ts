import { Router } from "express";
import multer from "multer";
import { uploadInvoice, generateAndSave } from "#controllers/invoice.controller.js";

const router = Router();
const storage = multer.memoryStorage();
const upload = multer({ storage });

router.post('/parse', upload.single('xmlFile'), uploadInvoice);

router.post('/generate', generateAndSave);

export default router;