var express = require('express');
var app = express();
var url = require('url');
var path = require('path');
var step = require('step');
var http = require('http');
var https = require('https');
var request = require('request');
Step = require('step');
app.set('view engine', 'pug');
app.locals.basedir = path.join(__dirname, 'views');
// FB NODE Packages in order of version number

//https://github.com/criso/fbgraph
var fbgraph = require('fbgraph');

// https://github.com/node-facebook/facebook-node-sdk
var FB = require('fb');

var conf = {
	appId: '143951196071022',
	appSecret: 'fcab9c0d477924a62922f63a7e64445a',
	redirect_uri : 'http://localhost:5555/'
};

FB.setAccessToken(conf.appId+"|"+conf.appSecret);

const posts = [];
var v = 0;
var length = 0;
function getPosts(response){

	console.log(response.data);
	posts.push(response);
		request(
    { method: 'GET'
    , uri: response.paging.next
    , gzip: true
    }
  , function (error, response, body) {
      // body is the decompressed response body
      console.log('server encoded the data as: ' + (response.headers['content-encoding'] || 'identity'))
			var json = JSON.parse(body)
			length += json.data.length
			console.log(length);
			console.log(json);
			if(json.data.length > 0) {
				getPosts(json)

			} else {
				return;
			}
    }
	)
	// var feed = response;
	// return true;
};

function renderAllPosts(posts) {
	app.get('/', function(req, res) {

		res.locals.posts = feed.data;
		res.render('snippets/posts');
	});
};

// FB.api('154420241260828/feed?limit=2000', getPosts);
// FB.api('174969462937980/feed?limit=2000', getPosts);
FB.api('616006458523730/feed?limit=2000', getPosts);
var access_token = FB.getAccessToken();
console.log(access_token);

// https://github.com/tenorviol/node-facebook-sdk
var facebookSdk = require('facebook-sdk');

// https://github.com/amachang/facebook-node-sdk
var facebookNodeSdk = require('facebook-node-sdk');


// Be a bot

var port = 5555;

app.listen(port);
