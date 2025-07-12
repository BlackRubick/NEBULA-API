const { executeQuery } = require('../config/database');
const { createError } = require('../middleware/errorHandler');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

// Obtener estadísticas del dashboard
const getDashboardStats = async (req, res, next) => {
  try {
    // Obtener estadísticas generales
    const [
      totalTicketsResult,
      activeTicketsResult,
      usedTicketsResult,
      totalRevenueResult,
      todaysSalesResult,
      monthlyRevenueResult
    ] = await Promise.all([
      executeQuery('SELECT COUNT(*) as total FROM tickets'),
      executeQuery('SELECT COUNT(*) as total FROM tickets WHERE status = "active"'),
      executeQuery('SELECT COUNT(*) as total FROM tickets WHERE status = "used"'),
      executeQuery('SELECT SUM(price) as total FROM tickets WHERE status IN ("active", "used")'),
      executeQuery('SELECT COUNT(*) as total FROM tickets WHERE DATE(created_at) = CURDATE()'),
      executeQuery('SELECT SUM(price) as total FROM tickets WHERE MONTH(created_at) = MONTH(CURDATE()) AND YEAR(created_at) = YEAR(CURDATE())')
    ]);

    // Obtener boletos recientes
    const recentTickets = await executeQuery(`
      SELECT 
        t.id,
        t.ticket_number,
        t.buyer_name,
        t.buyer_email,
        t.buyer_phone,
        t.price,
        t.status,
        t.qr_code,
        t.used_at,
        t.created_at,
        t.updated_at,
        e.name as event_name,
        e.location as event_location,
        e.event_date
      FROM tickets t
      JOIN events e ON t.event_id = e.id
      ORDER BY t.created_at DESC
      LIMIT 10
    `);

    const stats = {
      totalTickets: totalTicketsResult[0].total,
      activeTickets: activeTicketsResult[0].total,
      usedTickets: usedTicketsResult[0].total,
      totalRevenue: totalRevenueResult[0].total || 0,
      todaysSales: todaysSalesResult[0].total,
      monthlyRevenue: monthlyRevenueResult[0].total || 0,
      recentTickets
    };

    res.json({
      success: true,
      data: stats,
      message: 'Estadísticas obtenidas exitosamente'
    });
  } catch (error) {
    next(error);
  }
};

// Obtener lista de usuarios
const getUsers = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    const [users, countResult] = await Promise.all([
      executeQuery(`
        SELECT id, email, name, role, is_active, created_at, updated_at
        FROM users
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?
      `, [limit, offset]),
      executeQuery('SELECT COUNT(*) as total FROM users')
    ]);

    const total = countResult[0].total;
    const totalPages = Math.ceil(total / limit);

    res.json({
      success: true,
      data: users,
      meta: {
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

// Crear nuevo usuario
const createUser = async (req, res, next) => {
  try {
    const { email, name, password, role } = req.body;

    if (!email || !name || !password || !role) {
      throw createError(400, 'MISSING_FIELDS', 'Todos los campos son requeridos');
    }

    if (!['admin', 'sales', 'scanner'].includes(role)) {
      throw createError(400, 'INVALID_ROLE', 'Rol inválido');
    }

    // Verificar si el email ya existe
    const existingUsers = await executeQuery(
      'SELECT id FROM users WHERE email = ?',
      [email]
    );

    if (existingUsers.length) {
      throw createError(409, 'EMAIL_EXISTS', 'El email ya está registrado');
    }

    // Hash password
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Crear usuario
    const userId = uuidv4();
    await executeQuery(`
      INSERT INTO users (id, email, name, password, role, is_active)
      VALUES (?, ?, ?, ?, ?, TRUE)
    `, [userId, email, name, hashedPassword, role]);

    // Obtener usuario creado (sin password)
    const newUser = await executeQuery(
      'SELECT id, email, name, role, is_active, created_at, updated_at FROM users WHERE id = ?',
      [userId]
    );

    res.status(201).json({
      success: true,
      data: newUser[0],
      message: 'Usuario creado exitosamente'
    });
  } catch (error) {
    next(error);
  }
};

// Actualizar usuario
const updateUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { email, name, role, is_active } = req.body;

    // Verificar que el usuario existe
    const existingUsers = await executeQuery(
      'SELECT id FROM users WHERE id = ?',
      [id]
    );

    if (!existingUsers.length) {
      throw createError(404, 'USER_NOT_FOUND', 'Usuario no encontrado');
    }

    // Construir query de actualización dinámicamente
    const updates = [];
    const params = [];

    if (email !== undefined) {
      updates.push('email = ?');
      params.push(email);
    }

    if (name !== undefined) {
      updates.push('name = ?');
      params.push(name);
    }

    if (role !== undefined) {
      if (!['admin', 'sales', 'scanner'].includes(role)) {
        throw createError(400, 'INVALID_ROLE', 'Rol inválido');
      }
      updates.push('role = ?');
      params.push(role);
    }

    if (is_active !== undefined) {
      updates.push('is_active = ?');
      params.push(is_active);
    }

    if (updates.length === 0) {
      throw createError(400, 'NO_UPDATES', 'No hay campos para actualizar');
    }

    updates.push('updated_at = NOW()');
    params.push(id);

    await executeQuery(
      `UPDATE users SET ${updates.join(', ')} WHERE id = ?`,
      params
    );

    // Obtener usuario actualizado
    const updatedUser = await executeQuery(
      'SELECT id, email, name, role, is_active, created_at, updated_at FROM users WHERE id = ?',
      [id]
    );

    res.json({
      success: true,
      data: updatedUser[0],
      message: 'Usuario actualizado exitosamente'
    });
  } catch (error) {
    next(error);
  }
};

// Eliminar usuario (desactivar)
const deleteUser = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Verificar que el usuario existe
    const existingUsers = await executeQuery(
      'SELECT id FROM users WHERE id = ?',
      [id]
    );

    if (!existingUsers.length) {
      throw createError(404, 'USER_NOT_FOUND', 'Usuario no encontrado');
    }

    // No permitir eliminar al usuario actual
    if (id === req.user.id) {
      throw createError(400, 'CANNOT_DELETE_SELF', 'No puedes eliminar tu propia cuenta');
    }

    // Desactivar usuario en lugar de eliminar
    await executeQuery(
      'UPDATE users SET is_active = FALSE, updated_at = NOW() WHERE id = ?',
      [id]
    );

    res.json({
      success: true,
      message: 'Usuario desactivado exitosamente'
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getDashboardStats,
  getUsers,
  createUser,
  updateUser,
  deleteUser
};