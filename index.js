var udp = require('../../udp')
var xmldoc = require('xmldoc');
var instance_skel = require('../../instance_skel')

var actions = require('./actions')
var feedback = require('./feedback')
var presets = require('./presets')
var setup = require('./setup')
var shared = require('./shared')
var variables = require('./variables')

var debug
var log

var emo_connected = false

var TransponderTxPort = 7000
var TransponderRxPort = 7001
var ControlPort
var NotificationPort
var InformationPort

class instance extends instance_skel {
	constructor(system, id, config) {
		super(system, id, config)
		var self = this

		Object.assign(this, {
			...actions,
			...feedback,
			...presets,
			...setup,
			...shared,
			...variables,
		})

		self.state = {}

		self.activeSubscriptions = {}

		self.actions()
	}

	init() {
		var self = this
		debug = self.debug
		log = self.log
		console.log('made it this far.')
		emo_connected = false

		self.init_variableDefaults()
		self.init_feedbacks()

		updateConfig(self.config)
	}
	destroy() {
		var self = this

		if (self.udpTransponderTx !== undefined) {
			self.udpTransponderTx.destroy()
			delete self.udpTransponderTx
		}

		if (self.udpTransponderRx !== undefined) {
			self.udpTransponderRx.destroy()
			delete self.udpTransponderRx
		}

		if (self.udpControl !== undefined) {
			this.EmotivaUnsubAll()
			self.udpControl.destroy()
			delete self.udpControl
		}

		if (self.udpNotify !== undefined) {
			self.udpNotify.destroy()
			delete self.udpNotify
		}

		if (self.udpInfo !== undefined) {
			self.udpInfo.destroy()
			delete self.udpInfo
		}

		emo_connected = false

		this.debug('Destroying', self.id)
	}
	config_fields() {
		var self = this
		return [
			{
				type: 'text',
				id: 'info',
				width: 12,
				label: 'Information',
				value: 'This module communicates with the Emotiva XMC1 Home Theater System.',
			},
			{
				type: 'textinput',
				id: 'host',
				label: 'XMC1 IP Address',
				width: 6,
				regex: self.REGEX_IP,
			},
		]
	}
	updateConfig(config) {
		var self = this

		self.config = config
		emo_connected = false
		if (self.config.host !== undefined && self.config.host != '') {
		self.init_udp();
		self.EmotivaPing();
		}
	}
	actions(system) {
		var self = this

		this.setActions(this.getActions())
	}
	action(action) {
		var self = this
		var opt = action.options

		switch (action.action) {
			case 'SetPowerMode':
				if (opt.zoneDropdown == 'zone1') {
					self.SendEmotivaControlCommand(opt.powerDropdown, '0')
					setTimeout(() => self.EmotivaQueryProperty('power'), 500)
				} else if (opt.zoneDropdown == 'zone2') {
					self.SendEmotivaControlCommand('zone2_' + opt.powerDropdown, '0')
					setTimeout(() => self.EmotivaQueryProperty('zone2_power'), 500)
				}
				break
			case 'SetSourceInput':
				self.SendEmotivaControlCommand(opt.sourceSelectDropdown, '0')
				setTimeout(() => self.EmotivaQueryProperty('source'), 500)
				break
			case 'SetSourceMode':
				break
			case 'SetSpeakerPreset':
				break
			case 'SetVolume':
				self.SendEmotivaControlCommand('volume', opt.amount)
				setTimeout(() => self.EmotivaQueryProperty('volume'), 500)
				break
			default:
				log('error', 'Unknown action: ' + action.action)
		}
	}

	// This function will only init Transponder ports...
	// other ports are initialized later.
	init_udp() {
		var self = this

		if (self.udpTransponderTx !== undefined) {
			self.udpTransponderTx.destroy()
			delete self.udpTransponderTx
		}

		if (self.udpTransponderRx !== undefined) {
			self.udpTransponderRx.destroy()
			delete self.udpTransponderRx
		}

		self.status(self.STATE_WARNING, 'Initializing Transponder Ports')

		if (self.config.host !== undefined) {
			self.udpTransponderRx = new udp(self.config.host, TransponderRxPort, { bind_port: 7001 })
			self.udpTransponderTx = new udp(self.config.host, TransponderTxPort)

			self.udpTransponderTx.on('error', function (err) {
				debug('TX Network error', err)
				self.status(self.STATE_ERROR, err)
				self.log('error', 'TX Network error: ' + err.message)
			})
			self.udpTransponderRx.on('error', function (err) {
				debug('RX Network error', err)
				self.status(self.STATE_ERROR, err)
				self.log('error', 'RX Network error: ' + err.message)
			})

			// If we get data, thing should be good
			self.udpTransponderRx.on('data', (message, rinfo) => {
				self.ProcessTransponderPacket(self.ab2str(message))
			})
		}
	}
	EmotivaPing() {
		var self = this

		var emoPingBuf = Buffer.from('<?xml version="1.0" encoding="utf-8" ?><emotivaPing protocol="3.0" />', 'latin1')
		self.udpTransponderTx.send(emoPingBuf)

		self.status(self.STATE_WARNING, 'Waiting for Transponder Response')
	}
	EmotivaConnect() {
		var self = this
		//Connect to ControlPort
		if (self.udpControl !== undefined) {
			self.udpControl.destroy()
			delete self.udpControl
		}
		self.udpControl = new udp(self.config.host, ControlPort, { bind_port: ControlPort })
		self.udpControl.on('error', function (err) {
			debug('udpControl Network error', err)
			self.status(self.STATE_ERROR, err)
			self.log('error', 'udpControl Network error: ' + err.message)
		})
		self.udpControl.on('data', (message, rinfo) => {
			self.ProcessControlPacket(self.ab2str(message))
		})

		//Connect to NotificationPort
		if (self.udpNotify !== undefined) {
			self.udpNotify.destroy()
			delete self.udpNotify
		}
		self.udpNotify = new udp(self.config.host, NotificationPort, { bind_port: NotificationPort })
		self.udpNotify.on('error', function (err) {
			debug('udpNotify Network error', err)
			self.status(self.STATE_ERROR, err)
			self.log('error', 'udpNotify Network error: ' + err.message)
		})
		self.udpNotify.on('data', (message, rinfo) => {
			self.ProcessNotificationPacket(self.ab2str(message))
		})
	}
	EmotivaSubscribe() {
		var subscribedProps = Object.keys(this.MONITORED_STATES)

		subscribedProps.forEach((value) => this.SendEmotivaSubscribeRequest(value))
	}
	ProcessTransponderPacket(message) {
		var self = this

		var doc = new xmldoc.XmlDocument(message)
		debug('EMOTIVA TRANSPONDER RESPONSE: ' + doc.toString({ compressed: true }))
		debug(emo_connected)
		self.setVariable('remote-name', doc.valueWithPath('name'))

		if (emo_connected == false) {
			ControlPort = doc.valueWithPath('control.controlPort')
			NotificationPort = doc.valueWithPath('control.notifyPort')
			InformationPort = doc.valueWithPath('control.infoPort')

			self.EmotivaConnect()
			self.EmotivaSubscribe()
			emo_connected = true
			self.status(self.STATE_OK, 'Connected')
			log('info', 'Connected to XMC Device. Device Name: ' + doc.valueWithPath('name'))
			self.checkFeedbacks('source')
		}
	}

	SendControlPacket(message) {
		var self = this

		var emoPingBuf = Buffer.from('<?xml version="1.0" encoding="utf-8" ?>' + message, 'latin1')
		self.udpControl.send(emoPingBuf)
	}
	ProcessControlPacket(message) {
		var self = this
		var doc = new xmldoc.XmlDocument(message)

		if (doc.name == 'emotivaSubscription' || doc.name == 'emotivaUpdate') {
			self.ProcessNotificationPacket(message)
		} else {
			debug('EMO CONTROL PACKET: ' + doc.toString({ compressed: true }))
		}
	}

	SendNotificationPacket(message) {
		var self = this

		var emoPingBuf = Buffer.from('<?xml version="1.0" encoding="utf-8" ?>' + message, 'latin1')
		self.udpNotify.send(emoPingBuf)
	}
	ProcessNotificationPacket(message) {
		var self = this
		var doc = new xmldoc.XmlDocument(message)
		debug(doc.toString({ compressed: true }))
		doc.eachChild(function (node) {
			if (node.attr.name !== undefined && node.attr.name !== '') {
				self.state[node.attr.name] = node.attr.value
				self.setVariable(node.attr.name, node.attr.value)

				if (node.attr.name in self.feedbackDefs) {
					self.checkFeedbacks(node.attr.name)
				}
			}
		})
	}

	SendEmotivaControlCommand(command, value) {
		var self = this
		var cmdlet = '<emotivaControl>' + '<' + command + ' value="' + value + '" ack="yes" />' + '</emotivaControl>'
		self.debug(cmdlet + 'was sent to control port.')
		self.SendControlPacket(cmdlet)
	}
	SendEmotivaSubscribeRequest(parameter) {
		var self = this
		var cmdlet = '<emotivaSubscription protocol="3.0">' + '<' + parameter + ' />' + '</emotivaSubscription>'
		debug(cmdlet)
		self.SendControlPacket(cmdlet)
		self.activeSubscriptions[parameter] = true
	}
	SendEmotivaUnsubscribeRequest(parameter) {
		var self = this
		var cmdlet = '<emotivaUnsubscribe>' + '<' + parameter + ' />' + '</emotivaUnsubscribe>'
		debug(cmdlet)
		self.SendControlPacket(cmdlet)
		self.activeSubscriptions[parameter] = false
	}
	EmotivaUnsubAll() {
		var self = this
		Object.keys(self.activeSubscriptions).map((key, value) => self.SendEmotivaUnsubscribeRequest(key))
	}
	EmotivaQueryProperty(parameter) {
		var self = this
		var cmdlet = '<emotivaUpdate protocol="3.0">' + '<' + parameter + ' />' + '</emotivaUpdate>'
		self.SendControlPacket(cmdlet)
	}

	ab2str(buf) {
		return String.fromCharCode.apply(null, new Uint16Array(buf))
	}
}

exports = module.exports = instance
