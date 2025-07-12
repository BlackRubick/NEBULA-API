const { v4: uuidv4 } = require('uuid');
const { executeQuery } = require('../config/database');
const { createError } = require('../middleware/errorHandler');
const { generateQRCode } = require('../services/qrService');
const { sendTicketEmail } = require('../services/emailService');

// Generar número de boleto único
const generateTicketNumber = () => {
  const timestamp = Date.now().toString().slice(-8);
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `NBL-${timestamp}${random}`;
};

// Obtener lista de boletos con paginación
const getTickets = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    const search = req.query.search || '';
    const status = req.query.status || '';
    const eventId = req.query.eventId || '';

    // Construir query con filtros
    let whereClause = 'WHERE 1=1';
    const params = [];

    if (search) {
      whereClause += ' AND (t.ticket_number LIKE ? OR t.buyer_name LIKE ? OR t.buyer_email LIKE ? OR e.name LIKE ?)';
      const searchParam = `%${search}%`;
      params.push(searchParam, searchParam, searchParam, searchParam);
    }

    if (status) {
      whereClause += ' AND t.status = ?';
      params.push(status);
    }

    if (eventId) {
      whereClause += ' AND t.event_id = ?';
      params.push(eventId);
    }

    // Query principal con JOIN a events
    const query = `
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
        e.id as event_id,
        e.name as event_name,
        e.location as event_location,
        e.event_date
      FROM tickets t
      JOIN events e ON t.event_id = e.id
      ${whereClause}
      ORDER BY t.created_at DESC
      LIMIT ? OFFSET ?
    `;

    // Query para contar total
    const countQuery = `
      SELECT COUNT(*) as total
      FROM tickets t
      JOIN events e ON t.event_id = e.id
      ${whereClause}
    `;

    const [tickets, countResult] = await Promise.all([
      executeQuery(query, [...params, limit, offset]),
      executeQuery(countQuery, params)
    ]);

    const total = countResult[0].total;
    const totalPages = Math.ceil(total / limit);

    res.json({
      success: true,
      data: tickets,
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

// Obtener boleto específico
const getTicket = async (req, res, next) => {
  try {
    const { id } = req.params;

    const tickets = await executeQuery(`
      SELECT 
        t.*,
        e.name as event_name,
        e.location as event_location,
        e.event_date,
        u.name as created_by_name
      FROM tickets t
      JOIN events e ON t.event_id = e.id
      LEFT JOIN users u ON t.created_by = u.id
      WHERE t.id = ?
    `, [id]);

    if (!tickets.length) {
      throw createError(404, 'TICKET_NOT_FOUND', 'Boleto no encontrado');
    }

    res.json({
      success: true,
      data: tickets[0],
      message: 'Boleto obtenido exitosamente'
    });
  } catch (error) {
    next(error);
  }
};

// Crear nuevo boleto
const createTicket = async (req, res, next) => {
  try {
    const {
      eventName,
      eventDate,
      eventLocation,
      price,
      buyerName,
      buyerEmail,
      buyerPhone
    } = req.body;

    const userId = req.user.id;

    // Validaciones básicas
    if (!eventName || !eventDate || !eventLocation || !price || !buyerName || !buyerEmail) {
      throw createError(400, 'MISSING_FIELDS', 'Todos los campos obligatorios deben ser proporcionados');
    }

    if (price <= 0) {
      throw createError(400, 'INVALID_PRICE', 'El precio debe ser mayor a 0');
    }

    const eventDateTime = new Date(eventDate);
    if (eventDateTime <= new Date()) {
      throw createError(400, 'INVALID_DATE', 'La fecha del evento debe ser futura');
    }

    // Generar datos únicos
    const ticketId = uuidv4();
    const ticketNumber = generateTicketNumber();
    const qrCode = `NEBULA-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Buscar el evento (creado o existente)
    const events = await executeQuery(
      'SELECT id FROM events WHERE name = ? AND location = ? AND event_date = ?',
      [eventName, eventLocation, eventDateTime]
    );

    let eventId;
    if (events.length) {
      eventId = events[0].id;
    } else {
      // Crear evento nuevo
      eventId = uuidv4();
      await executeQuery(
        'INSERT INTO events (id, name, location, event_date, base_price, created_by) VALUES (?, ?, ?, ?, ?, ?)',
        [eventId, eventName, eventLocation, eventDateTime, price, userId]
      );
    }

    // Crear boleto
    await executeQuery(`
      INSERT INTO tickets (
        id, ticket_number, event_id, buyer_name, buyer_email, buyer_phone,
        price, qr_code, status, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)
    `, [ticketId, ticketNumber, eventId, buyerName, buyerEmail, buyerPhone, price, qrCode, userId]);

    // Obtener boleto completo creado
    const newTicket = await executeQuery(`
      SELECT 
        t.*,
        e.name as event_name,
        e.location as event_location,
        e.event_date
      FROM tickets t
      JOIN events e ON t.event_id = e.id
      WHERE t.id = ?
    `, [ticketId]);

    const ticket = newTicket[0];

    // Enviar boleto por email (en background)
    try {
      await sendTicketEmail(ticket);
    } catch (emailError) {
      console.error('Error enviando email:', emailError);
      // No fallar la creación del boleto por error de email
    }

    res.status(201).json({
      success: true,
      data: ticket,
      message: 'Boleto creado exitosamente'
    });
  } catch (error) {
    next(error);
  }
};

// Reenviar boleto por email
const resendTicket = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { email } = req.body;

    if (!email) {
      throw createError(400, 'MISSING_EMAIL', 'Email es requerido');
    }

    // Obtener boleto
    const tickets = await executeQuery(`
      SELECT 
        t.*,
        e.name as event_name,
        e.location as event_location,
        e.event_date
      FROM tickets t
      JOIN events e ON t.event_id = e.id
      WHERE t.id = ?
    `, [id]);

    if (!tickets.length) {
      throw createError(404, 'TICKET_NOT_FOUND', 'Boleto no encontrado');
    }

    const ticket = tickets[0];

    // Actualizar email si es diferente
    if (email !== ticket.buyer_email) {
      await executeQuery(
        'UPDATE tickets SET buyer_email = ?, updated_at = NOW() WHERE id = ?',
        [email, id]
      );
      ticket.buyer_email = email;
    }

    // Enviar boleto
    await sendTicketEmail(ticket);

    res.json({
      success: true,
      message: `Boleto reenviado exitosamente a ${email}`
    });
  } catch (error) {
    next(error);
  }
};

// Escanear boleto (validar QR)
const scanTicket = async (req, res, next) => {
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

// Marcar boleto como usado
const markTicketAsUsed = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Verificar que el boleto existe y está activo
    const tickets = await executeQuery(
      'SELECT id, status FROM tickets WHERE id = ?',
      [id]
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
      [id]
    );

    res.json({
      success: true,
      message: 'Boleto marcado como usado exitosamente'
    });
  } catch (error) {
    next(error);
  }
};

// Cancelar boleto
const cancelTicket = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Verificar que el boleto existe
    const tickets = await executeQuery(
      'SELECT id, status FROM tickets WHERE id = ?',
      [id]
    );

    if (!tickets.length) {
      throw createError(404, 'TICKET_NOT_FOUND', 'Boleto no encontrado');
    }

    const ticket = tickets[0];

    if (ticket.status === 'used') {
      throw createError(400, 'TICKET_ALREADY_USED', 'No se puede cancelar un boleto ya utilizado');
    }

    // Cancelar boleto
    await executeQuery(
      'UPDATE tickets SET status = "cancelled", updated_at = NOW() WHERE id = ?',
      [id]
    );

    res.json({
      success: true,
      message: 'Boleto cancelado exitosamente'
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getTickets,
  getTicket,
  createTicket,
  resendTicket,
  scanTicket,
  markTicketAsUsed,
  cancelTicket
};