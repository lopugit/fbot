var mongoose = require('mongoose')
var Schema = mongoose.Schema

var postSchema = new Schema({
	data: {type: {}, default: {}},
	comments: {type: {}, default: {}},
	sharedposts: {type: {}, default: {}},
	likes: {type: {}, default: {}},
	reactions: {type: {}, default: {}},
	attachments: {type: {}, default: {}}
})

var post = mongoose.model('post', postSchema)

module.exports = post
