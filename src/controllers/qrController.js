const { executeQuery } = require('../config/database');
const { createError } = require('../middleware/errorHandler');

// Validar código QR
const validateQR = async (req, res, next) => {
  try {
    const { qrData } = req.body;

    if (!qrData) {
      throw createError(400, 'MISSING_QR_DATA', 'Datos del QR requeridos');
    }

    // Buscar boleto por QR
    const tickets = await executeQuery(`
      SELECT 
        t.*,
        e.name as event_name,
        e.location as event_location,
        e.event_date
      FROM tickets t
      JOIN events e ON t.event_id = e.id
      WHERE t.qr_code = ?
    `, [qrData]);

    if (!tickets.length) {
      return res.json({
        success: true,
        data: {
          ticket: null,
          isValid: false,
          message: 'Código QR no válido'
        }
      });
    }

    const ticket = tickets[0];
    let isValid = false;
    let message = '';

    switch (ticket.status) {
      case 'active':
        isValid = true;
        message = 'Boleto válido';
        break;
      case 'used':
        message = `Boleto ya utilizado el ${new Date(ticket.used_at).toLocaleString('es-MX')}`;
        break;
      case 'cancelled':
        message = 'Boleto cancelado';
        break;
      default:
        message = 'Estado de boleto desconocido';
    }

    res.json({
      success: true,
      data: {
        ticket,
        isValid,
        message
      }
    });
  } catch (error) {
    next(error);
  }
};

// Marcar como usado
const markAsUsed = async (req, res, next) => {
  try {
    const { ticketId } = req.body;

    if (!ticketId) {
      throw createError(400, 'MISSING_TICKET_ID', 'ID del boleto requerido');
    }

    // Verificar que el boleto existe y está activo
    const tickets = await executeQuery(
      'SELECT id, status FROM tickets WHERE id = ?',
      [ticketId]
    );

    if (!tickets.length) {
      throw createError(404, 'TICKET_NOT_FOUND', 'Boleto no encontrado');
    }

    const ticket = tickets[0];

    if (ticket.status !== 'active') {
      throw createError(400, 'TICKET_NOT_ACTIVE', 'El boleto no está activo');
    }

    // Marcar como usado
    await executeQuery(
      'UPDATE tickets SET status = "used", used_at = NOW(), updated_at = NOW() WHERE id = ?',
      [ticketId]
    );

    res.json({
      success: true,
      message: 'Boleto marcado como usado exitosamente'
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  validateQR,
  markAsUsed
};