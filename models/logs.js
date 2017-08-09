var mongoose = require('mongoose')
var db = mongoose.createConnection("mongodb://localhost:27017/deckard")
mongoose.Promise = require('bluebird')
var Schema = mongoose.Schema

var logSchema = new Schema({
    type: { type: String, default: "log" },
    data: { type: {}, default: null },
    string: { type: String, default: null },
    date: { type: Date, default: Date.now() }
})

var log = db.model('log', logSchema)

module.exports = log