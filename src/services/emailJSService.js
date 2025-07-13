// src/services/emailJSService.js
import emailjs from '@emailjs/browser';

// Configuración (solo necesitas esto del dashboard de EmailJS)
const EMAIL_CONFIG = {
  serviceId: 'service_lzci3dr',     // Del dashboard EmailJS
  templateId: 'template_csxo0qi',   // Del dashboard EmailJS  
  publicKey: 'eBsJMmTrJj7MCvGf3'      // Del dashboard EmailJS
};

// Inicializar EmailJS
emailjs.init(EMAIL_CONFIG.publicKey);

// Enviar boleto por email (SÚPER FÁCIL)
export const sendTicketEmail = async (ticketData) => {
  try {
    const templateParams = {
      to_email: ticketData.buyer_email,
      to_name: ticketData.buyer_name,
      event_name: ticketData.event_name,
      ticket_number: ticketData.ticket_number,
      event_date: new Date(ticketData.event_date).toLocaleDateString('es-MX'),
      event_location: ticketData.event_location,
      price: ticketData.price,
      qr_code: ticketData.qr_code,
      // EmailJS puede generar QR automáticamente con: 
      qr_url: `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${ticketData.qr_code}`
    };

    const result = await emailjs.send(
      EMAIL_CONFIG.serviceId,
      EMAIL_CONFIG.templateId,
      templateParams
    );

    console.log('✅ Email enviado:', result);
    return result;
  } catch (error) {
    console.error('❌ Error enviando email:', error);
    throw error;
  }
};

// Para usar en tu controller:
// import { sendTicketEmail } from '../services/emailJSService.js';
// await sendTicketEmail(ticket);