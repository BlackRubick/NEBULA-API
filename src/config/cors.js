const corsOptions = {
  origin: function (origin, callback) {
    // Permitir requests sin origin (como aplicaciones móviles o Postman)
    if (!origin) return callback(null, true);
    
    const allowedOrigins = [
      'http://localhost:3000',    // React dev server
      'http://localhost:5173',    // Vite dev server
      'http://localhost:4173',    // Vite preview
      'http://3.15.186.124:3000', // Tu frontend en producción
      'https://3.15.186.124:3000', // Tu frontend con HTTPS
      'http://18.116.163.27:3001', // Tu API
      'https://18.116.163.27:3001', // Tu API con HTTPS
      'https://nebula-tickets.vercel.app',
      'https://nebula-app.com',
    ];
    
    // En desarrollo, permitir cualquier localhost
    if (process.env.NODE_ENV === 'development') {
      if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
        return callback(null, true);
      }
    }
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.warn(`🚫 CORS blocked origin: ${origin}`);
      callback(new Error('No permitido por política CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Origin',
    'X-Requested-With',
    'Content-Type',
    'Accept',
    'Authorization',
    'Cache-Control',
    'Pragma'
  ],
  exposedHeaders: ['X-Total-Count', 'X-Page-Count'],
  maxAge: 86400
};

module.exports = { corsOptions };
