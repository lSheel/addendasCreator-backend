import { startServer } from "./app.js";


const PORT = process.env.PORT || 3000;

const main = async () => {
  try {
    
    startServer(Number(PORT));
  } catch (error) {
    // console.error('Error al sincronizar la base de datos:', error);
  }
};

main();