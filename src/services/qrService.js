const QRCode = require('qrcode');

// Generar código QR como imagen
const generateQRCode = async (data, options = {}) => {
  try {
    const defaultOptions = {
      type: 'image/png',
      quality: 0.92,
      margin: 1,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      },
      width: parseInt(process.env.QR_SIZE) || 300,
      errorCorrectionLevel: process.env.QR_ERROR_CORRECTION || 'M'
    };

    const qrOptions = { ...defaultOptions, ...options };
    
    // Generar QR como data URL
    const qrCodeDataURL = await QRCode.toDataURL(data, qrOptions);
    
    return qrCodeDataURL;
  } catch (error) {
    console.error('Error generando código QR:', error);
    throw error;
  }
};

// Generar código QR como SVG
const generateQRCodeSVG = async (data, options = {}) => {
  try {
    const defaultOptions = {
      type: 'svg',
      margin: 1,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      },
      width: parseInt(process.env.QR_SIZE) || 300,
      errorCorrectionLevel: process.env.QR_ERROR_CORRECTION || 'M'
    };

    const qrOptions = { ...defaultOptions, ...options };
    
    const qrCodeSVG = await QRCode.toString(data, qrOptions);
    
    return qrCodeSVG;
  } catch (error) {
    console.error('Error generando código QR SVG:', error);
    throw error;
  }
};

// Validar formato de código QR de Nebula
const validateNebulaQRFormat = (qrData) => {
  // Formato esperado: NEBULA-timestamp-random
  const nebulaPattern = /^NEBULA-\d+-[a-zA-Z0-9]+$/;
  return nebulaPattern.test(qrData);
};

module.exports = {
  generateQRCode,
  generateQRCodeSVG,
  validateNebulaQRFormat
};