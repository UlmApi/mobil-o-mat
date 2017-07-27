#!/usr/bin/env node

// npm modules
var bodyparser = require("body-parser");
var nodemailer = require("nodemailer");
var ellipse = require("ellipse");
var smclean = require("smclean");
var moment = require("moment");

// node modules
var path = require("path");
var url = require("url");
var fs = require("fs");

// excepto
require(path.resolve(__dirname,"excepto.js"));

// stats
var stats = { spam: 0, sent: 0, fail: 0 };

// config
var config = {
	smtp: {
		host: 'mail.netzguerilla.net',
		port: 465,
		secure: true, // secure:true for port 465, secure:false for port 587
		auth: {
			user: 'mailout@dsst.io',
			pass: 'iacqejn6uasd'
		}	
	},
	socket: path.resolve(__dirname, "server.socket"),
	heartbeat: "udp4://status.dsst.io:30826"
};

// ellipse instance
var app = ellipse();

// nodemailer instance
var mailer = nodemailer.createTransport(config.smtp);

// use body parser
app.use(bodyparser.urlencoded({ extended: false }));

// index path
app.post("/feedback", function(req, res){
	
	// spam trap
	if (req.body.url && req.body.url !== "") return stats.spam++, res.status(200).json(true);
	
	// sanitize
	var data = {
		name: smclean.string(req.body.name, { keepNewLines: false, keepHTML: true, maxLength: 256 }),
		email: smclean.email(req.body.email),
		text: smclean.string(req.body.name, { keepNewLines: true, keepHTML: true, maxLength: 4096 }),
		time: moment().format("YYYY-MM-DD HH:mm:ss")
	}
	
	if (!data.name || !data.email || !data.text) return stats.fail++, res.status(200).json(false);
	
	mailer.sendMail({
		from: "Digital-O-Mat <mailout@dst.io>",
		sender: "mailout@dst.io",
		to: "Sebastian Vollnhals <sv@dsst.io>",
		replyTo: data.email,
		subject: "[feedback] "+data.name+" "+data.time,
		text: [
			"",
			"Datum:  "+data.time,
			"Name:   "+data.name,
			"E-Mail: "+data.email,
			"",
			data.text,
			"",
		].join("\n")
	}, function(err, info){
		if (err) return stats.fail++, res.status(500).json(err)
		return stats.sent++, res.status(200).json(true);
	});
});

// fallback path
app.all("*", function(req, res){
	if (["GET","POST"].indexOf(req.method) < 0) return res.status(405).send("405 - Method not allowed");
	res.status(404).send("404 - Not found.");
});

// listen on socket
(function(fn){
	(function(next){
		fs.exists(config.socket, function(x){
			if (!x) return next();
			fs.unlink(config.socket, function(err){
				if (err) return fn(err);
				next();
			});
		});
	})(function(){
		app.listen(config.socket, function(err) {
			if (err) return fn(err);
			// change socket mode
			fs.chmod(config.socket, 0777, fn);
		});
	});
})(function(err){
	if (err) console.error("unable to listen on socket") || process.exit();
	console.error("listening on socket "+config.socket);
});

// heartbeats
if (config.hasOwnProperty("heartbeat")) {
	var heartbeat = require("nsa")({
		server: config.heartbeat,
		service: "omat-feedback",
		interval: "10s"
	}).start();
	
	// send stats every five minutes
	setInterval(function(){
		heartbeat.send(stats);
	},300000).unref();
	
	process.on("SIGINT", function(){
		heartbeat.end(function(){
			process.exit();
		});
	});

};
