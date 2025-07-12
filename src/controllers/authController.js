const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { executeQuery } = require('../config/database');
const { createError } = require('../middleware/errorHandler');

// Generar tokens JWT
const generateTokens = (userId) => {
  const accessToken = jwt.sign(
    { userId },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
  );

  const refreshToken = jwt.sign(
    { userId },
    process.env.REFRESH_TOKEN_SECRET,
    { expiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || '7d' }
  );

  return { accessToken, refreshToken };
};

// Login
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Validar datos
    if (!email || !password) {
      throw createError(400, 'MISSING_CREDENTIALS', 'Email y contraseña son requeridos');
    }

    // Buscar usuario
    const users = await executeQuery(
      'SELECT id, email, name, password, role, is_active FROM users WHERE email = ?',
      [email]
    );

    if (!users.length) {
      throw createError(401, 'INVALID_CREDENTIALS', 'Credenciales incorrectas');
    }

    const user = users[0];

    // Verificar si el usuario está activo
    if (!user.is_active) {
      throw createError(401, 'ACCOUNT_DISABLED', 'Cuenta deshabilitada');
    }

    // Verificar contraseña
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      throw createError(401, 'INVALID_CREDENTIALS', 'Credenciales incorrectas');
    }

    // Generar tokens
    const { accessToken, refreshToken } = generateTokens(user.id);

    // Guardar refresh token en la base de datos
    await executeQuery(
      'INSERT INTO refresh_tokens (id, user_id, token, expires_at) VALUES (?, ?, ?, DATE_ADD(NOW(), INTERVAL 7 DAY))',
      [uuidv4(), user.id, refreshToken]
    );

    // Limpiar tokens expirados del usuario
    await executeQuery(
      'DELETE FROM refresh_tokens WHERE user_id = ? AND expires_at < NOW()',
      [user.id]
    );

    // Remover password del objeto usuario
    const { password: _, ...userWithoutPassword } = user;

    res.json({
      success: true,
      data: {
        user: userWithoutPassword,
        token: accessToken,
        refreshToken
      },
      message: 'Inicio de sesión exitoso'
    });
  } catch (error) {
    next(error);
  }
};

// Refresh token
const refreshToken = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      throw createError(400, 'MISSING_REFRESH_TOKEN', 'Refresh token requerido');
    }

    // Verificar refresh token
    const decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);

    // Verificar que el token existe en la base de datos y no ha expirado
    const tokens = await executeQuery(
      'SELECT user_id FROM refresh_tokens WHERE token = ? AND expires_at > NOW()',
      [refreshToken]
    );

    if (!tokens.length) {
      throw createError(401, 'INVALID_REFRESH_TOKEN', 'Refresh token inválido o expirado');
    }

    // Obtener usuario
    const users = await executeQuery(
      'SELECT id, email, name, role, is_active FROM users WHERE id = ?',
      [decoded.userId]
    );

    if (!users.length || !users[0].is_active) {
      throw createError(401, 'INVALID_USER', 'Usuario no válido o inactivo');
    }

    // Generar nuevo access token
    const { accessToken } = generateTokens(users[0].id);

    res.json({
      success: true,
      data: {
        token: accessToken
      },
      message: 'Token renovado exitosamente'
    });
  } catch (error) {
    next(error);
  }
};

// Logout
const logout = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;

    if (refreshToken) {
      // Eliminar refresh token de la base de datos
      await executeQuery(
        'DELETE FROM refresh_tokens WHERE token = ?',
        [refreshToken]
      );
    }

    res.json({
      success: true,
      message: 'Cierre de sesión exitoso'
    });
  } catch (error) {
    next(error);
  }
};

// Obtener perfil del usuario autenticado
const getProfile = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const users = await executeQuery(
      'SELECT id, email, name, role, is_active, created_at, updated_at FROM users WHERE id = ?',
      [userId]
    );

    if (!users.length) {
      throw createError(404, 'USER_NOT_FOUND', 'Usuario no encontrado');
    }

    res.json({
      success: true,
      data: users[0],
      message: 'Perfil obtenido exitosamente'
    });
  } catch (error) {
    next(error);
  }
};

// Cambiar contraseña
const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.id;

    if (!currentPassword || !newPassword) {
      throw createError(400, 'MISSING_PASSWORDS', 'Contraseña actual y nueva son requeridas');
    }

    if (newPassword.length < 6) {
      throw createError(400, 'WEAK_PASSWORD', 'La nueva contraseña debe tener al menos 6 caracteres');
    }

    // Obtener contraseña actual
    const users = await executeQuery(
      'SELECT password FROM users WHERE id = ?',
      [userId]
    );

    if (!users.length) {
      throw createError(404, 'USER_NOT_FOUND', 'Usuario no encontrado');
    }

    // Verificar contraseña actual
    const isValidPassword = await bcrypt.compare(currentPassword, users[0].password);
    if (!isValidPassword) {
      throw createError(400, 'INVALID_CURRENT_PASSWORD', 'Contraseña actual incorrecta');
    }

    // Hash nueva contraseña
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

    // Actualizar contraseña
    await executeQuery(
      'UPDATE users SET password = ?, updated_at = NOW() WHERE id = ?',
      [hashedPassword, userId]
    );

    // Invalidar todos los refresh tokens del usuario
    await executeQuery(
      'DELETE FROM refresh_tokens WHERE user_id = ?',
      [userId]
    );

    res.json({
      success: true,
      message: 'Contraseña cambiada exitosamente'
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  login,
  refreshToken,
  logout,
  getProfile,
  changePassword
};