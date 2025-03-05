require("dotenv").config();
require("./db");


const express = require("express");
const cors = require('cors');
const app = express();

// ℹ️ This function is getting exported from the config folder. It runs most pieces of middleware
require("./config")(app);


app.use(express.json());
app.use(cors()); // Enable CORS to allow frontend access

// Leagues route
const leaguesRoutes = require('./routes/leagues.routes');
app.use('/api', leaguesRoutes);

// Matches route
const matchesRoutes = require('./routes/matches.routes');
app.use('/api', matchesRoutes);

// Teams route
const teamsRoutes = require('./routes/teams.routes');
app.use('/api', teamsRoutes);

const indexRoutes = require("./routes/index.routes");
app.use("/api", indexRoutes);

const authRoutes = require("./routes/auth.routes");
app.use("/auth", authRoutes);

// ❗ To handle errors. Routes that don't exist or errors that you handle in specific routes
require("./error-handling")(app);

module.exports = app;
