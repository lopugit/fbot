var express = require('express');
var app = express();

var path = require('path');


// FB NODE Packages in order of version number

//https://github.com/criso/fbgraph
var fbgraph = require('fbgraph');

// https://github.com/node-facebook/facebook-node-sdk
var fb = require('fb');

// https://github.com/tenorviol/node-facebook-sdk
var facebookSdk = require('facebook-sdk');

// https://github.com/amachang/facebook-node-sdk
var facebookNodeSdk = require('facebook-node-sdk');


// Be a bot

app.get('/', function(req, res) {
	res.send("botting");
});

var port = 5555;

app.listen(port);
