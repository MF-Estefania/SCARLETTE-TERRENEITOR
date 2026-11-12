# SCARLETTE – TERRENEITOR

### Aplicación web para el control y monitoreo de un vehículo IoT

**Práctica 4.1 – Aplicación de control para IoT**

**Desarrollado por:** Estefanía Marín  
**Tecnología principal:** HTML5, CSS3, JavaScript, FastAPI, WebSocket y AWS.

## 1. Descripción del proyecto

SCARLETTE es una aplicación web desarrollada para controlar y monitorear el vehículo IoT Terreneitor mediante una interfaz gráfica responsiva.

El sistema permite ejecutar movimientos individuales, controlar el vehículo mediante un joystick, iniciar y cancelar secuencias DEMO, y enviar órdenes de detención. La comunicación se realiza mediante una API REST desarrollada con FastAPI y desplegada en Amazon EC2.

También incorpora comunicación WebSocket para recibir eventos en tiempo real y consultar la actividad del sistema desde diferentes sesiones.

## 2. Objetivo

Desarrollar una aplicación web que permita controlar un vehículo IoT desde diferentes dispositivos, integrando servicios REST, comunicación WebSocket, una base de datos en la nube y una interfaz accesible y adaptable a distintos tamaños de pantalla.

## 3. Tecnologías utilizadas

| Tecnología | Función |
|---|---|
| HTML5 | Estructura de la aplicación |
| CSS3 y Bootstrap 5 | Diseño responsivo |
| JavaScript ES6+ | Interactividad y comunicación con la API |
| Fetch API | Solicitudes HTTP |
| WebSocket (WSS) | Recepción de eventos en tiempo real |
| FastAPI | Backend y servicios REST |
| Amazon EC2 | Alojamiento del servidor |
| Amazon RDS MySQL | Almacenamiento de información |
| ESP8266 NodeMCU | Control electrónico del vehículo |
| 74HC595 | Expansión de salidas digitales |
| GitHub Pages | Publicación de la aplicación web |

## 4. Arquitectura del sistema

El sistema utiliza una arquitectura cliente-servidor que conecta la aplicación web con los servicios alojados en AWS y el vehículo físico.

```text
SCARLETTE (GitHub Pages)
          |
          | HTTPS / REST
          v
     FastAPI (EC2)
          |
          +------> Amazon RDS (MySQL)
          |
          | WebSocket seguro (WSS)
          v
    ESP8266 NodeMCU
          |
       74HC595
          |
    Optoacopladores
          |
   Control del Terreneitor
```

La aplicación web envía las solicitudes al backend, que valida las operaciones y administra la comunicación con el vehículo. Los eventos WebSocket permiten observar los comandos procesados por el sistema.

## 5. Funcionalidades

### Control de movimientos

La aplicación incorpora controles para ejecutar las funciones disponibles del Terreneitor, incluyendo avance, retroceso, movimientos diagonales, desplazamientos laterales, giros y otras funciones del control original.

### Joystick virtual

Permite seleccionar movimientos mediante una interfaz circular compatible con mouse y pantallas táctiles.

### Secuencias DEMO

Permite consultar y ejecutar secuencias de movimientos previamente registradas, así como solicitar su cancelación.

### Detención del vehículo

Incluye un botón STOP visible que permite solicitar la interrupción de los movimientos.

### Monitoreo WebSocket

Permite observar eventos asociados con los comandos enviados, incluyendo la identificación del vehículo y la información disponible en cada mensaje.

### Autenticación

El sistema dispone de inicio de sesión y cuentas con diferentes privilegios. La autorización de las operaciones protegidas corresponde al backend.

### Indicadores de conectividad

El panel muestra información sobre:

- Comunicación WebSocket.
- Disponibilidad de la API alojada en AWS.
- Estado de conexión con Amazon RDS, mediante las verificaciones proporcionadas por el backend.

Estos indicadores representan los servicios comprobados y no sustituyen la confirmación del movimiento físico del vehículo.

## 6. Organización del proyecto

```text
SCARLETTE/
├── assets/
│   ├── css/
│   │   └── styles.css
│   └── js/
│       └── controls.js
├── index.html
├── panel.html
└── README.md
```

Los archivos HTML contienen las vistas principales, mientras que los recursos CSS y JavaScript se organizan dentro de `assets`.

El proyecto también puede incluir otros archivos JavaScript, imágenes y recursos de configuración utilizados por la aplicación.

## 7. Ejecución local

1. Clonar el repositorio:

```bash
git clone https://github.com/MF-Estefania/SCARLETTE-TERRENEITOR.git
```

2. Abrir la carpeta del proyecto en Visual Studio Code.

3. Ejecutar la aplicación mediante un servidor HTTP local, por ejemplo, Live Server.

4. Abrir `index.html` en el navegador.

5. Iniciar sesión con una cuenta autorizada para utilizar las funciones disponibles.

La aplicación requiere acceso a Internet y disponibilidad de los servicios del backend para realizar operaciones remotas.

## 8. Publicación en GitHub Pages

La aplicación se encuentra publicada en:

https://mf-estefania.github.io/SCARLETTE-TERRENEITOR/

Para actualizar la publicación:

1. Verificar que los cambios funcionen localmente.
2. Confirmar que las rutas de los archivos sean compatibles con GitHub Pages.
3. Registrar los cambios mediante Git.
4. Enviar los cambios al repositorio remoto.
5. Comprobar la aplicación publicada.

GitHub Pages aloja únicamente el frontend. La API y la base de datos se mantienen en AWS.

## 9. Comunicación REST y WebSocket

### API REST

La aplicación utiliza solicitudes HTTP para consultar información y ejecutar operaciones de control autorizadas.

**Documentación Swagger:**

https://api-terreneitor-km2026.duckdns.org/docs

### WebSocket

La comunicación en tiempo real utiliza el protocolo WSS.

```text
wss://api-terreneitor-km2026.duckdns.org/ws/vehiculos/7
```

La conexión debe cumplir los mecanismos de autenticación establecidos por la API.

Los mensajes recibidos permiten identificar eventos relacionados con los movimientos y las secuencias DEMO.

## 10. Pruebas de funcionamiento

Durante el desarrollo se realizaron pruebas de:

| Prueba | Verificación |
|---|---|
| Inicio de sesión | Acceso a la aplicación con cuentas autorizadas |
| Movimientos | Envío de comandos desde el panel |
| Joystick | Selección de movimientos mediante controles táctiles y mouse |
| STOP | Solicitud de detención |
| DEMO | Inicio, ejecución y cancelación de secuencias |
| WebSocket | Recepción de eventos desde otra sesión |
| Diseño responsivo | Visualización en computadora y teléfono |
| API REST | Comunicación con FastAPI |
| AWS | Conectividad con los servicios desplegados |

**Observación:** Durante las pruebas físicas se identificó una incidencia pendiente en la respuesta del movimiento F. El envío del comando y la activación del indicador del optoacoplador no garantizan por sí solos que el vehículo haya ejecutado físicamente el movimiento.

## 11. Seguridad

El proyecto contempla las siguientes medidas:

- Comunicación HTTPS y WSS.
- Autenticación para acceder a las funciones protegidas.
- Validación de permisos desde el backend.
- Manejo de errores de comunicación.
- Separación entre frontend, API y base de datos.
- Exclusión de contraseñas, claves privadas y credenciales de AWS del repositorio público.
- Validación de los comandos antes de su ejecución.

La base de datos no se conecta directamente desde el navegador; todas las operaciones se realizan mediante los servicios autorizados del backend.

## 12. Diseño responsivo y accesibilidad

SCARLETTE fue diseñada para adaptarse a computadoras y dispositivos móviles en orientación vertical y horizontal.

La interfaz incorpora controles táctiles, distribución adaptable, indicadores de estado y un botón STOP destacado para facilitar su utilización.

## 13. Resultados

Se logró integrar una aplicación web con una API REST alojada en AWS, una base de datos MySQL y comunicación WebSocket para controlar y monitorear el Terreneitor.

Las pruebas permitieron comprobar la ejecución de movimientos, el funcionamiento de las secuencias DEMO y la recepción de eventos desde sesiones independientes.

También se identificaron aspectos que requieren seguimiento en el circuito físico y en la estabilidad de las conexiones.

## 14. Conclusión

Con esta práctica logré integrar diferentes tecnologías para desarrollar una aplicación de control IoT accesible desde un navegador. Implementé una interfaz responsiva, conecté los controles con los servicios de AWS y utilicé WebSocket para recibir información en tiempo real. Las pruebas realizadas me permitieron comprobar la comunicación entre el software y el vehículo, además de identificar problemas que requieren revisión. Este proyecto me ayudó a comprender mejor la relación entre el desarrollo web, las APIs, los servicios en la nube y los sistemas electrónicos.

---

**SCARLETTE – TERRENEITOR**  
Práctica 4.1 · Aplicación de control para IoT