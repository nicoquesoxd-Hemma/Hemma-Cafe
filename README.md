# ☕ HemmaCafe POS - Sistema de Punto de Venta Profesional

HemmaCafe POS es una solución robusta y personalizada de Punto de Venta diseñada específicamente para las necesidades de una cafetería moderna. Este proyecto demuestra una integración avanzada entre un frontend reactivo y una base de datos en tiempo real con capacidades offline.

## 🌟 Características Destacadas

- **Gestión Multi-Mesa**: Control independiente de pedidos en mesas físicas y mostrador.
- **Sincronización Total**: Desarrollado con **Firebase Firestore** para actualizaciones instantáneas entre dispositivos.
- **Resiliencia Offline**: Implementación de persistencia local (IndexedDB) que permite seguir operando sin internet y sincronizar automáticamente al recuperar la señal.
- **Módulos Comerciales**:
    - **Inventario**: Control de stock con alertas y carga de imágenes (vía Cloudinary).
    - **Precios Flexibles**: Soporte para precios de lista, especiales y mayoristas vinculados a clientes.
    - **Sistema de Créditos**: Gestión de cuentas pendientes para clientes frecuentes con desglose de ítems.
    - **Reportes Financieros**: Cierre de caja diario y exportación de historial de ventas a Excel.

## 🛠️ Stack Tecnológico

- **Frontend**: React (Vite)
- **Base de Datos**: Firebase Firestore (NoSQL)
- **Estilos**: Vanilla CSS con sistema de variables para personalización dinámica.
- **Herramientas**: ExcelJS, Cloudinary SDK, Lucide-React.
- **Plataforma**: Preparado para Electron (Aplicación de Escritorio).

## 🔒 Versión de Demo (Para Portfolio)

Como este es un proyecto para un cliente real, he implementado un sistema de **aislamiento de entornos** para proteger la privacidad de los datos auténticos. 

Puedes explorar toda la funcionalidad de la aplicación usando las siguientes credenciales de prueba:

- **Usuario**: `HemmaDemo`
- **Contraseña**: `Demo2026`

### ¿Cómo funciona el Modo Demo?
Al iniciar sesión con estas credenciales, la aplicación activa automáticamente el **"MODO DEMO"**:
1. **Colecciones Aisladas**: La aplicación cambia los nombres de las colecciones en Firebase (ej. de `products` a `demo_products`), asegurando que tus pruebas no afecten los datos de producción.
2. **Local Storage Independiente**: Las preferencias y estados de mesas locales se guardan por separado, manteniendo una experiencia limpia.

---
*Desarrollado originalmente como una solución a medida para la gestión operativa de HemmaCafe.*
