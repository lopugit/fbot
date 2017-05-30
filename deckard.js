var express = require('express')
var app = express()
url = require('url')
path = require('path')
step = require('step')
http = require('http')
https = require('https')
request = require('request-promise')
mongoose = require('mongoose')
Step = require('step')
app.set('view engine', 'pug')
app.locals.basedir = path.join(__dirname, 'views')
// FB NODE Packages in order of version number

var deckardPost = require('./models/post')
mongoose.Promise = require('bluebird')
var db = mongoose.createConnection("mongodb://localhost:27017/philosophy")
var conf = require('./conf/fbconf')

// FB.setAccessToken(conf.appId+"|"+conf.appSecret)

const posts = [];
var v = 0
		length = 0
		currentRequests = 0
		currentEdgeRequests = 0
		currentPostRequests = 0
		totalRequests = 0
		totalEdgeRequests = 0
		totalPostRequests = 0
		totalErrors = 0
		edgeErrors = []
		postErrors = []
		errors = []
		arbCount = 0
		arbTotalCount = 0
		uniqueCommenters = []
function getPostEdgeAndSave(edge, fbId, ourPostId, accessToken, postModel){
	var url = "https://graph.facebook.com/v2.8/"+fbId+"/"+edge+"?limit=1000&access_token="+accessToken
	if(logging){
		console.log("requesting edge: ")
		console.log(edge);
		console.log("from fb post: ")
		console.log(fbId);
		console.log("with url %s", url)
	}
	if(minimalFeedback){
		currentRequests += 1
		totalEdgeRequests += 1
		totalRequests += 1
		currentEdgeRequests += 1
		console.log("Number of total requests %s", totalRequests)
		console.log("Number of active requests %s", currentRequests)
	}
	request(
		{ method: 'GET',
		uri: url,
		gzip: true,
		timeout: 0,
		forever: true
		// ,
		// headers: {
		// 		connection: "close"
		// 	}
		}
		, function (error, response, body) {
			// body is the decompressed response body
			// // console.log('server encoded the data as: ' + (response.headers['content-encoding'] || 'identity'))
			if(minimalFeedback){
				currentRequests -= 1
				currentEdgeRequests -= 1
			}
			if(error){
				if(logging){
					console.error("there was an error requesting the edge %s, here is the error: ", edge)
					console.error(error)
					totalErrors += 1
					totalEdgeErrors +=1
					errors.push(error)
					edgeErrors.push(error)
				}
				return
			}else if(body){
				var json = JSON.parse(body)
				if(logging){
					console.log("succesfully received edge %s from post %s", edge, fbId);
					console.log(json)
				}
				if(minimalFeedback){
					console.log("Number of active requests %s", currentRequests)
				}
				// Check if there is any data to process
				if(json.data.length > 0){
					if(edge == "attachments") {
						if(json.data.type == "photo"){
							postModel.find({_id: ourPostId}).then(function(posts){
								if(posts.length > 0){
									posts[0][edge] = json.data[0].media
									posts[0].image = json.data[0].media.src
									posts[0].save(function(err){
										if(err !== null){
											console.error(err)
											posts[0].save(function(err){
												if(err !== null){
													console.error(err)
												}
										})

										}
									})
								}
							})

						}
						// If the attachment was not a photo we simply return, we will handle other attachments later :)
						else {
							return
						}
					}
					// If edge was not attachments, simply save edge as the returned data
					else {
						postModel.find({_id: ourPostId}).then(function(posts){
							if(posts.length > 0){
								posts[0][edge] = json.data
								posts[0].save(function(err){
									if(err !== null){
										console.error(err)
										console.log("trying to save post again after error")
										posts[0].save(function(err){
											if(err !== null){
												console.error(err)
											}
										})

									}
								})
							}
						})
					}
				}
				// If there was no data returned
				else {
					return
				}
			}
		}
	)
}

function recursiveFind(i, postModel, json, callback){
	if(logging){
		console.log("this is i %s and this is json.data.length %s before checking whether to loop or not", i, json.data.length)
	}
	if(i < json.data.length){
		if(logging){
			console.log("this is the post we're going to try and store storing: ")
			console.log(json.data[i]);
		}
		postModel.find({"fbData.id": json.data[i].id}, function(err, posts){
			// CHECK IF OUR POST LOOKUP USING FACEBOOK POST ID RETURNED ANY POSTS
			if(posts.length > 0) {
				// IF THE RECEIVED POST UPDATE TIME DOES NOT MATCH THE STORED POSTS LAST UPDATED TIME WE REPLACE THE DATA AND SAVE THE HISTORY
				if(posts[0].fbData.updated_time !== json.data[i].updated_time){
					posts[0].history.push(posts[0].fbData)
					posts[0].lastUpdated = json.data[i].updated_time
					posts[0].fbData = json.data[i]
					posts[0].save(function(err){
						if(err !== null){
							console.log(err)
						}
					})
					if(logging){
						console.log("saved post succesfully");
					}
					// THEN GET THE POSTS UPDATED EDGES
					for (var k = 0; k < postEdges.length; k++) {
						getPostEdgeAndSave(postEdges[k], json.data[i].id, posts[0]._id, accessToken, postModel)
					}
					recursiveFind(i+1, postModel, json, callback)
				}
				// IF THE LAST TIME THE POST WAS UPDATED IS THE SAME AS THE LAST UPDATED TIME STORED THEN WE DO NOTHING
				else {
					recursiveFind(i+1, postModel, json, callback)
				}
			}
			else if (posts.length < 1) {
				// MAKE A NEW POST OBJECT
				var newPost = new postModel({
					fbData: json.data[i],
					type: "fb",
					lastUpdated: json.data[i].updated_time
				})
				// SAVE THE NEW POST
				newPost.save(function(err){
					if(err !== null){
						console.log(err)
					}
				})
				if(logging){
					console.log(i)
					console.log(json.data[i])
					console.log("saved post succesfully");
				}
				recursiveFind(i+1, postModel, json, callback)
				// GET ALL THE POSTS EDGES DEFINED BY postEdges Object
				for (var k = 0; k < postEdges.length; k++) {
					getPostEdgeAndSave(postEdges[k], json.data[i].id, newPost._id, accessToken, postModel)
				}
			}
		})
	}
	// Otherwise initiate the next post request
	else {
		callback(json.paging.next, accessToken, postModel)
	}
}

function requestPosts(page, accessToken, postModel){
	if(logging){
		console.log("requesting more posts from");
		console.log(page);
	}
	if(minimalFeedback){
		currentRequests += 1
		currentPostRequests +=1
		totalPostRequests +=1
		totalRequests += 1
		console.log("total requests %s", totalRequests)
		console.log("Number of active requests %s", currentRequests)
	}
	request(
    { method: 'GET',
    uri: page,
    gzip: true,
		timeout: 0,
		forever: true
		// ,
		// headers: {
		// 		connection: "close"
	  //   }
		}
	  , function (error, response, body) {
      // body is the decompressed response body
      // // console.log('server encoded the data as: ' + (response.headers['content-encoding'] || 'identity'))
			if(minimalFeedback){
				currentRequests -= 1
				currentPostRequests -=1
			}

			if(error){
				if(logging){
					console.error("there was an error, here it is: ")
					console.error(error)
					totalErrors += 1
					totalPostErrors +=1
					errors.push(error)
					postErrors.push(error)
				}
				return
			}
			else if(body){
				var json = JSON.parse(body)
				if(logging){
					console.log("succesfully received posts");
					if(json.hasOwnProperty("paging")){
						console.log("Here is the next page: \n%s \nand previous page: \n%s", json.paging.next, json.paging.previous)
					}
					console.log(json)
				}
				if(minimalFeedback){
					console.log("Number of active requests %s", currentRequests)
				}
				// Check if the returned data has any data in it (posts, events, etc..)
				if(json.data.length > 0) {
					recursiveFind(0, postModel, json, requestPosts)
				}
				// If there was no data it means we have reached the end of the group and can stop trauling
				else {
					return;
				}
			}
    }
	)
}

function cloneGroup(groupId, accessToken, postEdges, firstUrl, postModel){
	console.log("cloning group: "+groupId)
	requestPosts(firstUrl, accessToken, postModel)
}

function addrealm(realm, model){
	var stream = model.find().cursor()
	stream.on('data', function(doc){
		arbTotalCount += 1
		console.log(arbTotalCount)
		if(loggingrealmUpdate){
			console.log(doc.realmList)
		}
		if(doc.realmList.indexOf(realm) < 0){
			doc.realmList.push(realm)
			doc.save(function(err){
				if(err !== null){
					console.error(err)
				}
			})
		}
		if(loggingrealmUpdate){
			console.log(doc.realmList)
		}

	}).on('error', function(err){
		console.error(err)
	}).on('close', function(){
		console.log("updated all posts")
	})
}

function countCommenters(model){
	var stream = model.find().cursor()
	stream.on('data', function(doc){
		arbTotalCount += 1
		if(logging){
			console.log(arbTotalCount)
			// console.log(doc.comments)
			// console.log(doc)
		}
		if(doc.comments !== null){

			var commenterIds = []
			for(i=0;i<doc.comments.length;i++){
				arbTotalCount += 1
				if(commenterIds.indexOf(doc.comments[i].from.id) < 0){
					// Count active members
					if(uniqueCommenters.indexOf(doc.comments[i].from.id) < 0){
						uniqueCommenters.push(doc.comments[i].from.id)
					}
					// Put commenterId into commenterIds database to register the unique id
					commenterIds.push(doc.comments[i].from.id)
					if(doc.commenters.indexOf(doc.comments[i].from) < 0){
						doc.commenters.push(doc.comments[i].from)
					}
				}
				if(i == doc.comments.length-1){
					doc.commenters = commenters
					doc.save(function(err){
						if(err !== null){
							console.log(err)
						}
					})
				}
			}
			if(logging){
				// console.log("number of ")
				console.log(doc.commenters.length)
			}
		}


	}).on('error', function(err){
		console.error(err)
	}).on('close', function(){
		console.log("total unique commenters was %s", uniqueCommenters.length)
		console.log("updated all posts")
	})
}

var accessToken = conf.appId+"|"+conf.appSecret
var postEdges = ["likes", "sharedposts", "attachments", "reactions", "comments"]
var groupId = conf.groupId
// var groupId = "616006458523730"
var hungUrl = "https://graph.facebook.com/v2.8/154420241260828/feed?limit=10&__paging_token=enc_AdClZAgLdpsmibpOspZApDGNTZCrG5vnhwTjZBXVUwKnC0aBoZBxr9WlBPby7rhSblXEo3QHpiapdbIa41LB36BNSZAtyiQJIN97X7ojOZBrQXQuhZCpKAZDZD&icon_size=16&access_token=143951196071022|fcab9c0d477924a62922f63a7e64445a&until=1475222768"
var nextHungUrl = "https://graph.facebook.com/v2.8/154420241260828/feed?limit=10&__paging_token=enc_AdCcIlNMwIc0Y7PyRtI1zxgsHB46QUH7ZC47anhUSoVTsv5wR8Tmi2rUcp6bTlH1TrHQTZCaOabrFa4D3Fn9KXOJ0FaUgqeh73mZBgB7jfjFwdHzAZDZD&icon_size=16&access_token=143951196071022|fcab9c0d477924a62922f63a7e64445a&until=1462765025"
var nextNextHungUrl = "https://graph.facebook.com/v2.8/154420241260828/feed?limit=50&__paging_token=enc_AdAZAZASnnGmVHf5LIXRAl0TELAusKtAS6TyuBDMOWaGPlGEqQlImJHZBfAlaEdI0BjEfYD3ieGxCWl9yuZBZBzmH7ZCHFeZCahE3fZClU7BufL9UTip8AZDZD&icon_size=16&access_token=143951196071022|fcab9c0d477924a62922f63a7e64445a&until=1460946514"
var next3HungUrl = "https://graph.facebook.com/v2.8/154420241260828/feed?limit=5&__paging_token=enc_AdCVMsb221H2XjWolPqHIfYDJgt5iVJ39daGzTOP0nzngsZAmFNbZBYWXh3B5xEWYoT8jQy69OzIdtnrgnVO4MPuTP3jztyWcOVGGlwgqQbtVqtQZDZD&icon_size=16&access_token=143951196071022|fcab9c0d477924a62922f63a7e64445a&until=1447243470"
var next4HungUrl = "https://graph.facebook.com/v2.8/154420241260828/feed?limit=1&__paging_token=enc_AdCoHZCGpvItK3Ub7L16opYrRbKxoF0ZCaw3GDryQwsN9PEHV1w3GUokFSZBZBezZCmVMFRZBoMyv2Sc3F3K8MRlaUWay9pvEg94EFytWhKKtiZAAFO4QZDZD&icon_size=16&access_token=143951196071022|fcab9c0d477924a62922f63a7e64445a&until=1429367168"
var limit = 1
var firstUrl = "https://graph.facebook.com/v2.8/"+groupId+"/feed?limit="+limit+"&access_token="+accessToken
var logging = false
var loggingrealmUpdate = false
var minimalFeedback = true
// cloneGroup(groupId, accessToken, postEdges, firstUrl, deckardPost)
addrealm("philosophy", deckardPost)
// countCommenters(deckardPost)

app.get('/', function(req, res) {
	res.render('snippets/posts');
});

app.get('/running', function(req, res){
	res.send("Active requests: " + currentRequests +" Total post requests: "+ totalPostRequests + " Total edge requests: "+ totalEdgeRequests +" Total requests: " + totalRequests)
})

app.get('/stats/:stat', function(req, res){
	var stats = {
		currentRequests : currentRequests,
		currentEdgeRequests : currentEdgeRequests,
		currentPostRequests : currentPostRequests,
		totalRequests : totalRequests,
		totalEdgeRequests : totalEdgeRequests,
		totalPostRequests : totalPostRequests,
		totalErrors : totalErrors
	}
	stats.size = function(obj) {
    var size = 0, key;
    for (key in obj) {
        if (obj.hasOwnProperty(key)) size++;
    }
    return size;
	};
	var stat = req.params.stat
	if (stat !== "all") {
		res.send(stat+": "+stats[stat])
	} else if (stat == "all") {
		res.setHeader('Content-Type', 'text/html');
		res.writeHead(200)
		for (var i = 0; i < stats.size(stats); i++) {
			res.write(stat + ": "+stats[i])
			if (i == stats.length-1) {
				res.end()
			}
		}
	} else {
		res.send(500, "please request a stat")
	}
})



// Be a bot
var port = 5555;
app.listen(port);
