const router = require('express').Router();
const axios = require('axios');
require('dotenv').config();

const API_KEY = process.env.LOLESPORTS_API_KEY;

// GET all teams in LEC
router.get('/teams', async (req, res) => {
    try {
        const response = await axios.get("https://esports-api.lolesports.com/persisted/gw/getTeams", {
            headers: {
                "x-api-key": API_KEY
            },
            params: {
                hl: "es-ES",

            }
        });

        const allTeams = response.data.data.teams;

        const lecTeams = allTeams.filter(team =>
            team.homeLeague && team.homeLeague.name === "LEC"
        );

        if (!lecTeams || lecTeams.length === 0) {
            return res.status(404).json({ message: "No LEC teams found" });
        }

        res.json(lecTeams);
    } catch (error) {
        console.error("Error fetching teams from LoLEsports API:", error.response?.data || error);
        res.status(500).json({ message: "Failed to fetch teams" });
    }
});

// GET specific team
router.get('/teams/:teamId', async (req, res) => {

    const {teamId} = req.params

    try {
        const response = await axios.get("https://esports-api.lolesports.com/persisted/gw/getTeams", {
            headers: {
                "x-api-key": API_KEY
            },
            params: {
                hl: "es-ES",
                id: teamId
            }
        });

        const allTeams = response.data.data.teams;

        const lecTeams = allTeams.filter(team =>
            team.homeLeague && team.homeLeague.name === "LEC"
        );

        if (!lecTeams || lecTeams.length === 0) {
            return res.status(404).json({ message: "No LEC teams found" });
        }

        res.json(lecTeams);
    } catch (error) {
        console.error("Error fetching teams from LoLEsports API:", error.response?.data || error);
        res.status(500).json({ message: "Failed to fetch teams" });
    }
});

module.exports = router;
