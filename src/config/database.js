const mysql = require('mysql2/promise');

// Configuración de la base de datos
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'nebula_user',
  password: process.env.DB_PASSWORD || 'cesar',
  database: process.env.DB_NAME || 'nebula_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  charset: 'utf8mb4',
  timezone: '+00:00'
};
console.log('📦 Config DB:', dbConfig);


// Pool de conexiones
let pool;

const connectDatabase = async () => {
  try {
    pool = mysql.createPool(dbConfig);
    
    // Probar la conexión
    const connection = await pool.getConnection();
    console.log('🔗 Conectado a MySQL como ID:', connection.threadId);
    connection.release();
    
    return pool;
  } catch (error) {
    console.error('❌ Error conectando a la base de datos:', error);
    throw error;
  }
};

const getDatabase = () => {
  if (!pool) {
    throw new Error('Base de datos no inicializada. Llama a connectDatabase() primero.');
  }
  return pool;
};

// Función para ejecutar queries con manejo de errores
const executeQuery = async (query, params = []) => {
  try {
    const db = getDatabase();
    const [results] = await db.execute(query, params);
    return results;
  } catch (error) {
    console.error('❌ Error ejecutando query:', error);
    throw error;
  }
};

// Función para transacciones
const executeTransaction = async (queries) => {
  const connection = await getDatabase().getConnection();
  
  try {
    await connection.beginTransaction();
    
    const results = [];
    for (const { query, params } of queries) {
      const [result] = await connection.execute(query, params);
      results.push(result);
    }
    
    await connection.commit();
    connection.release();
    
    return results;
  } catch (error) {
    await connection.rollback();
    connection.release();
    throw error;
  }
};

// Función para cerrar el pool de conexiones
const closeDatabase = async () => {
  if (pool) {
    await pool.end();
    console.log('🔌 Conexión a la base de datos cerrada');
  }
};

module.exports = {
  connectDatabase,
  getDatabase,
  executeQuery,
  executeTransaction,
  closeDatabase
};