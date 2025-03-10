// routes/my-leagues.routes.js
const express = require('express');
const router = express.Router();
const MyLeagues = require('../models/myLeagues.model');
const auth = require('../middleware/auth');

// Get all leagues for the logged-in user (your existing route)
router.get('/my-leagues', auth, async (req, res) => {
    try {
        const leagues = await MyLeagues.find({
            'participants.user': req.user.id
        }).sort({ createdAt: -1 });

        res.json({ Ligas: leagues });
    } catch (error) {
        console.error('Error fetching leagues:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Create a new league - add this to your existing routes
router.post('/create', auth, async (req, res) => {
    try {
        const { Nombre } = req.body;

        if (!Nombre) {
            return res.status(400).json({ message: 'League name is required' });
        }

        const newLeague = new MyLeagues({
            Nombre,
            createdBy: req.user.id
        });

        await newLeague.save();

        res.status(201).json({
            message: 'League created successfully',
            league: {
                id: newLeague._id,
                Nombre: newLeague.Nombre,
                Code: newLeague.Code,
                createdAt: newLeague.createdAt
            }
        });
    } catch (error) {
        console.error('Error creating league:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Join a league using a code - add this to your existing routes
router.post('/join', auth, async (req, res) => {
    try {
        const { code } = req.body;

        if (!code) {
            return res.status(400).json({ message: 'League code is required' });
        }

        const league = await MyLeagues.findOne({ Code: code });

        if (!league) {
            return res.status(404).json({ message: 'League not found with this code' });
        }

        const isParticipant = league.participants.some(p =>
            p.user.toString() === req.user.id
        );

        if (isParticipant) {
            return res.status(400).json({ message: 'You are already a member of this league' });
        }

        league.participants.push({ user: req.user.id });
        await league.save();

        res.status(200).json({
            message: 'Successfully joined the league',
            league: {
                id: league._id,
                Nombre: league.Nombre,
                Code: league.Code,
                createdAt: league.createdAt
            }
        });
    } catch (error) {
        console.error('Error joining league:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

router.post('/leave/:leagueId', auth, async (req, res) => {
    try {
        const { leagueId } = req.params;

        // Find the league
        const league = await MyLeagues.findById(leagueId);

        if (!league) {
            return res.status(404).json({ message: 'League not found' });
        }

        // Check if user is part of this league
        const userIndex = league.participants.findIndex(p =>
            p.user.toString() === req.user.id
        );

        if (userIndex === -1) {
            return res.status(400).json({ message: 'You are not a member of this league' });
        }

        // Check if user is the creator - optional: you may want to prevent creators from leaving
        if (league.createdBy.toString() === req.user.id) {
            return res.status(400).json({
                message: 'As the creator, you cannot leave this league. You can only delete it.'
            });
        }

        // Remove user from participants
        league.participants.splice(userIndex, 1);
        await league.save();

        res.status(200).json({ message: 'Successfully left the league' });
    } catch (error) {
        console.error('Error leaving league:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;