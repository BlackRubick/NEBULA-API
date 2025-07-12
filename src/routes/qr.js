const express = require('express');
const { body } = require('express-validator');
const { authenticateToken, requireScannerAccess } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const { validateRequest } = require('../middleware/validation');
const {
  validateQR,
  markAsUsed
} = require('../controllers/qrController');

const router = express.Router();

// Validaciones
const validateQRValidation = [
  body('qrData')
    .notEmpty()
    .withMessage('Datos del QR son requeridos')
];

// Rutas protegidas
router.post('/validate', authenticateToken, requireScannerAccess, validateQRValidation, validateRequest, asyncHandler(validateQR));
router.post('/mark-used', authenticateToken, requireScannerAccess, asyncHandler(markAsUsed));

module.exports = router;