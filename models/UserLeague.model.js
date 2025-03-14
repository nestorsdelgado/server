const mongoose = require('mongoose');

const userLeagueSchema = new mongoose.Schema({
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
    money: {
        type: Number,
        default: 75, // 75 millones de euros inicialmente
        min: 0
    },
    joinedAt: {
        type: Date,
        default: Date.now
    }
});

// Composite index to ensure only one entry per user and league
userLeagueSchema.index({ userId: 1, leagueId: 1 }, { unique: true });

// Middleware pre-save para asegurar que el dinero inicial sea 75 si no está definido
userLeagueSchema.pre('save', function (next) {
    // Si es un documento nuevo y el dinero no está definido o es 0, establecerlo a 75
    if (this.isNew && (this.money === undefined || this.money === 0)) {
        this.money = 75;
    }
    next();
});

const UserLeague = mongoose.model('UserLeague', userLeagueSchema);
module.exports = UserLeague;