const mongoose = require('mongoose');

const playerOfferSchema = new mongoose.Schema({
    playerId: {
        type: String,
        required: true
    },
    leagueId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'MyLeagues',
        required: true
    },
    sellerUserId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    buyerUserId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    price: {
        type: Number,
        required: true,
        min: 1
    },
    status: {
        type: String,
        enum: ['pending', 'accepted', 'rejected', 'expired', 'completed'],
        default: 'pending'
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    expiresAt: {
        type: Date,
        default: function () {
            // Offers expire in 48 hours by default
            const date = new Date();
            date.setHours(date.getHours() + 48);
            return date;
        }
    }
});

module.exports = mongoose.model('PlayerOffer', playerOfferSchema);