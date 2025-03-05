const router = require('express').Router();
const axios = require('axios');
const dotev = require('dotenv').config();

// const mongoose = require("mongoose");
//const PANDA_SCORE_API_TOKEN = process.env.PANDA_SCORE_API_TOKEN;
const API_KEY = process.env.LOLESPORTS_API_KEY

const LEC_ID = "98767991302996019"; // LEC id

// GET /api/matches -  Retrieves all of the matches
router.get('/matches', async (req, res, next) => {

    try {
        const response = await axios.get("https://esports-api.lolesports.com/persisted/gw/getSchedule", {
            headers: {
                "x-api-key": API_KEY
            },
            params: {
                hl: "es-ES",
                leagueId: LEC_ID
            }
        });

        const lecMatches = response.data.data.schedule.events;

        if (!lecMatches || lecMatches.length === 0) {
            return res.status(404).json({ message: "No LEC matches found" });
        }

        res.json(lecMatches);
    } catch (error) {
        console.error("Error fetching LEC matches from LoLEsports API:", error.response?.data || error);
        res.status(500).json({ message: "Failed to fetch LEC matches" });
    }
});


// GET /api/matches/:matchId -  Retrieves specific match // 113476054450624509 -> Final Winter 2025
router.get('/matches/:matchId', async (req, res) => {

    const { matchId } = req.params;

    try {
        const response = await axios.get("https://esports-api.lolesports.com/persisted/gw/getEventDetails", {
            headers: {
                "x-api-key": API_KEY
            },
            params: {
                hl: "en-US",
                id: matchId
            }
        });

        if (!response.data.data.event) {
            return res.status(404).json({ message: "Match not found" });
        }

        res.json(response.data.data.event);
    } catch (error) {
        console.error("Error fetching match details from LoLEsports API:", error.response?.data || error);
        res.status(500).json({ message: "Failed to fetch match details" });
    }
});

module.exports = router;
