import { InstanceBase, runEntrypoint, InstanceStatus } from '@companion-module/base'
import { getActions } from './actions.js'
import { getFeedbacks } from './feedbacks.js'
import { getVariableDefinitions } from './variables.js'
import { getPresets } from './presets.js'
import { upgrades } from './upgrades.js'
import { MidiHandler } from './midi.js'
import { OscHandler } from './osc.js'

class Midi2OscInstance extends InstanceBase {
	constructor(internal) {
		super(internal)

		// Initialize with empty/default values
		this.midiHandler = null
		this.oscHandler = null
		this.mappings = []
		this.midiPorts = []
		this.midiPortChoices = [{ id: -1, label: 'None - Select a MIDI port' }]
		this.stats = {
			messagesReceived: 0,
			messagesSent: 0,
			errors: 0,
		}
		this.lastMidiMessage = null
		this.lastOscMessage = null
		this.oscDisplayTimeout = null
	}

	async init(config) {
		this.log('info', 'MIDI2OSC: Initializing module')
		this.config = config
		this.updateStatus(InstanceStatus.Connecting)

		// Initialize defaults - always have at least one mapping
		if (!this.config.mappingCount || this.config.mappingCount < 1) {
			this.config.mappingCount = 1
			// Set default values for first mapping if not present
			if (this.config[`mapping_0_enabled`] === undefined) {
				this.config[`mapping_0_enabled`] = false
				this.config[`mapping_0_channel`] = 1
				this.config[`mapping_0_type`] = 'note'
				this.config[`mapping_0_noteOrCC`] = 60
				this.config[`mapping_0_oscIP`] = '127.0.0.1'
				this.config[`mapping_0_oscPort`] = 8000
				this.config[`mapping_0_oscAddress`] = '/midi/note/60'
				this.config[`mapping_0_oscArgs`] = '$(value)'
			}
		}

		// Initialize MIDI handler early to populate port list
		try {
			this.midiHandler = new MidiHandler(this)
			await this.midiHandler.refreshPorts()
			this.log('info', `Found ${this.midiPorts?.length || 0} MIDI ports`)
		} catch (error) {
			this.log('debug', `Early MIDI port detection: ${error.message}`)
		}

		// Initialize OSC handler
		this.oscHandler = new OscHandler(this)
		await this.oscHandler.init(this.config)

		// Parse mappings
		this.parseMappings()

		// Setup UI components
		this.updateActions()
		this.updateFeedbacks()
		this.updateVariableDefinitions()
		this.updatePresets()
		this.updateVariables()

		// Initialize MIDI connection if a port is selected
		if (this.config.midi_port_index !== undefined && this.config.midi_port_index >= 0 && this.midiHandler) {
			try {
				await this.midiHandler.init(this.config)
			} catch (error) {
				this.log('error', `Failed to initialize MIDI: ${error.message}`)
			}
		}

		this.updateStatus(InstanceStatus.Ok)
	}

	parseMappings() {
		this.mappings = []
		const mappingCount = this.config.mappingCount || 0

		// Parse mappings from individual fields
		for (let i = 0; i < mappingCount; i++) {
			const enabled = this.config[`mapping_${i}_enabled`]
			if (enabled) {
				const mapping = {
					enabled: true,
					channel: this.config[`mapping_${i}_channel`] || 1,
					type: this.config[`mapping_${i}_type`] || 'note',
					noteOrCC: this.config[`mapping_${i}_noteOrCC`] || 60,
					oscIP: this.config[`mapping_${i}_oscIP`] || '127.0.0.1',
					oscPort: this.config[`mapping_${i}_oscPort`] || 8000,
					oscAddress: this.config[`mapping_${i}_oscAddress`] || '/midi',
					oscArgs: this.config[`mapping_${i}_oscArgs`] || '$(value)',
				}

				// Validate mapping
				if (mapping.oscAddress && mapping.oscIP && mapping.oscPort) {
					this.mappings.push(mapping)
				}
			}
		}

		this.log('info', `Loaded ${this.mappings.length} MIDI to OSC mappings`)
	}

	updateActions() {
		this.setActionDefinitions(getActions(this))
	}

	updateFeedbacks() {
		this.setFeedbackDefinitions(getFeedbacks(this))
	}

	updateVariableDefinitions() {
		this.setVariableDefinitions(getVariableDefinitions(this))
	}

	updatePresets() {
		this.setPresetDefinitions(getPresets(this))
	}

	updateVariables() {
		this.setVariableValues({
			midi_status: this.midiHandler?.isConnected ? 'Connected' : 'Disconnected',
			midi_port: this.midiHandler?.currentPortName || 'None',
			messages_received: this.stats.messagesReceived,
			messages_sent: this.stats.messagesSent,
			errors: this.stats.errors,
			mappings_count: this.mappings.length,
			last_midi_message: this.getMidiDisplayText(),
			last_osc_message: this.getOscDisplayText(),
		})
	}

	refreshConfigFields() {
		// Update variables which will update the display
		this.updateVariables()

		// Send a websocket message to update the config UI if it's open
		// This is a workaround since Companion doesn't auto-refresh static-text fields
		if (this.config) {
			// Save config to trigger a refresh
			this.saveConfig(this.config)
		}
	}

	processMidiMessage(channel, type, noteOrCC, value) {
		this.stats.messagesReceived++

		// Update last received MIDI message
		this.lastMidiMessage = {
			channel,
			type,
			noteOrCC,
			value,
			timestamp: Date.now(),
		}

		// Find matching mappings
		const matchingMappings = this.mappings.filter((mapping) => {
			if (!mapping.enabled) return false
			if (mapping.channel !== 0 && mapping.channel !== channel) return false
			if (mapping.type !== type) return false
			if (mapping.noteOrCC !== noteOrCC) return false
			return true
		})

		// Update match status for display
		this.lastMidiMessage.hasMatch = matchingMappings.length > 0

		// Update the config fields to refresh the display
		this.refreshConfigFields()

		// Process each matching mapping
		matchingMappings.forEach((mapping) => {
			// Parse OSC arguments with variable substitution
			let oscArgs = mapping.oscArgs
			if (oscArgs) {
				oscArgs = oscArgs.replace(/\$\(value\)/g, value)
				oscArgs = oscArgs.replace(/\$\(channel\)/g, channel)
				oscArgs = oscArgs.replace(/\$\(type\)/g, type)
				oscArgs = oscArgs.replace(/\$\(notecc\)/g, noteOrCC)
			}

			// Send OSC message
			this.oscHandler.sendMessage(mapping.oscIP, mapping.oscPort, mapping.oscAddress, oscArgs)
			this.stats.messagesSent++

			// Store last sent OSC message for display
			this.lastOscMessage = {
				ip: mapping.oscIP,
				port: mapping.oscPort,
				address: mapping.oscAddress,
				args: oscArgs,
				timestamp: Date.now(),
			}

			// Refresh config to show OSC message
			this.refreshConfigFields()

			// Clear OSC display after timeout
			if (this.oscDisplayTimeout) {
				clearTimeout(this.oscDisplayTimeout)
			}
			this.oscDisplayTimeout = setTimeout(() => {
				this.lastOscMessage = null
				this.refreshConfigFields() // Refresh UI
			}, 3000)
		})

		this.updateVariables()
	}

	async destroy() {
		if (this.oscDisplayTimeout) {
			clearTimeout(this.oscDisplayTimeout)
		}
		if (this.midiHandler) {
			await this.midiHandler.destroy()
		}
		if (this.oscHandler) {
			await this.oscHandler.destroy()
		}
	}

	async configUpdated(config) {
		this.config = config
		this.parseMappings()

		// Reinitialize handlers
		if (this.midiHandler) {
			await this.midiHandler.destroy()
			this.midiHandler = null
		}

		try {
			this.midiHandler = new MidiHandler(this)
			await this.midiHandler.refreshPorts()
			await this.midiHandler.init(config)
		} catch (error) {
			this.log('error', `MIDI reinitialization error: ${error.message}`)
		}

		// Reinitialize OSC handler
		if (this.oscHandler) {
			await this.oscHandler.destroy()
			this.oscHandler = new OscHandler(this)
			await this.oscHandler.init(config)
		}

		// Update actions to refresh the UI
		this.updateActions()

		// Update status
		if (this.midiHandler && this.midiHandler.isConnected) {
			this.updateStatus(InstanceStatus.Ok)
		} else {
			this.updateStatus(InstanceStatus.Disconnected, 'No MIDI port connected')
		}

		this.updateVariables()
	}

	getConfigFields() {
		return [
			// Big friendly title
			{
				type: 'static-text',
				id: 'welcome',
				label: '',
				width: 12,
				value:
					'<div style="text-align: center; padding: 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border-radius: 10px; margin-bottom: 20px;"><h1 style="margin: 0; font-size: 28px;">🎹 MIDI to OSC Converter 🎵</h1><p style="margin: 10px 0 0 0; opacity: 0.9;">Turn your MIDI keyboard into an OSC controller!</p></div>',
			},

			// Step 1: Pick your keyboard
			{
				type: 'static-text',
				id: 'step1',
				label: '',
				width: 12,
				value:
					'<div style="background: #e8f5e9; padding: 15px; border-radius: 8px; border-left: 4px solid #4CAF50;"><h2 style="margin: 0; color: #2e7d32;">Step 1: Pick Your Keyboard 🎹</h2><p style="margin: 5px 0 0 0; color: #555;">Choose your MIDI keyboard from the list below</p></div>',
			},
			{
				type: 'dropdown',
				id: 'midi_port_index',
				label: 'My MIDI Device Is',
				width: 12,
				default: -1,
				choices: this.midiPortChoices,
			},
			{
				type: 'static-text',
				id: 'save_note',
				label: '',
				width: 12,
				value:
					'<div style="background: #fff3cd; padding: 10px; border-radius: 5px; text-align: center; margin: 10px 0;"><strong>👆 After picking your keyboard, click the SAVE button at the bottom!</strong></div>',
			},

			// Step 2: Simple explanation
			{
				type: 'static-text',
				id: 'step2',
				label: '',
				width: 12,
				value:
					'<div style="background: #e3f2fd; padding: 15px; border-radius: 8px; border-left: 4px solid #2196F3; margin-top: 20px;"><h2 style="margin: 0; color: #1565c0;">Step 2: Make Your Rules 📝</h2><p style="margin: 5px 0 0 0; color: #555;">Tell the computer: "When I press THIS key, send THAT message"</p></div>',
			},

			// Super simple mapping section
			...this.generateSimpleMappingFields(),

			// Step 3: Test it!
			{
				type: 'static-text',
				id: 'step3',
				label: '',
				width: 12,
				value:
					'<div style="background: #fce4ec; padding: 15px; border-radius: 8px; border-left: 4px solid #e91e63; margin-top: 20px;"><h2 style="margin: 0; color: #c2185b;">Step 3: Test It! 🎉</h2><p style="margin: 5px 0 0 0; color: #555;">Press keys on your keyboard and watch the magic happen!</p></div>',
			},
			{
				type: 'static-text',
				id: 'test_instructions',
				label: '',
				width: 12,
				value:
					'<div style="background: #f5f5f5; padding: 15px; border-radius: 8px; margin: 10px 0;"><ol style="margin: 0; padding-left: 20px;"><li>Press a key on your MIDI keyboard</li><li>If it matches one of your rules, an OSC message will be sent!</li><li>Watch your receiving program (like QLab, Resolume, etc.) to see the messages arrive</li></ol></div>',
			},

			// Help section
			{
				type: 'static-text',
				id: 'help',
				label: '',
				width: 12,
				value:
					'<div style="background: #f0f0f0; padding: 15px; border-radius: 8px; margin-top: 30px;"><h3 style="margin: 0 0 10px 0;">Need Help? 🤔</h3><p style="margin: 5px 0;"><strong>What is OSC?</strong> It\'s a way for programs to talk to each other over the network.</p><p style="margin: 5px 0;"><strong>What is a MIDI Note?</strong> It\'s the number of the key you press (Middle C = 60).</p><p style="margin: 5px 0;"><strong>What is CC?</strong> Control Change - like knobs and sliders on your keyboard.</p></div>',
			},
		]
	}

	getMidiDisplayText() {
		if (!this.lastMidiMessage) {
			return 'Waiting for MIDI input...'
		}

		const msg = this.lastMidiMessage
		const typeText = msg.type === 'note' ? 'Note' : 'CC'
		const matchText = msg.hasMatch ? '✓ MATCHED' : '✗ No match'
		return `${typeText} | Ch ${msg.channel} | #${msg.noteOrCC} | Val ${msg.value} | ${matchText}`
	}

	getOscDisplayText() {
		if (!this.lastOscMessage) {
			return 'No OSC messages sent yet...'
		}

		const msg = this.lastOscMessage
		return `OSC → ${msg.ip}:${msg.port} | ${msg.address} ${msg.args}`
	}

	getMappingControlsHTML() {
		const mappingCount = this.config?.mappingCount || 0
		return `
			<div style="padding: 10px; background: #2a2a2a; border-radius: 5px;">
				<div style="color: #fff;">
					<strong>${mappingCount} Mapping${mappingCount !== 1 ? 's' : ''} Configured</strong> ${mappingCount === 20 ? '(Maximum reached)' : ''}
				</div>
				<div style="color: #aaa; font-size: 12px; margin-top: 5px;">
					Use the "Add New Mapping" and "Remove Last Mapping" actions in buttons or triggers to manage mappings.
				</div>
			</div>
		`
	}

	generateSimpleMappingFields() {
		const fields = []
		const mappingCount = Math.max(1, this.config?.mappingCount || 1)

		// Simple choices
		const channelChoices = [{ id: 0, label: '🌍 All Channels' }]
		for (let i = 1; i <= 16; i++) {
			channelChoices.push({ id: i, label: `Channel ${i}` })
		}

		const typeChoices = [
			{ id: 'note', label: '🎹 Piano Key (Note)' },
			{ id: 'cc', label: '🎛️ Knob/Slider (CC)' },
		]

		// Add controls to manage mappings - using a number input with clear instructions
		fields.push({
			type: 'static-text',
			id: 'mapping_header',
			label: '',
			width: 12,
			value: `<div style="background: #fff; padding: 15px; border-radius: 8px; border: 2px solid #ddd; margin-bottom: 15px;">
				<p style="margin: 0 0 10px 0; font-size: 18px; font-weight: bold;">📋 How many rules do you want?</p>
				<p style="margin: 0; color: #666; font-size: 14px;">Change the number below, then click SAVE to update your rules</p>
			</div>`,
		})

		fields.push({
			type: 'number',
			id: 'mappingCount',
			label: '🔢 Number of Rules (1-24)',
			width: 6,
			default: 1,
			min: 1,
			max: 24,
			tooltip: 'How many MIDI to OSC rules do you want?',
		})

		fields.push({
			type: 'static-text',
			id: 'mapping_save_reminder',
			label: '',
			width: 6,
			value: `<div style="background: #fff3cd; padding: 12px; border-radius: 5px; text-align: center; margin-top: 5px;">
				<strong>👆 After changing, click SAVE!</strong>
			</div>`,
		})

		fields.push({
			type: 'static-text',
			id: 'current_rules_display',
			label: '',
			width: 12,
			value: `<div style="background: #e8f5e9; padding: 10px; border-radius: 5px; margin-bottom: 15px; text-align: center;">
				<strong style="color: #2e7d32; font-size: 16px;">Currently showing ${mappingCount} rule${mappingCount !== 1 ? 's' : ''} below ⬇️</strong>
			</div>`,
		})

		// Generate simple fields for each mapping
		for (let i = 0; i < mappingCount; i++) {
			const ruleNumber = i + 1

			fields.push(
				{
					type: 'static-text',
					id: `rule_${i}_header`,
					label: '',
					width: 12,
					value: `<div style="background: linear-gradient(90deg, #4CAF50, #45a049); color: white; padding: 10px; border-radius: 8px 8px 0 0; margin-top: ${i > 0 ? '20px' : '0'};"><strong style="font-size: 18px;">✨ Rule ${ruleNumber}</strong></div>`,
				},
				{
					type: 'checkbox',
					id: `mapping_${i}_enabled`,
					label: '✅ Turn this rule ON',
					width: 12,
					default: i === 0,
				},
				{
					type: 'static-text',
					id: `rule_${i}_when`,
					label: '',
					width: 12,
					value:
						'<div style="background: #f9f9f9; padding: 10px; border-left: 3px solid #2196F3;"><strong style="color: #1976d2; font-size: 16px;">WHEN I press...</strong></div>',
				},
				{
					type: 'dropdown',
					id: `mapping_${i}_type`,
					label: 'What kind of control?',
					width: 6,
					default: 'note',
					choices: typeChoices,
				},
				{
					type: 'number',
					id: `mapping_${i}_noteOrCC`,
					label: 'Which number? (0-127)',
					width: 3,
					default: 60 + i,
					min: 0,
					max: 127,
					tooltip: 'Middle C = 60',
				},
				{
					type: 'dropdown',
					id: `mapping_${i}_channel`,
					label: 'From which channel?',
					width: 3,
					default: 0,
					choices: channelChoices,
				},
				{
					type: 'static-text',
					id: `rule_${i}_then`,
					label: '',
					width: 12,
					value:
						'<div style="background: #f9f9f9; padding: 10px; border-left: 3px solid #4CAF50; margin-top: 10px;"><strong style="color: #388e3c; font-size: 16px;">THEN send this message...</strong></div>',
				},
				{
					type: 'textinput',
					id: `mapping_${i}_oscAddress`,
					label: '📬 Message name',
					width: 6,
					default: `/midi/note/${60 + i}`,
					tooltip: 'Like an address for your message',
				},
				{
					type: 'textinput',
					id: `mapping_${i}_oscArgs`,
					label: '📝 Message data',
					width: 6,
					default: '$(value)',
					tooltip: '$(value) sends how hard you pressed',
				},
				{
					type: 'textinput',
					id: `mapping_${i}_oscIP`,
					label: '🖥️ To which computer?',
					width: 6,
					default: '127.0.0.1',
					tooltip: '127.0.0.1 = this computer',
					regex: '/^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/',
				},
				{
					type: 'number',
					id: `mapping_${i}_oscPort`,
					label: '🔌 On which port?',
					width: 6,
					default: 8000,
					min: 1,
					max: 65535,
					tooltip: 'Usually 8000 or 9000',
				}
			)
		}

		return fields
	}
}

runEntrypoint(Midi2OscInstance, upgrades)
