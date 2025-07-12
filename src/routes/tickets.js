const express = require('express');
const { body, param, query } = require('express-validator');
const { 
  authenticateToken, 
  requireSalesAccess, 
  requireScannerAccess 
} = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const { validateRequest } = require('../middleware/validation');
const {
  getTickets,
  getTicket,
  createTicket,
  resendTicket,
  scanTicket,
  markTicketAsUsed,
  cancelTicket
} = require('../controllers/ticketController');

const router = express.Router();

// Validaciones
const createTicketValidation = [
  body('eventName')
    .trim()
    .isLength({ min: 3, max: 255 })
    .withMessage('Nombre del evento debe tener entre 3 y 255 caracteres'),
  body('eventDate')
    .isISO8601()
    .withMessage('Fecha del evento debe ser válida'),
  body('eventLocation')
    .trim()
    .isLength({ min: 3, max: 255 })
    .withMessage('Ubicación debe tener entre 3 y 255 caracteres'),
  body('price')
    .isFloat({ min: 0.01, max: 10000 })
    .withMessage('Precio debe ser entre 0.01 y 10,000'),
  body('buyerName')
    .trim()
    .isLength({ min: 2, max: 255 })
    .withMessage('Nombre del comprador debe tener entre 2 y 255 caracteres'),
  body('buyerEmail')
    .isEmail()
    .normalizeEmail()
    .withMessage('Email del comprador debe ser válido'),
  body('buyerPhone')
    .optional()
    .trim()
    .isLength({ min: 10, max: 20 })
    .withMessage('Teléfono debe tener entre 10 y 20 caracteres')
];

const resendTicketValidation = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Email debe ser válido')
];

const scanTicketValidation = [
  body('qrData')
    .notEmpty()
    .withMessage('Datos del QR son requeridos')
];

// Rutas protegidas
router.get('/', authenticateToken, asyncHandler(getTickets));
router.get('/:id', authenticateToken, asyncHandler(getTicket));
router.post('/', authenticateToken, requireSalesAccess, createTicketValidation, validateRequest, asyncHandler(createTicket));
router.post('/:id/resend', authenticateToken, resendTicketValidation, validateRequest, asyncHandler(resendTicket));
router.post('/scan', authenticateToken, requireScannerAccess, scanTicketValidation, validateRequest, asyncHandler(scanTicket));
router.put('/:id/mark-used', authenticateToken, requireScannerAccess, asyncHandler(markTicketAsUsed));
router.delete('/:id', authenticateToken, requireSalesAccess, asyncHandler(cancelTicket));

module.exports = router;