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

var post = require('./models/post')
mongoose.Promise = require('bluebird')
mongoose.connect("mongodb://localhost:27017/deckardTEST")
var db = mongoose.connection

//https://github.com/criso/fbgraph
var fbgraph = require('fbgraph')

// https://github.com/node-facebook/facebook-node-sdk
var FB = require('fb')

var conf = require('./conf/fbconf')
var accessToken = conf.appId+"|"+conf.appSecret
var postEdges = ["likes", "sharedposts", "attachments", "reactions", "comments"]
var groupId = "154420241260828"
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
var somePost = new post({data: "something"})
function renderAllPosts(posts) {
	app.get('/', function(req, res) {

		res.locals.posts = feed.data;
		res.render('snippets/posts');
	});
};

function getPostEdgeAndSave(edge, fbPostId, ourPostId){
	console.log("requesting edge: ")
	console.log(edge);
	console.log("from fb post: ")
	console.log(fbPostId);
	var url = "https://graph.facebook.com/v2.8/"+fbPostId+"/"+edge+"?limit=1000&access_token=143951196071022|fcab9c0d477924a62922f63a7e64445a"
	console.log("with url %s", url)
	currentRequests += 1
	totalEdgeRequests += 1
	totalRequests += 1
	currentEdgeRequests += 1
	console.log("Number of active requests %s", currentRequests)
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
			currentRequests -= 1
			currentEdgeRequests -= 1

			if(error){
				console.error("there was an error requesting the edge %s, here is the error: ", edge)
				console.error(error)
				totalErrors += 1
				totalEdgeErrors +=1
				errors.push(error)
				edgeErrors.push(error)
			}else if(body){
				var json = JSON.parse(body)
				console.log("succesfully received edge %s from post %s", edge, fbPostId);
				console.log("Number of active requests %s", currentRequests)
				if(json){
					post.findById(ourPostId, function(err, post){
						post[edge] = json
						post.save()
					})
				}
			}
		}
	)
}

function requestPosts(page){
	console.log("requesting more posts from");
	console.log(page);
	currentRequests += 1
	currentPostRequests +=1
	totalPostRequests +=1
	totalRequests += 1

	console.log("total requests %s", totalRequests)
	console.log("Number of active requests %s", currentRequests)
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
			currentRequests -= 1
			currentPostRequests -=1

			if(error){
				console.error("there was an error, here it is: ")
				console.error(error)
				totalErrors += 1
				totalPostErrors +=1
				errors.push(error)
				postErrors.push(error)
			}else if(body){
				console.log("succesfully received posts");
				console.log("Number of active requests %s", currentRequests)
				var json = JSON.parse(body)
				console.log(json)
				console.log("Here is the next page: \n%s \nand previous page: \n%s", json.paging.next, json.paging.previous)
				if(json.data){
					if(json.data.length > 0) {
						for (var i = 0; i < json.data.length; i++) {
							var newPost = new post({
								data: json.data[i],
								fbId: json.data[i].id
							})
							newPost.save()
							for (var j = 0; j < postEdges.length; j++) {
								getPostEdgeAndSave(postEdges[j], json.data[i].id, newPost._id)
							}
							if(i == json.data.length -1) {
								requestPosts(json.paging.next)
							}
						}
					} else {
						return;
					}
				}
			}
    }
	)
}

function cloneGroup(groupId, accessToken, postEdges, postsPerRequest, firstUrl){
	console.log("cloning group: "+groupId)
	requestPosts(firstUrl)
}
var hungUrl = "https://graph.facebook.com/v2.8/154420241260828/feed?limit=10&__paging_token=enc_AdBzndqf4tT5eteq6mFk2uyb9ksFWiljiqF0gpf4XRi9ZB9V6cLRsPwix45khAXnQp73wlqN4wWKcZBfZBXvUPW5FGmaZCyJGkkK4lZBWnNKU9JLTCwZDZD&icon_size=16&access_token=143951196071022|fcab9c0d477924a62922f63a7e64445a&until=1463808565"
var firstUrl = "https://graph.facebook.com/v2.8/"+groupId+"/feed?limit=1&access_token="+accessToken
cloneGroup(groupId, accessToken, postEdges, 10, firstUrl)
// FB.api('154420241260828/feed?limit=2000', requestPosts);
// FB.api('174969462937980/feed?limit=2000', getPosts);
// FB.api('616006458523730/feed?limit=2000', getPosts);
var access_token = FB.getAccessToken();
// console.log(access_token);

// https://github.com/tenorviol/node-facebook-sdk
var facebookSdk = require('facebook-sdk');

// https://github.com/amachang/facebook-node-sdk
var facebookNodeSdk = require('facebook-node-sdk');


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
	console.log("what")
	if (stat !== "all") {
		res.send(stat+": "+stats[stat])
		console.log("what1")
	} else if (stat == "all") {
		res.setHeader('Content-Type', 'text/html');
		res.writeHead(200)
		console.log("what2")
		for (var i = 0; i < stats.size(stats); i++) {
			console.log("what3")
			res.write(stat + ": "+stats[i])
			console.error("IT DOES")
			if (i == stats.length-1) {
				console.error("IT DOES")
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
