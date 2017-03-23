var express = require('express');
var app = express();

var path = require('path');

// Be a bot

app.get('/', function(req, res) {
	res.send("botting");
});

var port = 5555;

app.listen(port);
