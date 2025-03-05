const router = require('express').Router();
const axios = require('axios');
require('dotenv').config();

const API_KEY = process.env.LOLESPORTS_API_KEY;
const LEC_ID = "98767991302996019"; // LEC id

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

        const allPlayers = lecTeams.flatMap(team => team.players || []);

        if (!allPlayers.length) {
            return res.status(404).json({ message: "No LEC players found" });
        }

        res.json(allPlayers);
    } catch (error) {
        console.error("Error fetching LEC players from LoLEsports API:", error.response?.data || error);
        res.status(500).json({ message: "Failed to fetch LEC players" });
    }
});

module.exports = router;