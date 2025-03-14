require("dotenv").config();
require("./db");
const mongoose = require("mongoose");


const express = require("express");
const cors = require('cors');
const app = express();

const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/leaguesDB";

mongoose
    .connect(MONGO_URI, {
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
    })
    .then(() => console.log("MongoDB Connected Successfully"))
    .catch((err) => {
        console.error("MongoDB Connection Error:", err);
        process.exit(1);
    });


// ℹ️ This function is getting exported from the config folder. It runs most pieces of middleware
require("./config")(app);


app.use(express.json());
app.use(cors()); // Enable CORS to allow frontend access


// My leagues route
const myLeaguesRoutes = require('./routes/my-leagues.routes');
app.use('/api', myLeaguesRoutes);

// Leagues route
const leaguesRoutes = require('./routes/leagues.routes');
app.use('/api', leaguesRoutes);

// Matches route
const matchesRoutes = require('./routes/matches.routes');
app.use('/api', matchesRoutes);

// Teams route
const teamsRoutes = require('./routes/teams.routes');
app.use('/api', teamsRoutes);

// Players route
const playersRoutes = require('./routes/players.routes');
app.use('/api', playersRoutes);

// Transactions
const transactionsRoutes = require('./routes/transactions.routes');
app.use('/api', transactionsRoutes);

const indexRoutes = require("./routes/index.routes");
app.use("/api", indexRoutes);

const authRoutes = require("./routes/auth.routes");
app.use("/api/auth", authRoutes);

// To handle errors. Routes that don't exist or errors that you handle in specific routes
require("./error-handling")(app);

module.exports = app;
