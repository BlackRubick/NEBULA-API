const PDFDocument = require('pdfkit');

// Generar PDF del boleto
const generateTicketPDF = async (ticket, qrCodeDataURL) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const buffers = [];

      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => {
        const pdfData = Buffer.concat(buffers);
        resolve(pdfData);
      });

      // Header
      doc.fontSize(24)
         .fillColor('#667eea')
         .text('BOLETO ELECTRÓNICO', 50, 50);

      doc.fontSize(16)
         .fillColor('#333')
         .text('Sistema Nebula', 50, 80);

      // Línea separadora
      doc.moveTo(50, 110)
         .lineTo(545, 110)
         .stroke('#667eea');

      // Información del evento
      let yPosition = 140;
      
      doc.fontSize(20)
         .fillColor('#333')
         .text(ticket.event_name, 50, yPosition);
      
      yPosition += 40;
      
      doc.fontSize(12)
         .fillColor('#666');

      // Detalles en dos columnas
      const leftColumn = 50;
      const rightColumn = 300;

      doc.text('NÚMERO DE BOLETO:', leftColumn, yPosition);
      doc.fillColor('#333')
         .text(ticket.ticket_number, leftColumn + 120, yPosition);
      
      doc.fillColor('#666')
         .text('FECHA DEL EVENTO:', rightColumn, yPosition);
      doc.fillColor('#333')
         .text(new Date(ticket.event_date).toLocaleDateString('es-MX', {
           weekday: 'long',
           year: 'numeric',
           month: 'long',
           day: 'numeric',
           hour: '2-digit',
           minute: '2-digit'
         }), rightColumn + 120, yPosition);

      yPosition += 30;

      doc.fillColor('#666')
         .text('COMPRADOR:', leftColumn, yPosition);
      doc.fillColor('#333')
         .text(ticket.buyer_name, leftColumn + 120, yPosition);

      doc.fillColor('#666')
         .text('UBICACIÓN:', rightColumn, yPosition);
      doc.fillColor('#333')
         .text(ticket.event_location, rightColumn + 120, yPosition);

      yPosition += 30;

      doc.fillColor('#666')
         .text('EMAIL:', leftColumn, yPosition);
      doc.fillColor('#333')
         .text(ticket.buyer_email, leftColumn + 120, yPosition);

      doc.fillColor('#666')
         .text('PRECIO:', rightColumn, yPosition);
      doc.fillColor('#333')
         .text(`$${ticket.price}`, rightColumn + 120, yPosition);

      // Código QR
      yPosition += 60;
      
      doc.fontSize(14)
         .fillColor('#333')
         .text('CÓDIGO QR:', leftColumn, yPosition);

      yPosition += 20;

      // Convertir data URL a buffer
      if (qrCodeDataURL && qrCodeDataURL.startsWith('data:image')) {
        const base64Data = qrCodeDataURL.split(',')[1];
        const qrBuffer = Buffer.from(base64Data, 'base64');
        
        doc.image(qrBuffer, leftColumn, yPosition, { width: 150, height: 150 });
      }

      // Código de texto
      doc.fontSize(10)
         .fillColor('#666')
         .text(ticket.qr_code, leftColumn, yPosition + 160, { width: 150, align: 'center' });

      // Instrucciones
      yPosition += 200;

      doc.fontSize(12)
         .fillColor('#e74c3c')
         .text('INSTRUCCIONES IMPORTANTES:', leftColumn, yPosition);

      yPosition += 20;

      const instructions = [
        '• Presenta este boleto en formato digital o impreso en el evento',
        '• El código QR debe estar claramente visible',
        '• Llega 30 minutos antes del inicio del evento',
        '• Este boleto es intransferible',
        '• Conserva este documento hasta después del evento'
      ];

      doc.fontSize(10)
         .fillColor('#333');

      instructions.forEach(instruction => {
        doc.text(instruction, leftColumn, yPosition);
        yPosition += 15;
      });

      // Footer
      yPosition = 750;
      doc.moveTo(50, yPosition)
         .lineTo(545, yPosition)
         .stroke('#ccc');

      doc.fontSize(8)
         .fillColor('#999')
         .text(`Generado el ${new Date().toLocaleDateString('es-MX')} por Sistema Nebula`, 
               leftColumn, yPosition + 10);

      doc.text(`Boleto válido hasta: ${new Date(ticket.event_date).toLocaleDateString('es-MX')}`, 
               rightColumn, yPosition + 10);

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
};

module.exports = {
  generateTicketPDF
};