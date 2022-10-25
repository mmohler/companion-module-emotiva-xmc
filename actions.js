require('./shared')

module.exports = {
	getActions() {
		var actions = {}

		actions['SetPowerMode'] = {
			label: 'Set Power Mode',
			options: [this.ZONESELECT_FIELD, this.POWERSELECT_FIELD],
		}

		actions['SetSourceInput'] = {
			label: 'Set Source Input',
			options: [this.SOURCESELECT_FIELD],
		}

		actions['SetSourceMode'] = {
			label: 'Set Source Mode',
			options: [this.SOURCEMODE_FIELD],
		}

		actions['SetSpeakerPreset'] = {
			label: 'Set Speaker Preset',
			options: [this.SPEAKERPRESET_FIELD],
		}

		actions['SetVolume'] = {
			label: 'Set Volume',
			options: [this.NUMERIC_FIELD],
		}

		return actions
	},
}
