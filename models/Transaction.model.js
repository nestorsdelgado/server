const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
    type: {
        type: String,
        enum: ['purchase', 'sale', 'trade'],
        required: true
    },
    leagueId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'MyLeagues',
        required: true
    },
    playerId: {
        type: String,
        required: true
    },
    playerName: {
        type: String,
        required: true
    },
    playerTeam: {
        type: String,
        required: false
    },
    playerPosition: {
        type: String,
        required: false
    },
    price: {
        type: Number,
        required: true,
        min: 0
    },
    // Para compras o ventas al mercado
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: function () {
            return this.type === 'purchase' || this.type === 'sale';
        }
    },
    // Para intercambios entre usuarios
    sellerUserId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: function () {
            return this.type === 'trade';
        }
    },
    buyerUserId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: function () {
            return this.type === 'trade';
        }
    },
    // Referencia opcional a la oferta que generó esta transacción
    offerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'PlayerOffer',
        required: false
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Transaction', transactionSchema);