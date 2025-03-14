# LEC Fantasy Manager

LEC Fantasy Manager es una aplicación web que permite a los usuarios crear y participar en ligas de fantasy basadas en la Liga Europea de League of Legends (LEC). Los usuarios pueden formar equipos con jugadores profesionales de la LEC, ganar puntos basados en el rendimiento real de los jugadores, y competir contra amigos en ligas personalizadas.

## Características Principales

- Creación y gestión de ligas personalizadas
- Sistema de compra/venta de jugadores
- Mercado de traspasos entre usuarios
- Seguimiento de puntuaciones y clasificación
- Gestión de alineaciones
- Histórico de transacciones

## Estructura del Proyecto

El proyecto está dividido en dos partes principales:

- `client`: Frontend desarrollado con React
- `server`: Backend desarrollado con Node.js, Express y MongoDB

---

## Servidor (Backend)

### Tecnologías Utilizadas

- Node.js
- Express.js como framework web
- MongoDB como base de datos
- Mongoose para modelado de datos
- JWT para autenticación
- Axios para peticiones a APIs externas (LoL Esports API)

### Estructura de Directorios

```
server/
├── config/            # Configuración de la aplicación
├── db/                # Conexión a base de datos
├── error-handling/    # Manejo de errores
├── middleware/        # Middleware de Express
├── models/            # Modelos de Mongoose
├── routes/            # Rutas de la API
├── app.js             # Aplicación Express
└── server.js          # Punto de entrada
```

### Modelos

- **User**: Información de usuarios
- **MyLeagues**: Ligas creadas por usuarios
- **UserLeague**: Relación usuario-liga (incluye saldo económico)
- **UserPlayer**: Jugadores en posesión de usuarios
- **LineupPlayer**: Alineación de jugadores titulares
- **PlayerOffer**: Ofertas de traspasos entre usuarios
- **Transaction**: Registro de transacciones realizadas

### Rutas API

#### Autenticación
- `POST /api/auth/register`: Registro de usuarios
- `POST /api/auth/login`: Inicio de sesión

#### Ligas
- `GET /api/my-leagues`: Obtener ligas del usuario
- `POST /api/create`: Crear nueva liga
- `POST /api/join`: Unirse a una liga mediante código
- `POST /api/leave/:leagueId`: Abandonar una liga

#### Jugadores
- `GET /api/players`: Obtener todos los jugadores disponibles
- `GET /api/players/team/:teamId`: Jugadores por equipo
- `GET /api/players/position/:position`: Jugadores por posición
- `GET /api/players/user/:leagueId`: Jugadores del usuario en una liga
- `POST /api/players/buy`: Comprar jugador
- `POST /api/players/sell/market`: Vender jugador al mercado
- `POST /api/players/sell/offer`: Crear oferta a otro usuario
- `POST /api/players/offer/accept/:offerId`: Aceptar oferta
- `POST /api/players/offer/reject/:offerId`: Rechazar oferta
- `GET /api/players/offers/:leagueId`: Obtener ofertas pendientes
- `GET /api/players/owners/:leagueId`: Obtener propietarios de jugadores

#### Alineación
- `POST /api/players/lineup`: Establecer jugador como titular
- `GET /api/players/lineup/:leagueId/:matchday?`: Obtener alineación actual

#### Transacciones
- `GET /api/transactions/:leagueId`: Historial de transacciones
- `POST /api/transactions`: Registrar transacción

#### Datos externos
- `GET /api/teams`: Obtener equipos de la LEC
- `GET /api/matches`: Obtener partidos