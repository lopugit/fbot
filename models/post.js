var mongoose = require('mongoose')
var db = mongoose.createConnection("mongodb://localhost:27017/deckard")
mongoose.Promise = require('bluebird')
var Schema = mongoose.Schema

var postSchema = new Schema({
    type: { type: String, default: "lopu" },
    data: { type: {}, default: null },
    id: { type: String },
    comments: {
        data: { type: [], default: [] },
        history: {
            type: [
                []
            ],
            default: []
        }
    },
    sharedposts: {
        data: { type: [{}], default: [] },
        history: {
            type: [
                {}
            ],
            default: []
        }
    },
    likes: {
        data: { type: [{}], default: [] },
        history: {
            type: [
                {}
            ],
            default: []
        }
    },
    reactions: {
        data: { type: [{}], default: [] },
        history: {
            type: [
                {}
            ],
            default: []
        }
    },
    attachments: {
        data: { type: [String], default: [] },
        history: {
            type: [
                {}
            ],
            default: []
        }
    },
    saves: {
        data: { type: [{}], default: [] },
        history: {
            type: [
                {}
            ],
            default: []
        }
    },
    balance: { type: Number, default: 50, min: 0, max: 100 },
    politcal: { type: Number, default: 50, min: 0, max: 100 },
    consciousness: { type: Number, default: 0, min: 0, max: 100 },
    intelligence: { type: Number, default: 0, min: 0, max: 100 },
    frequency: { type: Number, default: 0, min: 0, max: 50000 },
    philosophical: { type: Number, default: 0, min: 0, max: 100 },
    realm: { type: String, default: null },
    realmList: { type: [String], default: null },
    globalImportance: { type: Number, default: 0, min: 0, max: 100 },
    userImportance: { type: Number, default: 0, min: 0, max: 100 },
    image: { type: String, default: null },
    fbData: { type: {}, default: null },
    history: { type: [{}], default: [] },
    commenters: { type: [{}], default: [] },
    lastUpdate: { type: String, default: Date.now() }
})

var post = db.model('post', postSchema)

module.exports = post