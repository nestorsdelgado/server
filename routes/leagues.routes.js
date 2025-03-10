// https://vickz84259.github.io/lolesports-api-docs/

const router = require('express').Router();
const axios = require('axios');
const dotev = require('dotenv').config();

const API_KEY = process.env.LOLESPORTS_API_KEY

// GET /api/leagues -  Retrieves all of the leagues
router.get('/leagues', async (req, res, next) => {
    try {
        const response = await axios.get(`https://esports-api.lolesports.com/persisted/gw/getLeagues`, {
            headers: {
                "x-api-key": API_KEY
            },
            params: {
                hl: "es-ES",
                leagueId: "98767991302996019" // LEC AND EU LCS
            }
        });

        const lecLeague = response.data.data.leagues.find(league => league.id == "98767991302996019");

        if (!lecLeague) {
            return res.status(404).json({ message: "LEC league not found" });
        }

        res.json(lecLeague); // Return only LEC data

    } catch (error) {
        console.error("Error fetching leagues from LoLEsports API:", error.response?.data || error);
        res.status(500).json({ message: "Failed to fetch leagues" });
    }
});

// GET /api/leagues/tournaments -  Retrieves all of the tournaments of a league
router.get('/leagues/tournaments', async (req, res, next) => {

    //const { leagueId } = req.params

    try {
        const response = await axios.get(`https://esports-api.lolesports.com/persisted/gw/getTournamentsForLeague`, {
            headers: {
                "x-api-key": API_KEY
            },
            params: {
                hl: "es-ES",
                leagueId: "98767991302996019" // LEC AND EU LCS
            }
        });

        res.json(response.data); // Send the data to the frontend
    } catch (error) {
        console.error("Error fetching tournaments from LoLEsports API:", error.response?.data || error);
        res.status(500).json({ message: "Failed to fetch leagues" });
    }
});

// GET /api/leagues/standings -  Retrieves standings of a league
router.get('/leagues/:tournamentId/standings', async (req, res, next) => {

    const { tournamentId } = req.params

    try {
        const response = await axios.get(`https://esports-api.lolesports.com/persisted/gw/getStandings`, {
            headers: {
                "x-api-key": API_KEY
            },
            params: {
                hl: "es-ES",
                tournamentId: tournamentId // "113475994398658012"
                //leagueId: "98767991302996019" // LEC AND EU LCS
            }
        });

        res.json(response.data); // Send the data to the frontend
    } catch (error) {
        console.error("Error fetching standings from LoLEsports API:", error.response?.data || error);
        res.status(500).json({ message: "Failed to fetch leagues" });
    }
});

module.exports = router;
