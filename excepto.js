#!/usr/bin/env node

/* 
	excepto patronum! 
	a small, vanilla node script to post uncaught exceptions to slack
*/

var https = require("https");
var querystring = require("querystring");

function ent(str){
	return (str||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/&amp;([a-z0-9]{2,7});/g,"&$1;");
};

process.on("uncaughtException",function(e){
	try {
		var payload = querystring.stringify({
			payload: JSON.stringify({
				channel: "#crash",
				username: "exceptionbot",
				icon_emoji: ":boom:",
				attachments: [{
					pretext: "Error in `"+require.main.filename+"`:",
					text: ent(e.message)+"\n\n```"+ent(e.stack)+"```\n",
					ts: Math.round(Date.now()/1000),
					mrkdwn_in: ["text","pretext"],
					color: "#FF0000"
				}]
			})
		});
	} catch (e){
		process.exit();
	}

	var r = https.request({
		hostname: 'hooks.slack.com',
		port: 443,
		path: '/services/T0J7BCY5N/B1NS000BY/S6lLhoeoA7bY1uYfRM5RQTmm',
		method: 'POST',
		headers: {
			'Content-Type': 'application/x-www-form-urlencoded',
			'Content-Length': Buffer.byteLength(payload)
		}
	}, function(res){
		process.exit();
	})
	r.on('error', function(){ process.exit(); });
	r.write(payload);
	r.end()
	
});
