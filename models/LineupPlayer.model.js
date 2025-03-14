const mongoose = require('mongoose');

const lineupPlayerSchema = new mongoose.Schema({
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
    playerId: {
        type: String,
        required: true
    },
    position: {
        type: String,
        enum: ['top', 'jungle', 'mid', 'bottom', 'adc', 'support'], // Permitimos ambos: 'bottom' y 'adc'
        required: true
    },
    matchday: {
        type: Number,
        default: 1
    }
});

// Middleware para normalizar la posición antes de guardar
lineupPlayerSchema.pre('save', function (next) {
    // Normalizar las posiciones para mantener coherencia
    if (this.position && this.position.toLowerCase() === 'adc') {
        this.position = 'bottom';
    }
    next();
});

// Composite index to ensure only one player per position in each matchday
lineupPlayerSchema.index({ userId: 1, leagueId: 1, position: 1, matchday: 1 }, { unique: true });

module.exports = mongoose.model('LineupPlayer', lineupPlayerSchema);