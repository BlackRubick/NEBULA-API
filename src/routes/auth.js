const express = require('express');
const { body } = require('express-validator');
const { authenticateToken } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const { validateRequest } = require('../middleware/validation');
const {
  login,
  refreshToken,
  logout,
  getProfile,
  changePassword
} = require('../controllers/authController');

const router = express.Router();

// Validaciones
const loginValidation = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Email debe ser válido'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Contraseña debe tener al menos 6 caracteres')
];

const refreshTokenValidation = [
  body('refreshToken')
    .notEmpty()
    .withMessage('Refresh token es requerido')
];

const changePasswordValidation = [
  body('currentPassword')
    .notEmpty()
    .withMessage('Contraseña actual es requerida'),
  body('newPassword')
    .isLength({ min: 6 })
    .withMessage('Nueva contraseña debe tener al menos 6 caracteres')
];

// Rutas públicas
router.post('/login', loginValidation, validateRequest, asyncHandler(login));
router.post('/refresh', refreshTokenValidation, validateRequest, asyncHandler(refreshToken));
router.post('/logout', asyncHandler(logout));

// Rutas protegidas
router.get('/profile', authenticateToken, asyncHandler(getProfile));
router.put('/change-password', authenticateToken, changePasswordValidation, validateRequest, asyncHandler(changePassword));

module.exports = router;