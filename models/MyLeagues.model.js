const mongoose = require('mongoose');

const myLeaguesSchema = new mongoose.Schema({
    Nombre: {
        type: String,
        required: true,
        trim: true
    },
    Code: {
        type: String,
        unique: true,
        default: () => {
            // Generate a shorter, more user-friendly code
            return Math.random().toString(36).substring(2, 8).toUpperCase();
        }
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    participants: [{
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        joinedAt: {
            type: Date,
            default: Date.now
        }
    }],
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Add creator as participant automatically
myLeaguesSchema.pre('save', function (next) {
    if (this.isNew) {
        const creatorExists = this.participants.some(p =>
            p.user.toString() === this.createdBy.toString()
        );

        if (!creatorExists) {
            this.participants.push({ user: this.createdBy });
        }
    }
    next();
});

module.exports = mongoose.model('MyLeagues', myLeaguesSchema);