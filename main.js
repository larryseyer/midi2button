import { InstanceBase, runEntrypoint, InstanceStatus, combineRgb } from '@companion-module/base'
import { MidiHandler } from './midi.js'
import { upgrades } from './upgrades.js'
import http from 'http'

class Midi2ButtonsInstance extends InstanceBase {
	constructor(internal) {
		super(internal)
		this.midiHandler = null
		this.mappings = []
		this.midiPorts = []
		this.midiPortChoices = [{ id: -1, label: 'Select MIDI Port' }]
	}

	async init(config) {
		this.config = config
		this.updateStatus(InstanceStatus.Connecting)

		// Initialize variables
		this.setVariableDefinitions([
			{ variableId: 'last_triggered_page', name: 'Last Triggered Page' },
			{ variableId: 'last_triggered_row', name: 'Last Triggered Row' },
			{ variableId: 'last_triggered_col', name: 'Last Triggered Column' },
			{ variableId: 'last_triggered_button', name: 'Last Triggered Button Number' },
			{ variableId: 'trigger_count', name: 'Trigger Count' },
		])

		// Initialize actions - empty for now
		this.setActionDefinitions({})

		// Initialize feedbacks
		this.setFeedbackDefinitions({
			midi_active: {
				type: 'boolean',
				name: 'MIDI Active',
				defaultStyle: {
					bgcolor: combineRgb(0, 255, 0),
					color: combineRgb(0, 0, 0),
				},
				options: [],
				callback: () => {
					return this.midiHandler?.isConnected || false
				},
			},
		})

		this.triggerCount = 0

		// Initialize defaults
		if (!this.config.mappingCount || this.config.mappingCount < 1) {
			this.config.mappingCount = 5
		}

		// Initialize MIDI
		try {
			this.midiHandler = new MidiHandler(this)
			await this.midiHandler.refreshPorts()
			this.log('info', `Found ${this.midiPorts?.length || 0} MIDI ports`)

			// Connect MIDI if port selected
			if (this.config.midi_port_index >= 0) {
				await this.midiHandler.init(this.config)
			}
		} catch (error) {
			this.log('warn', `MIDI init: ${error.message}`)
		}

		// Parse mappings
		this.parseMappings()

		this.updateStatus(InstanceStatus.Ok)
	}

	parseMappings() {
		this.mappings = []
		const mappingCount = this.config.mappingCount || 5

		for (let i = 0; i < mappingCount; i++) {
			if (this.config[`m${i}_on`]) {
				// Parse location string (page/row/column)
				let page = 1,
					row = 0,
					column = 0
				const location = this.config[`m${i}_location`] || `1/${Math.floor(i / 8)}/${i % 8}`
				const parts = location.split('/')
				if (parts.length === 3) {
					page = parseInt(parts[0]) || 1
					row = parseInt(parts[1]) || 0
					column = parseInt(parts[2]) || 0
				}

				const mapping = {
					enabled: true,
					type: this.config[`m${i}_type`] || 'note',
					channel: this.config[`m${i}_ch`] || 1,
					value: this.config[`m${i}_val`] || 60,
					trigger: this.config[`m${i}_trigger`] || 'on',
					page: page,
					row: row,
					column: column,
				}
				this.mappings.push(mapping)
			}
		}

		this.log('info', `Loaded ${this.mappings.length} mappings`)
	}

	processMidiMessage(channel, type, noteOrCC, value) {
		this.log('debug', `MIDI received: Ch${channel} ${type} ${noteOrCC} vel${value}`)
		this.log('debug', `Active mappings: ${JSON.stringify(this.mappings)}`)

		// Determine if this is a note on or note off
		const isNoteOn = type === 'note' && value > 0
		const isNoteOff = type === 'note' && value === 0

		// Find matching mappings
		const matchingMappings = this.mappings.filter((m) => {
			if (!m.enabled) return false
			if (m.channel !== 0 && m.channel !== channel) return false
			if (m.type !== type) return false
			if (m.value !== noteOrCC) return false

			// Check trigger mode for note messages
			if (type === 'note') {
				if (m.trigger === 'on' && !isNoteOn) return false
				if (m.trigger === 'off' && !isNoteOff) return false
				// 'both' triggers on both note on and note off
			}

			return true
		})

		// Trigger buttons
		if (matchingMappings.length === 0) {
			this.log('debug', `No matching mappings found`)
		} else {
			matchingMappings.forEach((m) => {
				this.log('info', `MIDI match: Ch${channel} ${type} ${noteOrCC} -> ${m.page}/${m.row}/${m.column}`)
				// Use internal Companion function to press button
				this.pressButton(m.page, m.row, m.column)
			})
		}
	}

	processMidiProgramChange(channel, bank, program) {
		// Find matching mappings
		const matchingMappings = this.mappings.filter((m) => {
			if (!m.enabled) return false
			if (m.type !== 'program') return false
			if (m.channel !== 0 && m.channel !== channel) return false
			if (m.value !== program) return false
			return true
		})

		// Trigger buttons
		matchingMappings.forEach((m) => {
			this.log('info', `Program Change: Ch${channel} Prog${program} -> ${m.page}/${m.row}/${m.column}`)
			this.pressButton(m.page, m.row, m.column)
		})
	}

	pressButton(page, row, column) {
		this.log('info', `MIDI triggered: Page ${page}, Row ${row}, Col ${column}`)

		// Use Companion's HTTP API to press the button
		const host = this.config.http_host || '127.0.0.1'
		const port = this.config.http_port || 8000
		const path = `/api/location/${page}/${row}/${column}/press`

		const options = {
			hostname: host,
			port: port,
			path: path,
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
		}

		const req = http.request(options, (res) => {
			if (res.statusCode === 200 || res.statusCode === 204) {
				this.log('debug', `Button pressed successfully: ${host}:${port}${path}`)
			} else {
				this.log('warn', `Button press failed: ${res.statusCode}`)
			}
		})

		req.on('error', (err) => {
			this.log('error', `Failed to press button: ${err.message}`)
		})

		req.end()

		// Also update variables for monitoring
		this.setVariableValues({
			last_triggered_page: page,
			last_triggered_row: row,
			last_triggered_col: column,
			trigger_count: (this.triggerCount || 0) + 1,
		})
		this.triggerCount = (this.triggerCount || 0) + 1
	}

	async destroy() {
		if (this.midiHandler) {
			await this.midiHandler.destroy()
		}
	}

	async configUpdated(config) {
		this.config = config
		this.parseMappings()

		// Reconnect MIDI if needed
		if (this.midiHandler) {
			await this.midiHandler.destroy()
			this.midiHandler = null
		}

		try {
			this.midiHandler = new MidiHandler(this)
			await this.midiHandler.refreshPorts()
			if (this.config.midi_port_index >= 0) {
				await this.midiHandler.init(this.config)
			}
		} catch (error) {
			this.log('error', `MIDI reinit: ${error.message}`)
		}

		this.updateStatus(InstanceStatus.Ok)
	}

	getConfigFields() {
		const fields = [
			{
				type: 'static-text',
				id: 'info',
				label: '',
				width: 12,
				value: '<h3>MIDI to Button Trigger</h3>',
			},
			{
				type: 'dropdown',
				id: 'midi_port_index',
				label: 'MIDI Port',
				width: 12,
				default: -1,
				choices: this.midiPortChoices,
			},
			{
				type: 'textinput',
				id: 'http_host',
				label: 'Companion IP Address',
				width: 8,
				default: '127.0.0.1',
				tooltip: 'IP address where Companion is running (usually 127.0.0.1)',
			},
			{
				type: 'number',
				id: 'http_port',
				label: 'HTTP Port',
				width: 4,
				default: 8000,
				min: 1,
				max: 65535,
				tooltip: 'Companion HTTP API port (default 8000)',
			},
			{
				type: 'number',
				id: 'mappingCount',
				label: 'Number of Rules',
				width: 12,
				default: 5,
				min: 1,
				max: 20,
			},
			{
				type: 'static-text',
				id: 'header',
				label: '',
				width: 12,
				value: '<h4 style="margin-top: 20px;">Mapping Rules</h4>',
			},
		]

		// Add header row
		// Add header row with proper widths that sum to 12
		fields.push(
			{
				type: 'static-text',
				id: 'header_enabled',
				label: '',
				width: 1,
				value: '<b>On</b>',
			},
			{
				type: 'static-text',
				id: 'header_type',
				label: '',
				width: 2,
				value: '<b>Type</b>',
			},
			{
				type: 'static-text',
				id: 'header_ch',
				label: '',
				width: 2,
				value: '<b>Channel</b>',
			},
			{
				type: 'static-text',
				id: 'header_val',
				label: '',
				width: 2,
				value: '<b>Value</b>',
			},
			{
				type: 'static-text',
				id: 'header_trigger',
				label: '',
				width: 2,
				value: '<b>Trigger</b>',
			},
			{
				type: 'static-text',
				id: 'header_location',
				label: '',
				width: 3,
				value: '<b>Button (P/R/C)</b>',
			}
		)

		// Add simple mapping fields
		const mappingCount = this.config?.mappingCount || 5
		for (let i = 0; i < mappingCount; i++) {
			fields.push(
				{
					type: 'checkbox',
					id: `m${i}_on`,
					label: '',
					width: 1,
					default: false,
				},
				{
					type: 'dropdown',
					id: `m${i}_type`,
					label: '',
					width: 2,
					default: 'note',
					choices: [
						{ id: 'note', label: 'Note' },
						{ id: 'cc', label: 'CC' },
						{ id: 'program', label: 'Program' },
					],
				},
				{
					type: 'number',
					id: `m${i}_ch`,
					label: '',
					width: 2,
					default: 1,
					min: 0,
					max: 16,
					tooltip: '0 = All channels',
				},
				{
					type: 'number',
					id: `m${i}_val`,
					label: '',
					width: 2,
					default: 60 + i,
					min: 0,
					max: 127,
					tooltip: 'Note/CC/Program number',
				},
				{
					type: 'dropdown',
					id: `m${i}_trigger`,
					label: '',
					width: 2,
					default: 'on',
					choices: [
						{ id: 'on', label: 'On' },
						{ id: 'off', label: 'Off' },
						{ id: 'both', label: 'Both' },
					],
					tooltip: 'Trigger on Note On, Note Off, or Both',
				},
				{
					type: 'textinput',
					id: `m${i}_location`,
					label: '',
					width: 3,
					default: `1/${Math.floor(i / 8)}/${i % 8}`,
					tooltip: 'Button location: page/row/column (e.g., 1/0/0)',
					regex: '/^\\d+\\/\\d+\\/\\d+$/',
				}
			)
		}

		return fields
	}
}

runEntrypoint(Midi2ButtonsInstance, upgrades)
