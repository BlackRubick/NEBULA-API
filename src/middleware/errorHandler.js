// Manejo centralizado de errores
const errorHandler = (err, req, res, next) => {
  console.error('❌ Error:', err);

  // Error de validación de Joi
  if (err.isJoi) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Datos inválidos',
        details: err.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message
        }))
      }
    });
  }

  // Error de MySQL
  if (err.code && err.code.startsWith('ER_')) {
    switch (err.code) {
      case 'ER_DUP_ENTRY':
        return res.status(409).json({
          success: false,
          error: {
            code: 'DUPLICATE_ENTRY',
            message: 'Ya existe un registro con estos datos'
          }
        });
      
      case 'ER_NO_REFERENCED_ROW_2':
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_REFERENCE',
            message: 'Referencia inválida en los datos'
          }
        });
      
      default:
        return res.status(500).json({
          success: false,
          error: {
            code: 'DATABASE_ERROR',
            message: 'Error en la base de datos'
          }
        });
    }
  }

  // Error de JWT
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      error: {
        code: 'INVALID_TOKEN',
        message: 'Token inválido'
      }
    });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      error: {
        code: 'TOKEN_EXPIRED',
        message: 'Token expirado'
      }
    });
  }

  // Error personalizado con status
  if (err.status) {
    return res.status(err.status).json({
      success: false,
      error: {
        code: err.code || 'CUSTOM_ERROR',
        message: err.message
      }
    });
  }

  // Error interno del servidor
  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: process.env.NODE_ENV === 'development' 
        ? err.message 
        : 'Error interno del servidor'
    }
  });
};

// Función para crear errores personalizados
const createError = (status, code, message) => {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
};

// Middleware para rutas no encontradas
const notFoundHandler = (req, res, next) => {
  const error = createError(404, 'NOT_FOUND', `Ruta ${req.originalUrl} no encontrada`);
  next(error);
};

// Wrapper para async functions
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

module.exports = {
  errorHandler,
  createError,
  notFoundHandler,
  asyncHandler
};