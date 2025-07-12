const nodemailer = require('nodemailer');
const { generateQRCode } = require('./qrService');
const { generateTicketPDF } = require('./pdfService');

// Configurar transportador de email
const createTransporter = () => {
  return nodemailer.createTransporter({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
};

// Plantilla HTML para boleto
const getTicketEmailTemplate = (ticket, qrCodeDataURL) => {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Tu Boleto - ${ticket.event_name}</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5; }
        .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; color: white; }
        .content { padding: 30px; }
        .ticket-info { background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; }
        .qr-container { text-align: center; margin: 30px 0; }
        .qr-code { max-width: 200px; height: auto; }
        .footer { background: #f8f9fa; padding: 20px; text-align: center; color: #666; }
        .important { color: #e74c3c; font-weight: bold; }
        h1 { margin: 0; font-size: 28px; }
        h2 { color: #333; margin-top: 0; }
        .detail-row { display: flex; justify-content: space-between; margin: 10px 0; padding: 10px 0; border-bottom: 1px solid #eee; }
        .detail-label { font-weight: bold; color: #666; }
        .detail-value { color: #333; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🎫 Tu Boleto Está Listo</h1>
          <p>Sistema Nebula</p>
        </div>
        
        <div class="content">
          <h2>¡Hola ${ticket.buyer_name}!</h2>
          <p>Tu boleto para <strong>${ticket.event_name}</strong> ha sido generado exitosamente.</p>
          
          <div class="ticket-info">
            <h3>📋 Detalles del Boleto</h3>
            <div class="detail-row">
              <span class="detail-label">Número de Boleto:</span>
              <span class="detail-value">${ticket.ticket_number}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Evento:</span>
              <span class="detail-value">${ticket.event_name}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Fecha:</span>
              <span class="detail-value">${new Date(ticket.event_date).toLocaleDateString('es-MX', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Ubicación:</span>
              <span class="detail-value">${ticket.event_location}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Precio:</span>
              <span class="detail-value">$${ticket.price}</span>
            </div>
          </div>

          <div class="qr-container">
            <h3>📱 Código QR</h3>
            <p>Presenta este código en el evento:</p>
            <img src="${qrCodeDataURL}" alt="Código QR" class="qr-code">
            <p><small>Código: ${ticket.qr_code}</small></p>
          </div>

          <div class="important">
            <h3>⚠️ Importante:</h3>
            <ul>
              <li>Guarda este email en un lugar seguro</li>
              <li>Presenta el código QR en el evento</li>
              <li>El boleto es intransferible</li>
              <li>Llega 30 minutos antes del evento</li>
            </ul>
          </div>
        </div>

        <div class="footer">
          <p>¿Problemas con tu boleto? Contacta nuestro soporte.</p>
          <p>© ${new Date().getFullYear()} Sistema Nebula - Gestión de Boletos</p>
        </div>
      </div>
    </body>
    </html>
  `;
};

// Enviar boleto por email
const sendTicketEmail = async (ticket) => {
  try {
    const transporter = createTransporter();
    
    // Generar código QR
    const qrCodeDataURL = await generateQRCode(ticket.qr_code);
    
    // Generar PDF del boleto
    const pdfBuffer = await generateTicketPDF(ticket, qrCodeDataURL);
    
    // Configurar email
    const mailOptions = {
      from: `${process.env.FROM_NAME || 'Sistema Nebula'} <${process.env.FROM_EMAIL || process.env.SMTP_USER}>`,
      to: ticket.buyer_email,
      subject: `🎫 Tu boleto para ${ticket.event_name} - ${ticket.ticket_number}`,
      html: getTicketEmailTemplate(ticket, qrCodeDataURL),
      attachments: [
        {
          filename: `boleto-${ticket.ticket_number}.pdf`,
          content: pdfBuffer,
          contentType: 'application/pdf'
        }
      ]
    };

    // Enviar email
    const info = await transporter.sendMail(mailOptions);
    
    console.log('✅ Email enviado:', info.messageId);
    return info;
  } catch (error) {
    console.error('❌ Error enviando email:', error);
    throw error;
  }
};

// Enviar email de notificación
const sendNotificationEmail = async (to, subject, message) => {
  try {
    const transporter = createTransporter();
    
    const mailOptions = {
      from: `${process.env.FROM_NAME || 'Sistema Nebula'} <${process.env.FROM_EMAIL || process.env.SMTP_USER}>`,
      to,
      subject,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #333;">${subject}</h2>
          <p style="color: #666; line-height: 1.6;">${message}</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
          <p style="color: #999; font-size: 12px;">Sistema Nebula - Gestión de Boletos</p>
        </div>
      `
    };

    const info = await transporter.sendMail(mailOptions);
    return info;
  } catch (error) {
    console.error('❌ Error enviando notificación:', error);
    throw error;
  }
};

module.exports = {
  sendTicketEmail,
  sendNotificationEmail
};