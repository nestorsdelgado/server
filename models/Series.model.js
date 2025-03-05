const mongoose = require('mongoose');
const { Schema, model } = mongoose;

const seriesSchema = new Schema({
    name: String, // ""
    year: Number, // 2015
    begin_at: { type: Date, default: Date.now }, // "2014-09-09T22:00:00Z"
    end_at: { type: Date, default: Date.now }, // "2015-04-18T23:00:00Z"
    winner_id: Number,
    slug: String, // "league-of-legends-eu-lcs-spring-2015"
    winner_type: String, // Team
    modified_at: { type: Date, default: Date.now }, // "2022-08-08T15:39:31Z"
    league_id: Number, // 290
    season: String, // "Spring"
    full_name: String // "Spring 2015"
});

module.exports = model('Series', seriesSchema);