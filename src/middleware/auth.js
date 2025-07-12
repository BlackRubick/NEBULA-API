const jwt = require('jsonwebtoken');
const { executeQuery } = require('../config/database');

// Middleware para verificar token JWT
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'NO_TOKEN',
          message: 'Token de acceso requerido'
        }
      });
    }

    // Verificar token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Obtener usuario desde la base de datos
    const user = await executeQuery(
      'SELECT id, email, name, role, is_active FROM users WHERE id = ?',
      [decoded.userId]
    );

    if (!user.length || !user[0].is_active) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_USER',
          message: 'Usuario no válido o inactivo'
        }
      });
    }

    // Agregar usuario al request
    req.user = user[0];
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: {
          code: 'TOKEN_EXPIRED',
          message: 'Token expirado'
        }
      });
    }

    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_TOKEN',
          message: 'Token inválido'
        }
      });
    }

    console.error('Error en autenticación:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'AUTH_ERROR',
        message: 'Error interno de autenticación'
      }
    });
  }
};

// Middleware para verificar roles específicos
const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'NO_USER',
          message: 'Usuario no autenticado'
        }
      });
    }

    const userRole = req.user.role;
    const allowedRoles = Array.isArray(roles) ? roles : [roles];

    if (!allowedRoles.includes(userRole)) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'INSUFFICIENT_PERMISSIONS',
          message: 'Permisos insuficientes para esta operación'
        }
      });
    }

    next();
  };
};

// Middleware para verificar si es admin
const requireAdmin = requireRole('admin');

// Middleware para verificar si puede crear boletos (admin o sales)
const requireSalesAccess = requireRole(['admin', 'sales']);

// Middleware para verificar si puede escanear (admin o scanner)
const requireScannerAccess = requireRole(['admin', 'scanner']);

// Middleware opcional - no requiere autenticación pero agrega usuario si existe
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return next(); // Continuar sin usuario
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await executeQuery(
      'SELECT id, email, name, role, is_active FROM users WHERE id = ?',
      [decoded.userId]
    );

    if (user.length && user[0].is_active) {
      req.user = user[0];
    }

    next();
  } catch (error) {
    // Ignorar errores de token en auth opcional
    next();
  }
};

module.exports = {
  authenticateToken,
  requireRole,
  requireAdmin,
  requireSalesAccess,
  requireScannerAccess,
  optionalAuth
};