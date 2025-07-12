const express = require('express');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const {
  getDashboardStats,
  getUsers,
  createUser,
  updateUser,
  deleteUser
} = require('../controllers/adminController');

const router = express.Router();

// Todas las rutas requieren autenticación y rol admin
router.use(authenticateToken, requireAdmin);

// Estadísticas del dashboard
router.get('/statistics', asyncHandler(getDashboardStats));

// Gestión de usuarios
router.get('/users', asyncHandler(getUsers));
router.post('/users', asyncHandler(createUser));
router.put('/users/:id', asyncHandler(updateUser));
router.delete('/users/:id', asyncHandler(deleteUser));

module.exports = router;