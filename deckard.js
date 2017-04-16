var express = require('express');
var app = express();
var url = require('url');
var path = require('path');
var step = require('step');
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
FB.api('154420241260828/feed?limit=1000', function(response){
	console.log(response);
	var feed = response;
	app.get('/', function(req, res) {
		res.locals.posts = feed.data;
		res.render('snippets/posts');
	});
});

var access_token = FB.getAccessToken();
console.log(access_token);

// https://github.com/tenorviol/node-facebook-sdk
var facebookSdk = require('facebook-sdk');

// https://github.com/amachang/facebook-node-sdk
var facebookNodeSdk = require('facebook-node-sdk');


// Be a bot

var port = 5555;

app.listen(port);
