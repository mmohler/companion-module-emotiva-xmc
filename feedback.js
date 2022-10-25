module.exports = {
	init_feedbacks() {
		this.feedbackDefs = {}

		this.feedbackDefs['power'] = {
			label: 'Power State - Zone 1',
			description: 'Allows user to change the foreground or background color based on the power state of zone 1.',
			options: [
				this.FG_COLOR_FIELD(this.rgb(0, 0, 0)),
				this.BG_COLOR_FIELD(this.rgb(255, 255, 0)),
				this.POWERSELECT_FIELD,
			],
			callback: (feedback, bank) => {
				var feedbackLabel = this.POWERSELECT_FIELD.choices.find((o) => {
					return o.id == feedback.options.powerDropdown
				}).label
				if (this.state['power'] == feedbackLabel) {
					return {
						color: feedback.options.fg,
						bgcolor: feedback.options.bg,
					}
				}
			},
		}

		this.feedbackDefs['mode'] = {
			label: 'Mode',
			description: 'Allows user to change the foreground or background color based on the mode of zone 1.',
			options: [
				this.FG_COLOR_FIELD(this.rgb(0, 0, 0)),
				this.BG_COLOR_FIELD(this.rgb(255, 255, 0)),
				this.SOURCEMODE_FIELD,
			],
			callback: (feedback, bank) => {
				var feedbackLabel = this.SOURCEMODE_FIELD.choices.find((o) => {
					return o.id == feedback.options.sourceModeDropdown
				}).label
				if (this.state['mode'] == feedbackLabel) {
					return {
						color: feedback.options.fg,
						bgcolor: feedback.options.bg,
					}
				}
			},
		}

		this.feedbackDefs['source'] = {
			label: 'Source',
			description: 'Allows user to change the foreground or background color based on the source of zone 1.',
			options: [
				this.FG_COLOR_FIELD(this.rgb(0, 0, 0)),
				this.BG_COLOR_FIELD(this.rgb(255, 255, 0)),
				this.SOURCESELECT_FIELD,
			],
			callback: (feedback, bank) => {
				//var feedbackLabel = this.SOURCESELECT_FIELD.choices.find(o => {return o.id==feedback.options.sourceSelectDropdown}).label;
				this.debug(feedback.options.sourceSelectDropdown)
				this.debug(this.state[feedback.options.sourceSelectDropdown])
				if (this.state['source'] == this.state[feedback.options.sourceSelectDropdown]) {
					return {
						color: feedback.options.fg,
						bgcolor: feedback.options.bg,
					}
				}
			},
		}

		this.feedbackDefs['volume'] = {
			label: 'Volume',
			description: 'Red = -100dB : Green = +20dB',
			callback: (feedback, bank) => {
				var volToCol = (this.state['volume'] + 96) * 2.41 // now ranged 0-255(ish)
				return {
					bgcolor: this.rgb(255 - volToCol, volToCol, 0),
				}
			},
		}

		this.setFeedbackDefinitions(this.feedbackDefs)

		this.debug(this.feedbackDefs)
	},
}
