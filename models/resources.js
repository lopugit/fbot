var mongoose = require('mongoose')
var db = mongoose.createConnection("mongodb://localhost:27017/deckard")
Schema = mongoose.Schema
moment = require('moment')

var resourceSchema = new Schema({
    resource: { type: String, required: true },
    resourceSynonyms: { type: [String] },
    resourceId: { type: Schema.ObjectId, ref: 'resource' },
    names: { type: [String], required: false },
    title: { type: String, required: false },
    description: { type: String, required: false },
    url: { type: String },
    boolean: { type: Boolean },
    realms: { type: [String], default: ["all", "resources"] },
    resources: { type: [{ type: Schema.ObjectId, ref: 'resource' }], default: [] },
    parents: { type: [{type: Schema.ObjectId, ref: 'resource' }], default: [] },
    arbData: { type: {}, default: {} },
    owner: { type: Schema.ObjectId, ref: 'entity'},
    letters: { type: [{ type: Schema.ObjectId, ref: 'entity'}] },
    exists: { type: Boolean, default: true },
    verified: { type: Boolean, default: false },
    contract: { type: Schema.ObjectId, ref: 'resource' },
    state: { type: Boolean, default: false },
    states: { type: [{ type: Schema.ObjectId, ref: 'resource' }]},
    stateType: { type: String, default: 'permanent' },
    inception: { type: Date, default: Date.now() },
    age: { type: Number, default: 0},
    lifetime: { type: Number, default: 0, min: 0, max: Infinity },
    location: { type: String },
    source: { type: String },
    history: { type: [{ type: Schema.ObjectId, ref: 'resource' }]},
    properties: { type: {}, default: {} }
    //         file: { type: String },
    //         fbData: { type: {} },
    //         twitterData: { type: {} },
    //         redditData: { type: {} },
    //         linkedinData: { type: {} },
    //         youtubeData: { type: {} },
    //         Data: { type: {} },
    //         linkedinData: { type: {} },
    //     } 
    // }
    ,
    uniques: {
        names: { type: Boolean, default: false },
        resource: { type: Boolean, default: false },
        type: { type: Boolean, default: false },
    }
})

var resourceModel = db.model('resource', resourceSchema)

module.exports = resourceModel