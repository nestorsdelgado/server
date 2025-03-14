const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Transaction = require('../models/Transaction.model');
const auth = require('../middleware/auth');

// GET /api/transactions/:leagueId - Obtener todas las transacciones de una liga
router.get('/transactions/:leagueId', auth, async (req, res) => {
    try {
        const { leagueId } = req.params;

        // Validar que el ID de la liga sea un ObjectId válido
        if (!mongoose.Types.ObjectId.isValid(leagueId)) {
            return res.status(400).json({ message: "ID de liga inválido" });
        }

        // Buscar transacciones para esta liga
        const transactions = await Transaction.find({ leagueId })
            .populate('userId', 'username')
            .populate('sellerUserId', 'username')
            .populate('buyerUserId', 'username')
            .sort({ createdAt: -1 }); // Ordenar por fecha, más reciente primero

        // Si no hay transacciones registradas, buscar ofertas completadas/aceptadas 
        // para crear registros de transacciones
        if (transactions.length === 0) {
            console.log("No hay transacciones, sincronizando desde ofertas completadas...");
            await syncTransactionsFromOffers(leagueId);

            // Buscar de nuevo después de la sincronización
            const freshTransactions = await Transaction.find({ leagueId })
                .populate('userId', 'username')
                .populate('sellerUserId', 'username')
                .populate('buyerUserId', 'username')
                .sort({ createdAt: -1 });

            return res.json(freshTransactions);
        }

        res.json(transactions);
    } catch (error) {
        console.error("Error obteniendo transacciones:", error);
        res.status(500).json({ message: "Error del servidor al obtener transacciones" });
    }
});

// Función para obtener información básica de un jugador de la API
async function getPlayerInfo(playerId) {
    try {
        // Esta implementación dependerá de cómo tengas configurado el acceso a la API
        // Puedes reutilizar la función del mismo nombre de players.routes.js
        // o implementar una versión simplificada aquí

        // Ejemplo simple para este caso:
        const API_KEY = process.env.LOLESPORTS_API_KEY;
        const axios = require('axios');

        // Intentar obtener el jugador de la API de LoL Esports
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

        // Buscar el jugador en los equipos
        for (const team of lecTeams) {
            const player = (team.players || []).find(p => p.id === playerId);
            if (player) {
                return {
                    ...player,
                    team: team.code,
                    teamName: team.name
                };
            }
        }

        return null;
    } catch (error) {
        console.error(`Error obteniendo info del jugador ${playerId}:`, error);
        return null;
    }
}

// Función para sincronizar transacciones desde ofertas completadas
const syncTransactionsFromOffers = async (leagueId) => {
    try {
        const UserPlayer = require('../models/userPlayer.model');
        // Importamos aquí para evitar problemas de importación circular
        const PlayerOffer = require('../models/PlayerOffer.model');

        // Buscar ofertas completadas/aceptadas que no tengan una transacción asociada
        const completedOffers = await PlayerOffer.find({
            leagueId,
            status: { $in: ['completed', 'accepted'] }
        }).populate('playerId').populate('sellerUserId').populate('buyerUserId');

        if (!completedOffers.length) {
            console.log("No hay ofertas completadas para sincronizar");
            return;
        }

        console.log(`Encontradas ${completedOffers.length} ofertas para sincronizar`);

        // Buscar las compras recientes (últimos 7 días)
        const recentDate = new Date();
        recentDate.setDate(recentDate.getDate() - 7);

        const recentPurchases = await UserPlayer.find({
            leagueId,
            purchaseDate: { $gte: recentDate }
        });

        // Verificar transacciones existentes para evitar duplicados (ambos tipos)
        // 1. Transacciones de compra existentes
        const purchasePlayerIds = recentPurchases.map(p => p.playerId);
        const existingPurchaseTransactions = await Transaction.find({
            leagueId,
            playerId: { $in: purchasePlayerIds },
            type: 'purchase'
        });

        const existingPurchaseTransactionsByPlayerId = {};
        existingPurchaseTransactions.forEach(t => {
            existingPurchaseTransactionsByPlayerId[t.playerId] = true;
        });

        // 2. Transacciones de ofertas existentes
        const existingOfferTransactions = await Transaction.find({
            leagueId,
            offerId: { $in: completedOffers.map(o => o._id) }
        });

        const existingOfferTransactionsByOfferId = {};
        existingOfferTransactions.forEach(t => {
            existingOfferTransactionsByOfferId[t.offerId.toString()] = true;
        });

        // Crear transacciones para compras recientes sin registro
        const purchaseTransactionsToCreate = [];

        for (const purchase of recentPurchases) {
            if (existingPurchaseTransactionsByPlayerId[purchase.playerId]) {
                continue; // Ya existe transacción para esta compra
            }

            // Obtener información del jugador
            const playerInfo = await getPlayerInfo(purchase.playerId);

            if (playerInfo) {
                purchaseTransactionsToCreate.push({
                    type: 'purchase',
                    leagueId: purchase.leagueId,
                    playerId: purchase.playerId,
                    playerName: playerInfo.summonerName || playerInfo.name || 'Jugador desconocido',
                    playerTeam: playerInfo.team || '',
                    playerPosition: purchase.position || playerInfo.role || '',
                    price: playerInfo.price || 0, // Este valor es estimado
                    userId: purchase.userId,
                    createdAt: purchase.purchaseDate
                });
            }
        }

        // Insertar transacciones de compra
        if (purchaseTransactionsToCreate.length > 0) {
            await Transaction.insertMany(purchaseTransactionsToCreate);
            console.log(`Creadas ${purchaseTransactionsToCreate.length} transacciones de compra`);
        }

        // Crear transacciones para cada oferta completada
        const offerTransactionsToCreate = [];

        for (const offer of completedOffers) {
            // Saltar si ya hay una transacción para esta oferta
            if (existingOfferTransactionsByOfferId[offer._id.toString()]) {
                continue;
            }

            // Obtener información del jugador
            let playerInfo = offer.playerId;

            // Si playerId es un string (ID) en lugar de un objeto poblado
            if (typeof offer.playerId === 'string' || offer.playerId instanceof mongoose.Types.ObjectId) {
                // Aquí podrías intentar obtener la información del jugador de otra fuente
                // Intentar obtener la info del jugador si es posible
                const playerDetails = await getPlayerInfo(
                    typeof offer.playerId === 'string' ? offer.playerId : offer.playerId.toString()
                );

                playerInfo = playerDetails || {
                    name: 'Unknown Player',
                    team: '',
                    role: ''
                };
            }

            offerTransactionsToCreate.push({
                type: 'trade',
                leagueId: offer.leagueId,
                playerId: typeof offer.playerId === 'string' ? offer.playerId : offer.playerId?.id || '',
                playerName: playerInfo?.summonerName || playerInfo?.name || 'Unknown Player',
                playerTeam: playerInfo?.team || '',
                playerPosition: playerInfo?.role || '',
                price: offer.price,
                sellerUserId: offer.sellerUserId,
                buyerUserId: offer.buyerUserId,
                offerId: offer._id,
                createdAt: offer.createdAt
            });
        }

        // Insertar nuevas transacciones de ofertas
        if (offerTransactionsToCreate.length > 0) {
            await Transaction.insertMany(offerTransactionsToCreate);
            console.log(`Creadas ${offerTransactionsToCreate.length} nuevas transacciones de intercambio`);
        }

        // Resumen total
        const totalCreated = purchaseTransactionsToCreate.length + offerTransactionsToCreate.length;
        if (totalCreated > 0) {
            console.log(`Total de transacciones creadas en sincronización: ${totalCreated}`);
        } else {
            console.log('No se crearon nuevas transacciones en la sincronización');
        }
    } catch (error) {
        console.error("Error sincronizando transacciones desde ofertas:", error);
    }
};

// POST /api/transactions - Registrar una nueva transacción (usado internamente)
router.post('/transactions', auth, async (req, res) => {
    try {
        const {
            type, leagueId, playerId, playerName, playerTeam, playerPosition,
            price, userId, sellerUserId, buyerUserId, offerId
        } = req.body;

        // Validar tipo de transacción
        if (!['purchase', 'sale', 'trade'].includes(type)) {
            return res.status(400).json({ message: "Tipo de transacción inválido" });
        }

        // Validar que el ID de la liga sea un ObjectId válido
        if (!mongoose.Types.ObjectId.isValid(leagueId)) {
            return res.status(400).json({ message: "ID de liga inválido" });
        }

        // Crear la transacción
        const newTransaction = new Transaction({
            type,
            leagueId,
            playerId,
            playerName,
            playerTeam,
            playerPosition,
            price,
            userId: type !== 'trade' ? userId : undefined,
            sellerUserId: type === 'trade' ? sellerUserId : undefined,
            buyerUserId: type === 'trade' ? buyerUserId : undefined,
            offerId
        });

        await newTransaction.save();

        res.status(201).json(newTransaction);
    } catch (error) {
        console.error("Error creando transacción:", error);
        res.status(500).json({ message: "Error del servidor al crear transacción" });
    }
});

// GET /api/transactions/count/:leagueId - Obtener conteo de transacciones por tipo
router.get('/transactions/count/:leagueId', auth, async (req, res) => {
    try {
        const { leagueId } = req.params;

        // Validar que el ID de la liga sea un ObjectId válido
        if (!mongoose.Types.ObjectId.isValid(leagueId)) {
            return res.status(400).json({ message: "ID de liga inválido" });
        }

        // Contar transacciones por tipo
        const purchaseCount = await Transaction.countDocuments({ leagueId, type: 'purchase' });
        const saleCount = await Transaction.countDocuments({ leagueId, type: 'sale' });
        const tradeCount = await Transaction.countDocuments({ leagueId, type: 'trade' });

        res.json({
            purchases: purchaseCount,
            sales: saleCount,
            trades: tradeCount,
            total: purchaseCount + saleCount + tradeCount
        });
    } catch (error) {
        console.error("Error obteniendo conteo de transacciones:", error);
        res.status(500).json({ message: "Error del servidor al obtener conteo de transacciones" });
    }
});

// Endpoint para forzar la sincronización de transacciones (útil para debugging)
router.post('/transactions/sync/:leagueId', auth, async (req, res) => {
    try {
        const { leagueId } = req.params;

        // Validar que el ID de la liga sea un ObjectId válido
        if (!mongoose.Types.ObjectId.isValid(leagueId)) {
            return res.status(400).json({ message: "ID de liga inválido" });
        }

        // Ejecutar la sincronización
        await syncTransactionsFromOffers(leagueId);

        // Obtener las transacciones actualizadas
        const transactions = await Transaction.find({ leagueId })
            .populate('userId', 'username')
            .populate('sellerUserId', 'username')
            .populate('buyerUserId', 'username')
            .sort({ createdAt: -1 });

        res.json({
            message: "Sincronización completada",
            transactionCount: transactions.length,
            transactions
        });
    } catch (error) {
        console.error("Error en sincronización forzada:", error);
        res.status(500).json({ message: "Error del servidor durante sincronización" });
    }
});

module.exports = router;