// fix_all_users.js - Script para arreglar todos los usuarios
const bcrypt = require('bcryptjs');
const mysql = require('mysql2/promise');

async function fixAllUsers() {
  console.log('🔧 Arreglando todos los usuarios...\n');

  const dbConfig = {
    host: 'localhost',
    port: 3306,
    user: 'nebula_user',
    password: 'cesar',
    database: 'nebula_db'
  };

  try {
    const connection = await mysql.createConnection(dbConfig);
    console.log('✅ Conectado a MySQL\n');

    // 1. Mostrar usuarios actuales
    console.log('👥 Usuarios actuales en la base de datos:');
    const [currentUsers] = await connection.execute('SELECT email, name, role, is_active FROM users');
    console.table(currentUsers);

    // 2. Crear/actualizar todos los usuarios con contraseñas frescas
    const users = [
      {
        id: 'admin-001',
        email: 'admin@nebula.com',
        name: 'Administrador Principal',
        password: 'admin123',
        role: 'admin'
      },
      {
        id: 'sales-001',
        email: 'sales@nebula.com',
        name: 'Vendedor Principal',
        password: 'sales123',
        role: 'sales'
      },
      {
        id: 'scanner-001',
        email: 'scanner@nebula.com',
        name: 'Escáner Principal',
        password: 'scanner123',
        role: 'scanner'
      }
    ];

    console.log('\n🔄 Actualizando/creando usuarios...\n');

    for (const user of users) {
      console.log(`🔧 Procesando: ${user.email}`);
      
      // Hashear la contraseña
      const hashedPassword = await bcrypt.hash(user.password, 12);
      console.log(`   🔐 Contraseña: ${user.password}`);
      console.log(`   🔒 Hash generado: ${hashedPassword.substring(0, 20)}...`);

      try {
        // Primero intentar actualizar si existe
        const [updateResult] = await connection.execute(
          'UPDATE users SET name = ?, password = ?, role = ?, is_active = TRUE WHERE email = ?',
          [user.name, hashedPassword, user.role, user.email]
        );

        if (updateResult.affectedRows > 0) {
          console.log(`   ✅ Usuario actualizado: ${user.email}`);
        } else {
          // Si no existe, crear nuevo
          await connection.execute(
            'INSERT INTO users (id, email, name, password, role, is_active) VALUES (?, ?, ?, ?, ?, TRUE)',
            [user.id, user.email, user.name, hashedPassword, user.role]
          );
          console.log(`   ✅ Usuario creado: ${user.email}`);
        }

        // 3. Probar la contraseña inmediatamente
        console.log(`   🧪 Probando contraseña...`);
        const [testUser] = await connection.execute(
          'SELECT password FROM users WHERE email = ?',
          [user.email]
        );
        
        if (testUser.length > 0) {
          const isValid = await bcrypt.compare(user.password, testUser[0].password);
          console.log(`   ${isValid ? '✅ Contraseña VÁLIDA' : '❌ Contraseña INVÁLIDA'}`);
        }

      } catch (error) {
        console.log(`   ❌ Error: ${error.message}`);
      }
      
      console.log(''); // Línea en blanco
    }

    // 4. Mostrar resumen final
    console.log('📋 RESUMEN FINAL:');
    const [finalUsers] = await connection.execute('SELECT email, name, role, is_active FROM users');
    console.table(finalUsers);

    console.log('\n🎯 CREDENCIALES PARA USAR:');
    console.log('┌─────────────────────────┬─────────────┬──────────┐');
    console.log('│ Email                   │ Contraseña  │ Rol      │');
    console.log('├─────────────────────────┼─────────────┼──────────┤');
    console.log('│ admin@nebula.com        │ admin123    │ admin    │');
    console.log('│ sales@nebula.com        │ sales123    │ sales    │');
    console.log('│ scanner@nebula.com      │ scanner123  │ scanner  │');
    console.log('└─────────────────────────┴─────────────┴──────────┘');

    console.log('\n✅ ¡Todos los usuarios están listos!');
    console.log('🚀 Reinicia tu API y prueba hacer login con cualquiera de los usuarios de arriba.');

    await connection.end();

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

// Ejecutar la reparación
fixAllUsers().catch(console.error);