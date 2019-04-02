$(document).ready(function () {

	// number of maximum divergence
	var MAXDIV = 2

	// consent, neutral, dissent
	var keys = ["abgelehnt", "neutral/nicht eindeutig", "zugestimmt"] // 0, 1, 2

	var $window = $(window)
	var $body = $("body")

	// check view
	var mobile = ($window.width() >= 960) ? false : true
	$body.toggleClass("mobile", mobile)
	// check view after resizing
	$window.resize(function () {
		if (mobile && $window.width() >= 960) mobile = false, $body.toggleClass("mobile", mobile)
		if (!mobile && $window.width() < 960) mobile = true, $body.toggleClass("mobile", mobile)
	})

	// template
	var tmpl = {
		questions: $("#tmpl-questions").html(),
		result: $("#tmpl-result").html(),
	}

	// render questions/statements
	$("#questions").html(Mustache.render(tmpl.questions, {
		question: data.questions.map(function (question, id) {
			return {
				id: id,
				label: question.title,
				question: question.description,
				links: question.votewatch,
				anyInfo: question.votewatch[0].link || question.background[0].link,
				hasInfotext: question.background.length,
				infotext: question.background,
				terms: question.terms,
				num: (id + 1)
			}
		})
	}))

	// menu
	$("#menu .sub-pages a").click(function (evt) {
		evt.preventDefault()
		$("#header").removeClass("show-menu")
		$("#app").attr("class", "show-" + $(this).attr("data-show"))
		if (mobile) scroll(($("#" + $(this).attr("data-show")).offset().top - 100), 200)
	})

	// logo to home
	$("#logo").bind("keypress click", function (evt) {
		evt.preventDefault()
		$("#header").removeClass("show-menu")
		$("#app").attr("class", "show-intro")
		if (mobile) scroll(($("#intro").offset().top - 90), 200)
	})

	// activate button
	$("#activate").click(function (evt) {
		evt.preventDefault()
		$("#app").attr("class", "show-questionnaire")
		if (mobile) scroll(($("#questionnaire").offset().top - 70), 200)
	})

	// calculate button
	$("#calculate").click(function (evt) {
		// calculate result and scroll to it afterwards 
		calculate(function () {
			scroll(($("#result").offset().top - 70), 200)
		})
	})

	// burger menu
	$("#burger").click(function (evt) {
		evt.preventDefault()
		$("#header").toggleClass("show-menu")
	})

	// show more/less info
	$(".more-info-button, .less-info-button").click(function (evt) {
		evt.preventDefault()
		$(this).parent().next().toggleClass("show-more-info")
		if ($(this).attr("class") === 'more-info-button') {
			$(this).next().css("display", "inline")
		} else {
			$(this).prev().css("display", "inline")
		}
		$(this).css("display", "none")
	})


	// main function
	function calculate(callback) {

		// prepare result object
		var result = {
			// flatten answers
			answers: $("#questions").serializeArray().reduce(function (user_selection, question) {
				// assemble array with selected values 
				user_selection[parseInt(question.name.replace(/[^0-9]+/g, ''), 10)] = parseInt(question.value, 10)
				return user_selection
			}, Array.apply(null, Array(data.questions.length)).map(function () { //TODO
				return null
			})),

			// empty comparison array
			// TODO
			comparison: Array.apply(null, Array(data.parties.length)).map(function () {
				return 0
			}),

			// transform answer data to templatable data structure
			detail: []
		}

		// calculate score
		result.answers.forEach(function (answer_user, i) {
			// ignore not-given answers
			if (answer_user === null) return

			var answers = data.questions.map(function (question) {
				return question.answers
			})

			answers[i].forEach(function (answer, j) {
				// check if results are present for corresponding answer
				var isEmpty = Object.values(answer.voting.results).every(function (result) {
					return result === null || result === ''
				})
				if (isEmpty) return

				// calc result of votings
				var answer_party = calcResult(answer.voting.results)

				// calculate divergence
				result.comparison[j] += (MAXDIV - Math.abs(answer_party - answer_user))
			})
		})

		// calculate maximum score of statements selected by a user
		var max = result.answers.filter(function (answer) {
			return answer !== null
		}).length * MAXDIV

		// transform comparison into templatable data structure and sort by score
		result.comparison = result.comparison.map(function (score, party_id) {
			// TODO check mapping to party
			return {
				score: score,
				percent: (Math.round((score / max) * 100) || 0).toString(),
				width: (((score / max) * 100) || 0).toFixed(1),
				party: data.parties[party_id].name,
				party_short: data.parties[party_id].short_name,
				party_long: data.parties[party_id].long_name
			}
		}).sort(function (a, b) {
			return (b.score - a.score)
		})

		// prepare detailed answers
		// TODO check calculation
		result.detail = data.questions.map(function (question, i) {
			return {
				id: i,
				num: (i + 1),
				label: question.name,
				question: question.description,
				answers: [2, 1, 0].map(function (a) {
					return {
						selected: (result.answers[i] === a),
						answer_label: keys[a],
						answer_type: a,
						parties: data.questions.map(function (question) {
							return question.answers
						})[i].map(function (party, i) { // TODO
							var results = party.voting.results
							var delegates_total = results.for+results.against + results.abstained + results.absent

							var isEmpty = Object.values(results).every(function (result) {
								return result === null || result === ''
							})
							if (!isEmpty) {
								return {
									result: calcResult(results),
									explanation: party.voting.explanation,
									results: results,
									party: party.name,
									party_short: data.parties[i].short_name,
									party_long: data.parties[i].long_name,
									delegates: delegates_total
								}
							}
							// filter out null values: use only parties that have voted
						}).filter(function (party) {
							if (!party) return
							return party.result === a
						})
					}
				})
			}
		})

		// render result to document
		$("#result").html(Mustache.render(tmpl.result, result))

		// activate detail
		$(".party.explanation h5", "#detail").bind("keypress click", function (evt) {
			evt.preventDefault()
			$(this).parent().toggleClass("show-explanation")

			// find and render chart using chart.js
			var el = $(this).next().find('canvas')[0]
			var ctx = el.getContext('2d')

			// return if chart is already rendered
			if ($(this).next().find('canvas').hasClass('chartjs-render-monitor')) {
				return
			}

			new Chart(ctx, {
				type: 'doughnut',
				data: {
					labels: [' Dafür gestimmt', ' Dagegen gestimmt', ' Nicht beteiligt', ' Enthalten'],
					datasets: [{
						data: [el.dataset.for, el.dataset.against, el.dataset.absent, el.dataset.abstained],
						backgroundColor: [
							'#9fd773',
							'#cc6c5b',
							'#a5a5a5',
							'#e2e2e2'
						],
						borderWidth: 0
					}]
				},
				options: {
					legend: {
						display: false
					},
					plugins: {
						labels: {
							fontColor: '#000'
						}
					},
					animation: {
						duration: 0
					}
				}
			})
		})

		if (typeof callback === "function") callback()
	}


	// utility functions
	function scroll(to, duration) {
		if (duration < 0) return

		var difference = to - $window.scrollTop()
		var perTick = difference / duration * 10

		this.scrollToTimerCache = setTimeout(function () {
			if (!isNaN(parseInt(perTick, 10))) {
				window.scrollTo(0, $window.scrollTop() + perTick)
				scroll(to, duration - 10)
			}
		}.bind(this), 10)
	}

	function calcResult(results) {
		var voters = results.for + results.against + results.abstained
		// if more delegates were absent than participated at the election return 1 ("no position")
		if (results.absent > voters) return 1

		var proportion_for = results.for / voters
		var proportion_against = results.against / voters
		var proportion_abstained = results.abstained / voters

		switch (true) {
			case (proportion_against + proportion_for <= proportion_abstained) 
				|| (proportion_against === proportion_for) 
				|| (results.absent + results.abstained > results.for + results.against):
				return 1
				break
			case proportion_for > proportion_against:
				return 2
				break
			case proportion_against > proportion_for:
				return 0
				break
			default:
				return null
				break
		}
	}
})