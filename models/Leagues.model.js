const mongoose = require('mongoose');
const { Schema, model } = mongoose;

const leaguesSchema = new Schema({
    name: String,
    url: String, // "https://www.lolesports.com/en_US/eu-lcs/eu_2018_summer/about"
    slug: { type: String, required: true, unique: true, trim: true }, // "league-of-legends-eu-lcs"
    videogame: [{ type: Schema.Types.ObjectId, ref: 'Videogame' }],
    modified_at: { type: Date, default: Date.now }, // "2019-01-18T15:19:10Z"
    series: [{ type: Schema.Types.ObjectId, ref: 'Series' }],
    image_url: String //"https://cdn.pandascore.co/images/league/image/290/eu-lcs-b29u5nim.png"
});

module.exports = model('Leagues', leaguesSchema);
