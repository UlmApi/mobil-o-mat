$(document).ready(function(){
	// number of maximum divergence
	var MAXDIV = 2;

	// party matrix
	var parties = {
		"afd": ["AfD", "Alternative für Deutschland"],
		"cdu": ["CDU", "Christlich Demokratische Union Deutschland"],
		"csu": ["CSU", "Christlich-Soziale Union in Bayern e.V."],
		"partei": ["Die PARTEI", "Die PARTEI"],
		"piraten": ["Piraten", "Piratenpartei Deutschland"],
		"familien": ["Familien-Partei", "Familien-Partei Deutschlands"],
		"fdp": ["FDP", "Freie Demokratische Partei"],
		"freie": ["Freie Wähler"],
		"gruene": ["Grüne", "Bündnis 90/Die Grünen"],
		"linke": ["Linke", "DIE LINKE."],
		"npd": ["NPD", "Nationaldemokratische Partei Deutschlands"],
		"oedp": ["ÖDP", "Ökologisch-Demokratische Partei"], 
		"spd": ["SPD", "Sozialdemokratische Partei Deutschlands"],
		"allianz": ["ALFA", "Allianz für Fortschritt und Aufbruch"],
		"independent": ["Unabhängig", "Unabhängig"]
	};
	
	var keys = ["Ablehnung","Neutral","Zustimmung"];

	// caches
	var $window = $(window);
	var $body = $("body");

	// check view
	var mobile = ($window.width() >= 960) ? false : true;
	$body.toggleClass("mobile", mobile);
	$window.resize(function(){
		if (mobile && $window.width() >= 960) mobile = false, $body.toggleClass("mobile", mobile);
		if (!mobile && $window.width() < 960) mobile = true, $body.toggleClass("mobile", mobile);
	});

	// template
	var tmpl = {
		questions: $("#tmpl-questions").html(),
		result: $("#tmpl-result").html(),
	};

	// render questions
	$("#questions").html(Mustache.render(tmpl.questions, { question: window.omatdata.questions.map(function(data,id){
		return { id: id, label: data[0], question: data[1], link: window.omatdata.links[id], infotext: window.omatdata.infotext[id], num: (id+1) };
	}) } ));
	
	// activate questions
	$("input[type=radio]","#questions").click(function(evt){
		// if all questions are answered
		if ($("#questions").serializeArray().length === window.omatdata.questions.length) {
			// go straight to evaluation
			calculate();
			scroll($("#result").offset().top, 200);
		} else if (mobile) {
			// go to next question
			var nxt = $(this).parents(".question").next();
			if (nxt.length > 0) scroll(nxt.offset().top+(nxt.height()/2)-($window.height()/2),200);
		}
	});

	// activate more-links
	$("a.more","#questions").click(function(evt){
		window.open($(this).attr("href"), '_blank');
		evt.preventDefault();
	});

	// menu
	$("a", "#menu").click(function(evt){
		evt.preventDefault();
		$("#header").removeClass("show-menu");
		$("#app").attr("class","show-"+$(this).attr("data-show"));
		if (mobile) scroll(($("#"+$(this).attr("data-show")).offset().top - 100), 200);
	});
	
	// logo to home
	$("#logo").click(function(evt){
		evt.preventDefault();
		$("#header").removeClass("show-menu");
		$("#app").attr("class","show-intro");
		if (mobile) scroll(($("#intro").offset().top - 90), 200);
	});
	
	// activate button
	$("#activate").click(function(evt){
		evt.preventDefault();
		$("#app").attr("class","show-questionnaire");
		if (mobile) scroll(($("#questionnaire").offset().top - 70), 200);
	});
	
	// calculate button
	$("#calculate").click(function(evt){
		calculate(function(){
			scroll(($("#result").offset().top-70), 200);
		});
	});
	
	// burger menu
	$("#burger").click(function(evt){
		evt.preventDefault();
		$("#header").toggleClass("show-menu");
	});

	// show more/less info
	$(".more-info-button, .less-info-button").click(function (evt) {
		evt.preventDefault();
		$(this).parent().next().toggleClass("show-more-info");
		if ($(this).attr("class") === 'more-info-button') {
			$(this).next().css("display", "inline");
		} else {
			$(this).prev().css("display", "inline");
		}
		$(this).css("display", "none");
	});

	function calculate(fn){
		// prepare result array
		var result = {

			// flatten answers
			answers: $("#questions").serializeArray().reduce(function(p,c){
				p[parseInt(c.name.replace(/[^0-9]+/g,''),10)] = parseInt(c.value,10);
				return p;
			}, Array.apply(null, Array(window.omatdata.questions.length)).map(function(){ return null }) ),
			
			// empty comparison array
			comparison: Array.apply(null, Array(window.omatdata.parties.length)).map(function(){ return 0 }),
			
			/*
			.reduce(function(p,c){
				p[c[0]] = 0;
				return p;
			},{})
			*/

			// transform answer data to templatable data structure
			detail: []
		};
		
		// calculate score
		result.answers.forEach(function(v,i){

			// ignore not-given answers
			if (v === null) return;

			window.omatdata.answers[i].forEach(function(a,j){

				// if no valid answer from party, use max divergence
				if (typeof a[0] !== "number" || a[0] < 0 || a[0] > MAXDIV) return (result.comparison[j] += MAXDIV);

				// else calculate divergence
				result.comparison[j] += (MAXDIV-Math.abs(a[0]-v));
			});
		});
		
		// calculate maximum score
		var max = (result.answers.filter(function(v){ return v !== null }).length*MAXDIV);
		
		// transform comparison into templatable data structure and sort by score
		result.comparison = result.comparison.map(function(c,i){
			return {
				score: c,
				percent: (Math.round((c/max)*100)||0).toString(),
				width: (((c/max)*100)||0).toFixed(1),
				party: window.omatdata.parties[i],
				party_short: parties[window.omatdata.parties[i]][0],
				party_long: parties[window.omatdata.parties[i]][1]
			};
		}).sort(function(a,b){
			return (b.score-a.score);
		});

		// prepare detailed answers
		result.detail = window.omatdata.answers.map(function(v,i){
			return {
				id: i,
				num: (i+1),
				label: window.omatdata.questions[i][0],
				question: window.omatdata.questions[i][1],
				answers: [2,1,0].map(function(a){
					return {
						selected: (result.answers[i] === a),
						answer_label: keys[a],
						answer_type: a,
						parties: window.omatdata.answers[i].map(function(pa,j){
							return {
								answer: pa[0],
								has_explanation: (pa[1]) ? true : false,
								explanation: pa[1] || null,
								party: window.omatdata.parties[j],
								party_short: parties[window.omatdata.parties[j]][0],
								party_long: parties[window.omatdata.parties[j]][1]
							};
						}).filter(function(pa){ return pa.answer === a })
					};
				})
			};
		});
		
		// render result to document
		$("#result").html(Mustache.render(tmpl.result, result));
		
		// activate detail
		$(".party.explanation h5","#detail").click(function(evt){
			evt.preventDefault();
			$(this).parent().toggleClass("show-explanation");
		});

		if (typeof fn === "function") fn();
	};
	
	function scroll(to, duration) {
		if (duration < 0) return;

		var difference = to - $window.scrollTop();
		var perTick = difference / duration * 10;

		this.scrollToTimerCache = setTimeout(function() {
			if (!isNaN(parseInt(perTick, 10))) {
				window.scrollTo(0, $window.scrollTop() + perTick);
				scroll(to, duration - 10);
			}
		}.bind(this), 10);
	};
	
	// $("a","#social").click(function(evt){
	// 	if (mobile || !/^https?:\/\//.test($(this).attr("href"))) return;
	// 	evt.preventDefault();
	// 	window.open($(this).attr("href"),"share","width=500,height=400,status=no,scrollbars=no,resizable=no,menubar=no,toolbar=no");
	// });
});
