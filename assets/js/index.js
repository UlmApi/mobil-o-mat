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
		// check if element is focused 
		// in order to prevent receiving events from radio-buttons when using keyboard navigation
		// var hasFocus = $(this).is(':focus')
		// if (!hasFocus) return

		evt.preventDefault()
		$(this).parent().next().toggleClass("show-more-info")
		if ($(this).attr("class") === 'more-info-button') {
			$(this).next().css("display", "inline")
			$(this).next().focus()
		} else {
			$(this).prev().css("display", "inline")
			$(this).prev().focus()
		}
		$(this).css("display", "none")
	})

	// main function
	function calculate(callback) {

		// data.parties determines the order of party results 
		// (especially relevant when scores are equal)
		// form an array of party names
		var orderOfParties = data.parties.map(function (party) {
			return party.name
		})

		// sort party answers by defined order of parties (see data.js) 
		data.questions.map(function (question) {
			question.answers.sort(function (a, b) {
				return orderOfParties.indexOf(a.name) - orderOfParties.indexOf(b.name)
			})
		})

		// prepare result object
		var result = {
			// flatten answers
			answers: $("#questions").serializeArray().reduce(function (user_selection, question) {
				// assemble array with selected values 
				user_selection[parseInt(question.name.replace(/[^0-9]+/g, ''), 10)] = parseInt(question.value, 10)
				return user_selection
			}, Array.apply(null, Array(data.questions.length)).map(function () {
				return null
			})),

			// empty comparison array
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
				var results = answer.voting.results
				var isEmpty = Object.keys(results).every(function (elem) {
					return results[elem] === null || results[elem] === ''
				})

				if (isEmpty) return

				// calc result of votings
				var answer_party = calcResult(answer.voting.results)

				// calculate divergence
				result.comparison[j] += (MAXDIV - Math.abs(answer_party - answer_user))
			})
		})

		// calculate maximum score for all statements a user has selected
		var max = result.answers.filter(function (answer) {
			return answer !== null
		}).length * MAXDIV

		// transform comparison into templatable data structure and sort by score
		result.comparison = result.comparison.map(function (score, party_id) {
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
						})[i].map(function (party, i) { 
							var results = party.voting.results
							var delegates_total = results.for + results.against + results.abstained + results.absent + results.didntvote

							var isEmpty = Object.keys(results).every(function (elem) {
								return results[elem] === null || results[elem] === ''
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
					labels: [' Dafür gestimmt', ' Dagegen gestimmt', ' Abwesent', ' Enthalten', ' Nicht abgestimmt'],
					datasets: [{
						data: [el.dataset.for, el.dataset.against, el.dataset.absent, el.dataset.abstained, el.dataset.didntvote],
						backgroundColor: [
							'#9fd773', // greenish for 'for'
							'#cc6c5b', // reddish for 'against'
							'#D8D8D8', // light gray for 'absent'
							'#787878', // dark gray 'abstained'
							'#A0A0A0' // gray for 'didn't vote'
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

	// calc statement/result for party
	// determine if an absolute majority for 'in favor' or 'against' exists
	// otherwise: return 'neutral'/'ambiguous'
	function calcResult(results) {
		var voters = results.for + results.against + results.abstained
		var party_members = voters + results.absent + results.didntvote
		var proportion_for = results.for / party_members
		var proportion_against = results.against / party_members
		switch (true) {
			case proportion_for > 0.5:
				return 2
				break
			case proportion_against > 0.5:
				return 0
				break
			default:
				return 1
				break
		}
	}
})