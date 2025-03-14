const router = require('express').Router();
const axios = require('axios');
const mongoose = require('mongoose');
const User = require('../models/user.model');
const MyLeagues = require('../models/myLeagues.model');
const auth = require('../middleware/auth');
require('dotenv').config();
const LineupPlayer = require('../models/LineupPlayer.model');
const UserLeague = require('../models/UserLeague.model');
const PlayerOffer = require('../models/PlayerOffer.model');

const API_KEY = process.env.LOLESPORTS_API_KEY;
const LEC_ID = "98767991302996019"; // LEC id

// Función auxiliar para obtener información de un jugador
async function getPlayerInfo(playerId) {
    try {
        // Usar el mismo endpoint que usa el router.get('/players')
        const response = await axios.get("https://esports-api.lolesports.com/persisted/gw/getTeams", {
            headers: {
                "x-api-key": API_KEY
            },
            params: {
                hl: "en-US"
            }
        });

        const allTeams = response.data.data.teams || [];

        // Filtrar los equipos de la LEC, igual que en router.get('/players')
        const lecTeams = allTeams.filter(team =>
            team.homeLeague && team.homeLeague.name === "LEC"
        );

        // Buscar al jugador con el ID especificado en todos los equipos de la LEC
        let foundPlayer = null;
        let playerTeam = null;

        // Recorrer todos los equipos de la LEC buscando al jugador
        for (const team of lecTeams) {
            const teamPlayers = team.players || [];
            const player = teamPlayers.find(p => p.id === playerId);

            if (player) {
                // Excluir "Ben01" si lo encontramos
                if (player.summonerName !== "Ben01" && player.name !== "Ben01") {
                    foundPlayer = player;
                    playerTeam = team;
                    break;
                }
            }
        }

        if (!foundPlayer || !playerTeam) {
            return null;
        }

        // Añadir precio simulado (igual que en router.get('/players'))
        const price = Math.floor(Math.random() * 5) + 5; // Precios entre 5 y 10 millones

        // Devolver el jugador con la misma estructura que en router.get('/players')
        const playerData = {
            ...foundPlayer,
            team: playerTeam.code,
            teamName: playerTeam.name,
            teamId: playerTeam.id,
            price: price
        };

        return playerData;
    } catch (error) {
        console.error("Error fetching player info:", error);
        return null;
    }
}

// Función de ayuda para normalizar posiciones
function normalizePosition(position) {
    if (!position) return null;

    // Asegurarse de que tenemos un string en minúsculas
    position = String(position).toLowerCase();

    // Mapa de normalización de posiciones
    const positionMap = {
        'adc': 'bottom',
        'bot': 'bottom',
        'ad carry': 'bottom',
        'sup': 'support',
        'jg': 'jungle',
        'jung': 'jungle',
        'm': 'mid',
        'mid': 'mid',
        'middle': 'mid',
        't': 'top',
        'toplane': 'top'
    };

    // Devolver la posición normalizada o la original si no hay mapeo
    return positionMap[position] || position;
}

// Función de ayuda para verificar si dos posiciones son equivalentes
function arePositionsEquivalent(position1, position2) {
    if (!position1 || !position2) return false;

    // Normalizar ambas posiciones
    const normalized1 = normalizePosition(position1);
    const normalized2 = normalizePosition(position2);

    // Comparar las posiciones normalizadas
    return normalized1 === normalized2;
}

// Modelo esquema para UserPlayer (jugadores comprados por un usuario)
const userPlayerSchema = new mongoose.Schema({
    playerId: {
        type: String,
        required: true
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    leagueId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'MyLeagues',
        required: true
    },
    purchaseDate: {
        type: Date,
        default: Date.now
    }
});

const UserPlayer = mongoose.model('UserPlayer', userPlayerSchema);

// GET /api/players - Obtener todos los jugadores de la LEC (excluyendo a Ben01)
router.get('/players', async (req, res) => {
    try {
        const response = await axios.get("https://esports-api.lolesports.com/persisted/gw/getTeams", {
            headers: {
                "x-api-key": API_KEY
            },
            params: {
                hl: "en-US"
            }
        });

        const allTeams = response.data.data.teams || [];

        const lecTeams = allTeams.filter(team =>
            team.homeLeague && team.homeLeague.name === "LEC"
        );

        if (!lecTeams.length) {
            return res.status(404).json({ message: "No LEC teams found" });
        }

        // Extraer jugadores y añadir el equipo al que pertenecen
        const allPlayers = [];
        lecTeams.forEach(team => {
            const teamPlayers = team.players || [];
            teamPlayers.forEach(player => {
                // Excluir al jugador "Ben01"
                if (player.summonerName !== "Ben01" && player.name !== "Ben01") {
                    // Añadir precio basado en estadísticas (simulado)
                    const price = Math.floor(Math.random() * 5) + 5; // Precios entre 5 y 10 millones

                    allPlayers.push({
                        ...player,
                        team: team.code,
                        teamName: team.name,
                        teamId: team.id,
                        price: price
                    });
                }
            });
        });

        if (!allPlayers.length) {
            return res.status(404).json({ message: "No LEC players found" });
        }

        res.json(allPlayers);
    } catch (error) {
        console.error("Error fetching LEC players from LoLEsports API:", error.response?.data || error);
        res.status(500).json({ message: "Failed to fetch LEC players" });
    }
});

// GET /api/players/team/:teamId - Obtener jugadores por equipo (excluyendo a Ben01)
router.get('/players/team/:teamId', async (req, res) => {
    try {
        const { teamId } = req.params;

        const response = await axios.get("https://esports-api.lolesports.com/persisted/gw/getTeams", {
            headers: {
                "x-api-key": API_KEY
            },
            params: {
                hl: "en-US",
                id: teamId
            }
        });

        const team = response.data.data.teams && response.data.data.teams[0];

        if (!team || !team.players || !team.players.length) {
            return res.status(404).json({ message: "No players found for this team" });
        }

        // Filtrar para excluir a Ben01 y añadir precios a los jugadores
        const playersWithPrices = team.players
            .filter(player => player.summonerName !== "Ben01" && player.name !== "Ben01")
            .map(player => ({
                ...player,
                team: team.code,
                teamName: team.name,
                teamId: team.id,
                price: Math.floor(Math.random() * 5) + 5 // Precios entre 5 y 10 millones
            }));

        if (!playersWithPrices.length) {
            return res.status(404).json({ message: "No eligible players found for this team" });
        }

        res.json(playersWithPrices);
    } catch (error) {
        console.error("Error fetching team players from LoLEsports API:", error.response?.data || error);
        res.status(500).json({ message: "Failed to fetch team players" });
    }
});

// GET /api/players/position/:position - Obtener jugadores por posición
router.get('/players/position/:position', async (req, res) => {
    try {
        const { position } = req.params;
        const validPositions = ['top', 'jungle', 'mid', 'adc', 'support'];

        if (!validPositions.includes(position.toLowerCase())) {
            return res.status(400).json({ message: "Invalid position. Valid positions are: top, jungle, mid, adc, support" });
        }

        const response = await axios.get("https://esports-api.lolesports.com/persisted/gw/getTeams", {
            headers: {
                "x-api-key": API_KEY
            },
            params: {
                hl: "en-US"
            }
        });

        const allTeams = response.data.data.teams || [];

        const lecTeams = allTeams.filter(team =>
            team.homeLeague && team.homeLeague.name === "LEC"
        );

        // Filtrar jugadores por posición
        const positionPlayers = [];
        lecTeams.forEach(team => {
            const teamPlayers = team.players || [];
            teamPlayers.forEach(player => {
                if (player.role && player.role.toLowerCase() === position.toLowerCase()) {
                    positionPlayers.push({
                        ...player,
                        team: team.code,
                        teamName: team.name,
                        teamId: team.id,
                        price: Math.floor(Math.random() * 5) + 5 // Precios entre 5 y 10 millones
                    });
                }
            });
        });

        if (!positionPlayers.length) {
            return res.status(404).json({ message: `No players found for position: ${position}` });
        }

        res.json(positionPlayers);
    } catch (error) {
        console.error("Error fetching players by position from LoLEsports API:", error.response?.data || error);
        res.status(500).json({ message: "Failed to fetch players by position" });
    }
});

// POST /api/players/buy - Comprar un jugador para la liga seleccionada (requiere autenticación)
router.post('/players/buy', auth, async (req, res) => {
    try {
        const { playerId, leagueId, position } = req.body;

        if (!playerId || !leagueId) {
            return res.status(400).json({ message: "Player ID and League ID are required" });
        }

        // Verificar que la liga existe y el usuario es participante
        const league = await MyLeagues.findById(leagueId);
        if (!league) {
            return res.status(404).json({ message: "League not found" });
        }

        // Verificar que el usuario es participante de la liga
        const isParticipant = league.participants.some(p =>
            p.user.toString() === req.user.id
        );

        if (!isParticipant) {
            return res.status(403).json({ message: "You are not a participant in this league" });
        }

        // Verificar si el jugador ya está comprado por CUALQUIER usuario en esta liga
        const existingPurchase = await UserPlayer.findOne({
            playerId: playerId,
            leagueId: leagueId
        });

        if (existingPurchase) {
            if (existingPurchase.userId.toString() === req.user.id) {
                return res.status(400).json({ message: "You already own this player in this league" });
            } else {
                // Obtener el nombre del usuario dueño para un mensaje más informativo
                const ownerUser = await User.findById(existingPurchase.userId);
                const ownerName = ownerUser ? ownerUser.username : "another user";
                return res.status(400).json({
                    message: `This player is already owned by ${ownerName} in this league`
                });
            }
        }

        // Obtener información del jugador para validar
        const playerInfo = await getPlayerInfo(playerId);
        if (!playerInfo) {
            return res.status(404).json({ message: "Player not found" });
        }

        // IMPORTANTE: Priorizar la posición enviada desde el frontend
        // Esta es la clave para corregir el problema
        const playerPosition = position || playerInfo.role?.toLowerCase();

        // Verificar fondos disponibles
        const userLeague = await UserLeague.findOne({
            userId: req.user.id,
            leagueId: leagueId
        });

        if (!userLeague) {
            return res.status(404).json({ message: "User league data not found" });
        }

        if (userLeague.money < playerInfo.price) {
            return res.status(400).json({
                message: `Insufficient funds. You have ${userLeague.money}M€ but the player costs ${playerInfo.price}M€`
            });
        }

        // Verificar regla de máximo 2 jugadores por equipo
        const teamPlayers = await UserPlayer.find({
            userId: req.user.id,
            leagueId: leagueId
        });

        // Verificar límite total de 10 jugadores
        if (teamPlayers.length >= 10) {
            return res.status(400).json({
                message: "You already have 10 players. Sell a player before buying a new one."
            });
        }

        // Obtener datos de todos los jugadores del usuario
        const allTeamPlayersInfo = await Promise.all(
            teamPlayers.map(async (player) => {
                return await getPlayerInfo(player.playerId);
            })
        );

        // Filtrar null values y contar jugadores del mismo equipo
        const validTeamPlayers = allTeamPlayersInfo.filter(p => p !== null);
        const sameTeamPlayers = validTeamPlayers.filter(p => p.team === playerInfo.team);

        if (sameTeamPlayers.length >= 2) {
            return res.status(400).json({
                message: `You already have 2 players from ${playerInfo.teamName || playerInfo.team}. Maximum reached.`
            });
        }

        // Contar jugadores por posición - USAR LA POSICIÓN CORRECTA PARA LA VALIDACIÓN
        // Aquí deberíamos usar playerPosition en lugar de playerInfo.role para ser consistentes
        const positionPlayers = validTeamPlayers.filter(p =>
            p.role?.toLowerCase() === playerPosition?.toLowerCase()
        );

        if (positionPlayers.length >= 2) {
            return res.status(400).json({
                message: `You already have 2 players for the ${playerPosition} position. Maximum reached.`
            });
        }

        // Todo está bien, crear la compra
        const newUserPlayer = new UserPlayer({
            playerId: playerId,
            userId: req.user.id,
            leagueId: leagueId,
            position: playerPosition // Guardar la posición correcta
        });

        await newUserPlayer.save();

        // Restar el dinero del usuario
        userLeague.money -= playerInfo.price;
        await userLeague.save();

        // Registrar la transacción en un bloque try/catch separado para que no interrumpa el flujo principal
        try {
            const newTransaction = new Transaction({
                type: 'purchase',
                leagueId: leagueId,
                playerId: playerId,
                playerName: playerInfo.summonerName || playerInfo.name || 'Jugador desconocido',
                playerTeam: playerInfo.team || '',
                playerPosition: playerPosition || playerInfo.role || '',
                price: playerInfo.price,
                userId: req.user.id
            });

            await newTransaction.save();
            console.log("Purchase transaction registered:", newTransaction._id);
        } catch (transactionError) {
            // Solo registramos el error pero no interrumpimos el flujo principal
            console.error("Error registering purchase transaction:", transactionError);
        }

        // Modificar playerInfo para devolver la posición correcta
        const finalPlayerInfo = {
            ...playerInfo,
            role: playerPosition // Asegurar que el objeto devuelto tenga la posición correcta
        };

        // Una sola respuesta al final
        return res.status(201).json({
            message: "Player purchased successfully",
            player: finalPlayerInfo,
            remainingMoney: userLeague.money
        });

    } catch (error) {
        console.error("Error buying player:", error);
        return res.status(500).json({ message: "Failed to buy player" });
    }
});

// GET /api/players/user/:leagueId - Obtener jugadores del usuario en una liga específica
router.get('/players/user/:leagueId', auth, async (req, res) => {
    try {
        const { leagueId } = req.params;

        // Verificar que la liga existe
        const league = await MyLeagues.findById(leagueId);
        if (!league) {
            return res.status(404).json({ message: "League not found" });
        }

        // Verificar que el usuario es participante de la liga
        const isParticipant = league.participants.some(p =>
            p.user.toString() === req.user.id
        );

        if (!isParticipant) {
            return res.status(403).json({ message: "You are not a participant in this league" });
        }

        // Obtener jugadores comprados por el usuario en esta liga
        const userPlayers = await UserPlayer.find({
            userId: req.user.id,
            leagueId: leagueId
        });

        if (!userPlayers.length) {
            return res.json([]);
        }

        // Obtener información detallada de cada jugador
        const playerDetails = await Promise.all(
            userPlayers.map(async (userPlayer) => {
                const playerInfo = await getPlayerInfo(userPlayer.playerId);

                if (playerInfo) {
                    // IMPORTANTE: Siempre usar la posición almacenada en la base de datos
                    return {
                        ...playerInfo,
                        role: userPlayer.position || playerInfo.role,  // Priorizar la posición almacenada
                        purchaseDate: userPlayer.purchaseDate
                    };
                }
                return null;
            })
        );

        // Filtrar null values (jugadores que ya no existen)
        const validPlayers = playerDetails.filter(p => p !== null);

        res.json(validPlayers);
    } catch (error) {
        console.error("Error fetching user's players:", error);
        res.status(500).json({ message: "Failed to fetch your players" });
    }
});

// Establecer jugador como titular
router.post('/players/lineup', auth, async (req, res) => {
    try {
        const { playerId, leagueId, position, matchday = 1 } = req.body;

        // Normalizar la posición recibida (convertir 'adc' a 'bottom' si es necesario)
        let normalizedPosition = normalizePosition(position);

        if (!normalizedPosition) {
            return res.status(400).json({ message: "Position is required" });
        }

        // Permitir explícitamente tanto 'adc' como 'bottom'
        const validPositions = ['top', 'jungle', 'mid', 'bottom', 'adc', 'support'];
        if (!validPositions.includes(position.toLowerCase())) {
            console.error(`Invalid position: ${position}`);
            return res.status(400).json({ message: `Position must be one of: ${validPositions.join(', ')}` });
        }

        // Verificar que el usuario posee este jugador
        const userOwnsPlayer = await UserPlayer.findOne({
            playerId,
            userId: req.user.id,
            leagueId
        });

        if (!userOwnsPlayer) {
            console.error(`User doesn't own player: ${playerId}`);
            return res.status(400).json({ message: "You don't own this player" });
        }

        // Obtener información del jugador para verificar posición
        const playerInfo = await getPlayerInfo(playerId);
        if (!playerInfo) {
            console.error(`Player info not found for: ${playerId}`);
            return res.status(404).json({ message: "Player info not found" });
        }

        // Verificar que la posición coincide con la del jugador
        if (!arePositionsEquivalent(playerInfo.role, position)) {
            console.error(`Position mismatch: ${playerInfo.role} vs ${position}`);
            return res.status(400).json({
                message: `This player is a ${playerInfo.role}, not a ${position}`
            });
        }

        // Buscar si ya hay un titular para esa posición
        const searchPosition = position.toLowerCase() === 'adc' ? 'bottom' : position.toLowerCase();
        const existingLineup = await LineupPlayer.findOne({
            userId: req.user.id,
            leagueId,
            position: searchPosition,
            matchday: matchday || 1
        });

        if (existingLineup) {
            // Actualizar el jugador titular
            existingLineup.playerId = playerId;
            await existingLineup.save();
        } else {
            // Crear nuevo jugador titular - usar la posición original para evitar problemas
            const newLineup = new LineupPlayer({
                userId: req.user.id,
                leagueId,
                playerId,
                position: position.toLowerCase(),
                matchday: matchday || 1
            });
            await newLineup.save();
        }

        res.status(200).json({
            message: "Player set as starter successfully"
        });
    } catch (error) {
        console.error("Error setting player as starter:", error);
        res.status(500).json({
            message: "Failed to set player as starter",
            error: error.message,
            stack: error.stack
        });
    }
});

// Obtener alineación actual
router.get('/players/lineup/:leagueId/:matchday?', auth, async (req, res) => {
    try {
        const { leagueId, matchday = 1 } = req.params;

        const lineup = await LineupPlayer.find({
            userId: req.user.id,
            leagueId,
            matchday: parseInt(matchday)
        });

        // Obtener información detallada de los jugadores de la alineación
        const lineupDetails = await Promise.all(
            lineup.map(async (lineupPlayer) => {
                const playerInfo = await getPlayerInfo(lineupPlayer.playerId);
                return {
                    ...playerInfo,
                    position: lineupPlayer.position
                };
            })
        );

        res.json(lineupDetails);
    } catch (error) {
        console.error("Error fetching lineup:", error);
        res.status(500).json({ message: "Failed to fetch lineup" });
    }
});

// Vender jugador al mercado
router.post('/players/sell/market', auth, async (req, res) => {
    try {
        const { playerId, leagueId } = req.body;

        // Verify user owns this player
        const userPlayer = await UserPlayer.findOne({
            playerId,
            userId: req.user.id,
            leagueId
        });

        if (!userPlayer) {
            return res.status(400).json({ message: "You don't own this player" });
        }

        // Get player info to calculate sell price
        const playerInfo = await getPlayerInfo(playerId);
        if (!playerInfo) {
            return res.status(404).json({ message: "Player info not found" });
        }

        // Calculate sell price (2/3 of original)
        const sellPrice = Math.round(playerInfo.price * 2 / 3);

        // First, cancel any pending offers for this player
        const pendingOffers = await PlayerOffer.find({
            playerId,
            leagueId,
            sellerUserId: req.user.id,
            status: 'pending'
        });

        // Mark all pending offers as cancelled
        if (pendingOffers.length > 0) {
            await PlayerOffer.updateMany(
                {
                    playerId,
                    leagueId,
                    sellerUserId: req.user.id,
                    status: 'pending'
                },
                { status: 'cancelled' }
            );

            console.log(`Cancelled ${pendingOffers.length} pending offers for player ${playerId}`);
        }

        // Remove player from user's collection
        await UserPlayer.deleteOne({
            playerId,
            userId: req.user.id,
            leagueId
        });

        // Remove from lineup if they were a starter
        await LineupPlayer.deleteOne({
            playerId,
            userId: req.user.id,
            leagueId
        });

        // Add money to user
        const userLeague = await UserLeague.findOne({
            userId: req.user.id,
            leagueId
        });

        if (!userLeague) {
            return res.status(404).json({ message: "User league data not found" });
        }

        userLeague.money += sellPrice;
        await userLeague.save();

        // Registrar la transacción
        try {
            const sellTransaction = new Transaction({
                type: 'sale',
                leagueId: leagueId,
                playerId: playerId,
                playerName: playerInfo.summonerName || playerInfo.name || 'Jugador desconocido',
                playerTeam: playerInfo.team || '',
                playerPosition: playerInfo.role || '',
                price: sellPrice,
                userId: req.user.id
            });

            await sellTransaction.save();
            console.log("Transaction registered successfully:", sellTransaction._id);
        } catch (transactionError) {
            // Solo registramos el error, pero no interferimos con la respuesta principal
            console.error("Error registering transaction:", transactionError);
            // No respondemos aquí, solo continuamos con la operación principal
        }

        // Una sola respuesta al final
        return res.status(200).json({
            message: "Player sold successfully",
            sellPrice,
            newBalance: userLeague.money,
            cancelledOffers: pendingOffers.length
        });
    } catch (error) {
        console.error("Error selling player:", error);
        return res.status(500).json({ message: "Failed to sell player", error: error.message });
    }
});

// Crear oferta para otro usuario
router.post('/players/sell/offer', auth, async (req, res) => {
    try {
        const { playerId, leagueId, targetUserId, price } = req.body;

        // Verificar que el usuario posee este jugador
        const userPlayer = await UserPlayer.findOne({
            playerId,
            userId: req.user.id,
            leagueId
        });

        if (!userPlayer) {
            return res.status(400).json({ message: "You don't own this player" });
        }

        // Verificar que el usuario destino existe y está en la liga
        const targetParticipant = await MyLeagues.findOne({
            _id: leagueId,
            'participants.user': targetUserId
        });

        if (!targetParticipant) {
            return res.status(400).json({ message: "Target user is not in this league" });
        }

        // Crear nueva oferta
        const newOffer = new PlayerOffer({
            playerId,
            leagueId,
            sellerUserId: req.user.id,
            buyerUserId: targetUserId,
            price,
            status: 'pending'
        });

        await newOffer.save();

        res.status(201).json({
            message: "Offer created successfully",
            offerId: newOffer._id
        });
    } catch (error) {
        console.error("Error creating offer:", error);
        res.status(500).json({ message: "Failed to create offer" });
    }
});

// Aceptar oferta
router.post('/players/offer/accept/:offerId', auth, async (req, res) => {
    try {
        const { offerId } = req.params;

        // Encuentra la oferta
        const offer = await PlayerOffer.findById(offerId);

        if (!offer) {
            return res.status(404).json({ message: "Offer not found" });
        }

        // Verificar que el usuario es el comprador
        if (offer.buyerUserId.toString() !== req.user.id) {
            return res.status(403).json({ message: "You are not the buyer of this offer" });
        }

        // Verificar que el comprador tiene fondos suficientes
        const buyerLeague = await UserLeague.findOne({
            userId: req.user.id,
            leagueId: offer.leagueId
        });

        if (!buyerLeague || buyerLeague.money < offer.price) {
            return res.status(400).json({ message: "Insufficient funds" });
        }

        // Verificar que el vendedor aún posee el jugador
        const sellerPlayer = await UserPlayer.findOne({
            playerId: offer.playerId,
            userId: offer.sellerUserId,
            leagueId: offer.leagueId
        });

        if (!sellerPlayer) {
            return res.status(400).json({ message: "Seller no longer owns this player" });
        }

        // Obtener la información del jugador antes de la transferencia
        const playerInfo = await getPlayerInfo(offer.playerId);

        // Transferir el jugador
        // 1. Eliminar del vendedor
        await UserPlayer.deleteOne({
            playerId: offer.playerId,
            userId: offer.sellerUserId,
            leagueId: offer.leagueId
        });

        // 2. Asignar al comprador
        const newUserPlayer = new UserPlayer({
            playerId: offer.playerId,
            userId: req.user.id,
            leagueId: offer.leagueId,
            position: sellerPlayer.position // Mantener la posición actual
        });

        await newUserPlayer.save();

        // 3. Transferir el dinero
        // Restar al comprador
        buyerLeague.money -= offer.price;
        await buyerLeague.save();

        // Añadir al vendedor
        const sellerLeague = await UserLeague.findOne({
            userId: offer.sellerUserId,
            leagueId: offer.leagueId
        });

        if (sellerLeague) {
            sellerLeague.money += offer.price;
            await sellerLeague.save();
        }

        // Marcar oferta como completada
        offer.status = 'completed';
        await offer.save();

        // IMPORTANTE: Registrar la transacción como intercambio entre usuarios
        try {
            const Transaction = mongoose.model('Transaction');

            // Crear la transacción con todos los datos necesarios
            const tradeTransaction = new Transaction({
                type: 'trade',
                leagueId: offer.leagueId,
                playerId: offer.playerId,
                playerName: playerInfo?.summonerName || playerInfo?.name || 'Jugador desconocido',
                playerTeam: playerInfo?.team || '',
                playerPosition: playerInfo?.role || sellerPlayer.position || '',
                price: offer.price,
                sellerUserId: offer.sellerUserId,
                buyerUserId: offer.buyerUserId,
                offerId: offer._id,
                createdAt: new Date()
            });

            await tradeTransaction.save();
            console.log("Trade transaction registered:", tradeTransaction._id);
        } catch (transactionError) {
            // Solo logueamos el error pero no interrumpimos el flujo principal
            console.error("Error registering trade transaction:", transactionError);
        }

        // Responder con éxito
        return res.status(200).json({
            message: "Transfer completed successfully",
            player: playerInfo || { id: offer.playerId }
        });
    } catch (error) {
        console.error("Error accepting offer:", error);
        return res.status(500).json({ message: "Failed to accept offer" });
    }
});

// GET /api/user-league/:leagueId - Get user's data for a specific league
router.get('/user-league/:leagueId', auth, async (req, res) => {
    try {
        const { leagueId } = req.params;

        // Verify the league exists
        const league = await MyLeagues.findById(leagueId);
        if (!league) {
            return res.status(404).json({ message: "League not found" });
        }

        // Verify user is part of the league
        const isParticipant = league.participants.some(p =>
            p.user.toString() === req.user.id
        );

        if (!isParticipant) {
            return res.status(403).json({ message: "You are not a participant in this league" });
        }

        // Get user's financial data for this league
        const userLeague = await UserLeague.findOne({
            userId: req.user.id,
            leagueId
        });

        if (!userLeague) {
            // Si no existe el registro (no debería ocurrir), crear uno con el valor por defecto

            const newUserLeague = new UserLeague({
                userId: req.user.id,
                leagueId,
                money: 75 // Default initial money - explícitamente establecido
            });

            await newUserLeague.save();

            return res.json(newUserLeague);
        }

        // Solución de emergencia - si existe el registro pero el dinero es 0, actualizarlo a 75
        if (userLeague.money === 0) {
            userLeague.money = 75;
            await userLeague.save();
        }

        res.json(userLeague);
    } catch (error) {
        console.error("Error fetching user league data:", error);
        res.status(500).json({ message: "Failed to fetch user league data" });
    }
});

// GET /api/league-users/:leagueId - Get all users in a league
router.get('/league-users/:leagueId', auth, async (req, res) => {
    try {
        const { leagueId } = req.params;

        // Verify the league exists
        const league = await MyLeagues.findById(leagueId);
        if (!league) {
            return res.status(404).json({ message: "League not found" });
        }

        // Verify user is part of the league
        const isParticipant = league.participants.some(p =>
            p.user.toString() === req.user.id
        );

        if (!isParticipant) {
            return res.status(403).json({ message: "You are not a participant in this league" });
        }

        // Get all users in the league (excluding the requesting user)
        const userIds = league.participants
            .filter(p => p.user.toString() !== req.user.id)
            .map(p => p.user);

        console.log("User IDs in league:", userIds);

        const users = await User.find({ _id: { $in: userIds } })
            .select('_id username name');

        console.log("Users found:", users.map(u => ({ id: u._id, username: u.username })));

        // Make sure we're returning the MongoDB _id as 'id' in the response
        const formattedUsers = users.map(user => ({
            id: user._id.toString(), // Explicitly convert ObjectId to string
            username: user.username,
            name: user.name
        }));

        res.json(formattedUsers);
    } catch (error) {
        console.error("Error fetching league users:", error);
        res.status(500).json({ message: "Failed to fetch league users", error: error.message });
    }
});

// Get current lineup
router.get('/players/lineup/:leagueId/:matchday?', auth, async (req, res) => {
    try {
        const { leagueId, matchday = 1 } = req.params;

        const lineup = await LineupPlayer.find({
            userId: req.user.id,
            leagueId,
            matchday: parseInt(matchday)
        });

        // Get detailed info for lineup players
        const lineupDetails = await Promise.all(
            lineup.map(async (lineupPlayer) => {
                const playerInfo = await getPlayerInfo(lineupPlayer.playerId);
                return {
                    ...playerInfo,
                    position: lineupPlayer.position
                };
            })
        );

        res.json(lineupDetails);
    } catch (error) {
        console.error("Error fetching lineup:", error);
        res.status(500).json({ message: "Failed to fetch lineup" });
    }
});

// Create offer to another user
router.post('/players/sell/offer', auth, async (req, res) => {
    try {
        const { playerId, leagueId, targetUserId, price } = req.body;

        // Log the received data
        console.log("Received offer data:", {
            playerId,
            leagueId,
            targetUserId,
            price
        });

        // Verify that the targetUserId is a valid MongoDB ObjectId
        if (!mongoose.Types.ObjectId.isValid(targetUserId)) {
            return res.status(400).json({
                message: "Invalid target user ID format",
                receivedId: targetUserId
            });
        }

        // Verify that the user owns this player
        const userPlayer = await UserPlayer.findOne({
            playerId,
            userId: req.user.id,
            leagueId
        });

        if (!userPlayer) {
            return res.status(400).json({ message: "You don't own this player" });
        }

        // Verify that the target user exists and is in the league
        // First, verify the user exists
        const targetUser = await User.findById(targetUserId);
        if (!targetUser) {
            return res.status(404).json({ message: "Target user not found" });
        }

        // Then, verify they're part of the league
        const targetParticipant = await MyLeagues.findOne({
            _id: leagueId,
            'participants.user': targetUserId
        });

        if (!targetParticipant) {
            return res.status(400).json({ message: "Target user is not in this league" });
        }

        // Create new offer
        const newOffer = new PlayerOffer({
            playerId,
            leagueId,
            sellerUserId: req.user.id,
            buyerUserId: targetUserId,
            price: Number(price), // Ensure price is a number
            status: 'pending'
        });

        await newOffer.save();
        console.log("Offer created successfully:", newOffer);

        res.status(201).json({
            message: "Offer created successfully",
            offerId: newOffer._id
        });
    } catch (error) {
        console.error("Error creating offer:", error);
        res.status(500).json({
            message: "Failed to create offer",
            error: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

// GET /api/players/offers/:leagueId - Get pending offers for user in a league
router.get('/players/offers/:leagueId', auth, async (req, res) => {
    try {
        const { leagueId } = req.params;

        // Get offers where user is the buyer
        const incomingOffers = await PlayerOffer.find({
            leagueId,
            buyerUserId: req.user.id,
            status: 'pending'
        }).populate('sellerUserId', 'username name');

        // Get offers where user is the seller
        const outgoingOffers = await PlayerOffer.find({
            leagueId,
            sellerUserId: req.user.id,
            status: 'pending'
        }).populate('buyerUserId', 'username name');

        // Get detailed info for each player in the offers
        const processedIncomingOffers = await Promise.all(
            incomingOffers.map(async (offer) => {
                const playerInfo = await getPlayerInfo(offer.playerId);
                return {
                    ...offer.toObject(),
                    player: playerInfo
                };
            })
        );

        const processedOutgoingOffers = await Promise.all(
            outgoingOffers.map(async (offer) => {
                const playerInfo = await getPlayerInfo(offer.playerId);
                return {
                    ...offer.toObject(),
                    player: playerInfo
                };
            })
        );

        res.json({
            incoming: processedIncomingOffers,
            outgoing: processedOutgoingOffers
        });
    } catch (error) {
        console.error("Error fetching offers:", error);
        res.status(500).json({ message: "Failed to fetch offers" });
    }
});

// Reject offer
router.post('/players/offer/reject/:offerId', auth, async (req, res) => {
    try {
        const { offerId } = req.params;

        // Find the offer
        const offer = await PlayerOffer.findById(offerId);

        if (!offer) {
            return res.status(404).json({ message: "Offer not found" });
        }

        // Verify user is the buyer or seller
        if (offer.buyerUserId.toString() !== req.user.id && offer.sellerUserId.toString() !== req.user.id) {
            return res.status(403).json({ message: "You are not part of this offer" });
        }

        // Mark offer as rejected
        offer.status = 'rejected';
        await offer.save();

        res.status(200).json({
            message: "Offer rejected successfully"
        });
    } catch (error) {
        console.error("Error rejecting offer:", error);
        res.status(500).json({ message: "Failed to reject offer" });
    }
});

// Get current lineup
router.get('/players/lineup/:leagueId/:matchday?', auth, async (req, res) => {
    try {
        const { leagueId, matchday = 1 } = req.params;

        const lineup = await LineupPlayer.find({
            userId: req.user.id,
            leagueId,
            matchday: parseInt(matchday)
        });

        // Get detailed info for lineup players
        const lineupDetails = await Promise.all(
            lineup.map(async (lineupPlayer) => {
                const playerInfo = await getPlayerInfo(lineupPlayer.playerId);
                return {
                    ...playerInfo,
                    position: lineupPlayer.position
                };
            })
        );

        res.json(lineupDetails);
    } catch (error) {
        console.error("Error fetching lineup:", error);
        res.status(500).json({ message: "Failed to fetch lineup" });
    }
});

// Create offer to another user
router.post('/players/sell/offer', auth, async (req, res) => {
    try {
        const { playerId, leagueId, targetUserId, price } = req.body;

        // Verify user owns this player
        const userPlayer = await UserPlayer.findOne({
            playerId,
            userId: req.user.id,
            leagueId
        });

        if (!userPlayer) {
            return res.status(400).json({ message: "You don't own this player" });
        }

        // Verify target user exists and is in the league
        const targetParticipant = await MyLeagues.findOne({
            _id: leagueId,
            'participants.user': targetUserId
        });

        if (!targetParticipant) {
            return res.status(400).json({ message: "Target user is not in this league" });
        }

        // Create new offer
        const newOffer = new PlayerOffer({
            playerId,
            leagueId,
            sellerUserId: req.user.id,
            buyerUserId: targetUserId,
            price,
            status: 'pending'
        });

        await newOffer.save();

        res.status(201).json({
            message: "Offer created successfully",
            offerId: newOffer._id
        });
    } catch (error) {
        console.error("Error creating offer:", error);
        res.status(500).json({ message: "Failed to create offer" });
    }
});

// GET /api/players/offers/:leagueId - Get pending offers for user in a league
router.get('/players/offers/:leagueId', auth, async (req, res) => {
    try {
        const { leagueId } = req.params;

        // Get offers where user is the buyer
        const incomingOffers = await PlayerOffer.find({
            leagueId,
            buyerUserId: req.user.id,
            status: 'pending'
        }).populate('sellerUserId', 'username name');

        // Get offers where user is the seller
        const outgoingOffers = await PlayerOffer.find({
            leagueId,
            sellerUserId: req.user.id,
            status: 'pending'
        }).populate('buyerUserId', 'username name');

        // Get detailed info for each player in the offers
        const processedIncomingOffers = await Promise.all(
            incomingOffers.map(async (offer) => {
                const playerInfo = await getPlayerInfo(offer.playerId);
                return {
                    ...offer.toObject(),
                    player: playerInfo
                };
            })
        );

        const processedOutgoingOffers = await Promise.all(
            outgoingOffers.map(async (offer) => {
                const playerInfo = await getPlayerInfo(offer.playerId);
                return {
                    ...offer.toObject(),
                    player: playerInfo
                };
            })
        );

        res.json({
            incoming: processedIncomingOffers,
            outgoing: processedOutgoingOffers
        });
    } catch (error) {
        console.error("Error fetching offers:", error);
        res.status(500).json({ message: "Failed to fetch offers" });
    }
});

// Reject offer
router.post('/players/offer/reject/:offerId', auth, async (req, res) => {
    try {
        const { offerId } = req.params;

        // Find the offer
        const offer = await PlayerOffer.findById(offerId);

        if (!offer) {
            return res.status(404).json({ message: "Offer not found" });
        }

        // Verify user is the buyer or seller
        if (offer.buyerUserId.toString() !== req.user.id && offer.sellerUserId.toString() !== req.user.id) {
            return res.status(403).json({ message: "You are not part of this offer" });
        }

        // Mark offer as rejected
        offer.status = 'rejected';
        await offer.save();

        res.status(200).json({
            message: "Offer rejected successfully"
        });
    } catch (error) {
        console.error("Error rejecting offer:", error);
        res.status(500).json({ message: "Failed to reject offer" });
    }
});

// GET /api/players/owners/:leagueId - Obtener todos los propietarios de jugadores en una liga
router.get('/players/owners/:leagueId', auth, async (req, res) => {
    try {
        const { leagueId } = req.params;

        // Verificar que la liga existe
        const league = await MyLeagues.findById(leagueId);
        if (!league) {
            return res.status(404).json({ message: "League not found" });
        }

        // Verificar que el usuario es participante de la liga
        const isParticipant = league.participants.some(p =>
            p.user.toString() === req.user.id
        );

        if (!isParticipant) {
            return res.status(403).json({ message: "You are not a participant in this league" });
        }

        // Obtener todos los jugadores y sus propietarios
        const userPlayers = await UserPlayer.find({ leagueId }).lean();

        // Si no hay jugadores adquiridos, devolver array vacío
        if (!userPlayers.length) {
            return res.json([]);
        }

        // Obtener información de los usuarios para incluir nombres
        const userIds = [...new Set(userPlayers.map(p => p.userId.toString()))];
        const users = await User.find({ _id: { $in: userIds } }).lean();

        // Crear un mapa de userId -> username para búsqueda rápida
        const userMap = {};
        users.forEach(user => {
            userMap[user._id.toString()] = user.username;
        });

        // Incluir el nombre del propietario en cada registro
        const result = userPlayers.map(player => ({
            ...player,
            ownerUsername: userMap[player.userId.toString()] || 'Unknown User'
        }));

        res.json(result);
    } catch (error) {
        console.error("Error fetching player owners:", error);
        res.status(500).json({ message: "Failed to fetch player owners" });
    }
});



module.exports = router;