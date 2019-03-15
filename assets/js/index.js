$(document).ready(function(){

	// number of maximum divergence
	var MAXDIV = 2;
	
	var keys = ["abgelehnt", "neutral/nicht eindeutig", "zugestimmt"]; // 0, 1, 2

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
	$("#questions").html(Mustache.render(tmpl.questions, {
		question: questions.map(function(question, id) {
			return {
				id: id,
				label: question.title,
				question: question.description,
				links: question.votewatch,
				anyInfo: question.votewatch[0].link.length || question.background[0].link.length,
				hasInfotext: question.background.length,
				infotext: question.background,
				terms: question.terms,
				num: (id + 1)
			};
		})
	}));
	
	// activate questions
	// $("input[type=radio]", "#questions").click(function(evt){
	// 	// if all questions are answered
	// 	if ($("#questions").serializeArray().length === questions.length) {
	// 		// go straight to evaluation
	// 		calculate();
	// 		scroll($("#result").offset().top, 200);
	// 	} else if (mobile) {
	// 		// go to next question
	// 		var nxt = $(this).parents(".question").next();
	// 		if (nxt.length > 0) scroll(nxt.offset().top+(nxt.height()/2)-($window.height()/2),200);
	// 	}
	// });

	// activate more-links
	$("a.more","#questions").click(function(evt){
		window.open($(this).attr("href"), '_blank');
		evt.preventDefault();
	});

	// menu
	$("#menu .sub-pages a").click(function(evt) {
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
			answers: $("#questions").serializeArray().reduce(function(p, c) {
				p[parseInt(c.name.replace(/[^0-9]+/g,''), 10)] = parseInt(c.value, 10);
				return p;
			}, Array.apply(null, Array(questions.length)).map(function() { return null }) ),
			
			// empty comparison array
			comparison: Array.apply(null, Array(parties.length)).map(function(){ return 0 }),

			// transform answer data to templatable data structure
			detail: []
		};
		
		// calculate score
		result.answers.forEach(function(v, i){

			// TODO what's v?

			// ignore not-given answers
			if (v === null) return;

			var answers = questions.map(question => question.answers)

			answers[i].forEach(function(answer, j) {

				// TODO check
				if (answer.voting.result === null || answer.voting.result.length === 0) {
					return;
				}

				var answer_party = Number(answer.voting.result);

				// if no valid answer from party, use max divergence
				// TODO check if needed
				if (typeof answer_party !== "number" || answer_party < 0 || answer_party > MAXDIV) {
					return (result.comparison[j] += MAXDIV);
				}

				// else calculate divergence
				result.comparison[j] += (MAXDIV - Math.abs(answer_party - v));
			});
		});
		
		// calculate maximum score
		var max = (result.answers.filter(function(v){ return v !== null }).length * MAXDIV);

		// transform comparison into templatable data structure and sort by score
		result.comparison = result.comparison.map(function(c, i) {
			// TODO check mapping to party
			return {
				score: c,
				percent: (Math.round((c / max) * 100) || 0).toString(),
				width: (((c / max) * 100) || 0).toFixed(1),
				party: parties[i].name,
				party_short: parties[i].short_name,
				party_long: parties[i].long_name
			};
		}).sort(function(a, b) {
			return a.party_short.localeCompare(b.party_short, 'de', {
				ignorePunctuation: true
			})
		}).sort(function(a, b) {
			return (b.score - a.score);
		});

		// prepare detailed answers
		// TODO use only parties that have voted
		// TODO check calculation
		result.detail = questions.map(function(question, i) {
			return {
				id: i,
				num: (i+1),
				label: question.name,
				question: question.description,
				answers: [2,1,0].map(function(a) {
					return {
						selected: (result.answers[i] === a),
						answer_label: keys[a],
						answer_type: a,
						parties: questions.map(function(question) {return question.answers})[i].map(function(party, j) {
							if (party.voting.result.length > 0) {
								var pro = Number(party.voting.results.for) / Number(party.voting.delegates) * 100;
								pro = Math.round(pro * 100) / 100;
								var absent = Number(party.voting.results.absent) / Number(party.voting.delegates) * 100;
								absent = Math.round(absent * 100) / 100;
								var abstained = Number(party.voting.results.abstained) / Number(party.voting.delegates) * 100;
								abstained = Math.round(abstained * 100) / 100;
								var against = Number(party.voting.results.against) / Number(party.voting.delegates) * 100;
								against = Math.round(against * 100) / 100;
								return {
									answer: party.voting.result,
									has_explanation: (party.voting.result.length > 0) ? true : false,
									explanation: party.voting || null,
									party: party.name,
									party_short: parties[party.id - 1].short_name, // TODO
									party_long: parties[party.id - 1].long_name, // TODO
									// calculate for bar chart visualization
									pro: pro + '%',
									against: against + pro + '%',
									absent: against + pro + absent + '%',
									abstained: against + pro + absent + abstained + '%'
								};
							}
						}).sort(function (a, b) {
							return a.party_short.localeCompare(b.party_short, 'de', {
								ignorePunctuation: true
							})
						})
						.filter(function(party) { // TODO runs too often
							if (!party) return; 
							return party.answer == a
						})
					};
				})
			};
		});
		
		// render result to document
		$("#result").html(Mustache.render(tmpl.result, result));
		
		// activate detail
		$(".party.explanation h5", "#detail").click(function(evt){
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
