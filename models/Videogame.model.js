const mongoose = require('mongoose');
const { Schema, model } = mongoose;

const videogameSchema = new Schema({
    name: String, //"LoL",
    current_version: String, //"15.4.1",
    slug: String //"league-of-legends"
});

module.exports = model('Videogame', videogameSchema);