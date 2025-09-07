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
				this.config[`mapping_0_channel`] = 0 // All channels
				this.config[`mapping_0_type`] = 'note'
				this.config[`mapping_0_noteOrCC`] = 60
				this.config[`mapping_0_bank`] = 0
				this.config[`mapping_0_program`] = 0
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
				const type = this.config[`mapping_${i}_type`] || 'note'
				const mapping = {
					name: this.config[`mapping_${i}_name`] || `Rule ${i + 1}`,
					enabled: true,
					channel: this.config[`mapping_${i}_channel`] || 1,
					type: type,
					noteOrCC: this.config[`mapping_${i}_noteOrCC`] || 60,
					oscIP: this.config[`mapping_${i}_oscIP`] || '127.0.0.1',
					oscPort: this.config[`mapping_${i}_oscPort`] || 8000,
					oscAddress: this.config[`mapping_${i}_oscAddress`] || '/midi',
					oscArgs: this.config[`mapping_${i}_oscArgs`] || '$(value)',
				}

				// Add bank and program fields for program change type
				if (type === 'program') {
					mapping.bank = this.config[`mapping_${i}_bank`] || 0
					mapping.program = this.config[`mapping_${i}_program`] || 0
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

	processMidiProgramChange(channel, bank, program) {
		this.stats.messagesReceived++

		// Update last received MIDI message
		this.lastMidiMessage = {
			channel,
			type: 'program',
			bank,
			program,
			timestamp: Date.now(),
		}

		// Find matching mappings for program changes
		const matchingMappings = this.mappings.filter((mapping) => {
			if (!mapping.enabled) return false
			if (mapping.type !== 'program') return false
			if (mapping.channel !== 0 && mapping.channel !== channel) return false
			if (mapping.bank !== bank) return false
			if (mapping.program !== program) return false
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
				oscArgs = oscArgs.replace(/\$\(bank\)/g, bank)
				oscArgs = oscArgs.replace(/\$\(program\)/g, program)
				oscArgs = oscArgs.replace(/\$\(channel\)/g, channel)
				oscArgs = oscArgs.replace(/\$\(value\)/g, 127) // Default value for program changes
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
		// Store the old config for comparison
		const oldConfig = this.config || {}
		const oldMappingCount = oldConfig.mappingCount || 0
		const newMappingCount = config.mappingCount || 0

		// Always update the instance config first
		this.config = config

		// Handle import action
		if (config.import_json && config.import_json.trim() !== '') {
			try {
				const imported = this.importMappings(config.import_json)
				if (imported) {
					// Import was successful and already saved the config
					// Just return - don't save again with old config
					return
				}
			} catch (error) {
				this.log('error', `Failed to import mappings: ${error.message}`)
			}
			// Clear the import field on error
			this.config.import_json = ''
			this.saveConfig(this.config)
		}

		// Handle global actions
		if (config.global_action && config.global_action !== 'none') {
			let actionPerformed = false

			switch (config.global_action) {
				case 'export_all': {
					const json = this.exportMappings()
					this.log('warn', '=====COPY FROM HERE INCLUDING THIS LINE=====')
					// Output the JSON pretty-printed line by line
					const lines = json.split('\n')
					for (const line of lines) {
						this.log('warn', line)
					}
					this.log('warn', '=====COPY TO HERE INCLUDING THIS LINE=====')
					this.log('warn', 'INSTRUCTIONS: Copy everything between and including the COPY markers above')
					actionPerformed = true
					break
				}

				case 'clear_all': {
					// Clear all mappings
					for (let i = 0; i < newMappingCount; i++) {
						delete this.config[`mapping_${i}_enabled`]
						delete this.config[`mapping_${i}_name`]
						delete this.config[`mapping_${i}_action`]
						delete this.config[`mapping_${i}_channel`]
						delete this.config[`mapping_${i}_type`]
						delete this.config[`mapping_${i}_noteOrCC`]
						delete this.config[`mapping_${i}_oscIP`]
						delete this.config[`mapping_${i}_oscPort`]
						delete this.config[`mapping_${i}_oscAddress`]
						delete this.config[`mapping_${i}_oscArgs`]
						delete this.config[`mapping_${i}_bank`]
						delete this.config[`mapping_${i}_program`]
					}
					this.config.mappingCount = 1
					// Set defaults for first mapping
					this.config[`mapping_0_name`] = 'Rule 1'
					this.config[`mapping_0_enabled`] = false
					this.config[`mapping_0_action`] = 'none'
					this.config[`mapping_0_channel`] = 0
					this.config[`mapping_0_type`] = 'note'
					this.config[`mapping_0_noteOrCC`] = 60
					this.config[`mapping_0_bank`] = 0
					this.config[`mapping_0_program`] = 0
					this.config[`mapping_0_oscIP`] = '127.0.0.1'
					this.config[`mapping_0_oscPort`] = 8000
					this.config[`mapping_0_oscAddress`] = '/midi/note/60'
					this.config[`mapping_0_oscArgs`] = '$(value)'
					this.log('warn', 'Cleared all mappings')
					actionPerformed = true
					break
				}
			}

			// Reset the global action dropdown
			this.config.global_action = 'none'

			if (actionPerformed) {
				this.saveConfig(this.config)
				return
			}
		}

		// Handle individual rule actions
		let configChanged = false
		for (let i = 0; i < newMappingCount; i++) {
			const action = config[`mapping_${i}_action`]
			if (action && action !== 'none') {
				configChanged = true

				switch (action) {
					case 'duplicate': {
						// Manually duplicate here to ensure it works
						const mappingCount = this.config.mappingCount || 0
						if (mappingCount < 24) {
							const newIdx = mappingCount
							this.config.mappingCount = mappingCount + 1

							// Copy all fields from source mapping
							this.config[`mapping_${newIdx}_name`] = `${this.config[`mapping_${i}_name`] || `Rule ${i + 1}`} (copy)`
							this.config[`mapping_${newIdx}_enabled`] = this.config[`mapping_${i}_enabled`]
							this.config[`mapping_${newIdx}_action`] = 'none'
							this.config[`mapping_${newIdx}_channel`] = this.config[`mapping_${i}_channel`]
							this.config[`mapping_${newIdx}_type`] = this.config[`mapping_${i}_type`]
							this.config[`mapping_${newIdx}_noteOrCC`] = this.config[`mapping_${i}_noteOrCC`]
							this.config[`mapping_${newIdx}_bank`] = this.config[`mapping_${i}_bank`]
							this.config[`mapping_${newIdx}_program`] = this.config[`mapping_${i}_program`]
							this.config[`mapping_${newIdx}_oscIP`] = this.config[`mapping_${i}_oscIP`]
							this.config[`mapping_${newIdx}_oscPort`] = this.config[`mapping_${i}_oscPort`]
							this.config[`mapping_${newIdx}_oscAddress`] = this.config[`mapping_${i}_oscAddress`]
							this.config[`mapping_${newIdx}_oscArgs`] = this.config[`mapping_${i}_oscArgs`]

							this.log('warn', `Duplicated rule ${i + 1} as rule ${newIdx + 1}`)
						} else {
							this.log('warn', 'Maximum number of mappings (24) reached')
						}
						break
					}

					case 'delete': {
						if (newMappingCount > 1) {
							// Shift all mappings after this one up
							for (let j = i; j < newMappingCount - 1; j++) {
								const sourceIdx = j + 1
								this.config[`mapping_${j}_name`] = this.config[`mapping_${sourceIdx}_name`]
								this.config[`mapping_${j}_enabled`] = this.config[`mapping_${sourceIdx}_enabled`]
								this.config[`mapping_${j}_action`] = 'none'
								this.config[`mapping_${j}_channel`] = this.config[`mapping_${sourceIdx}_channel`]
								this.config[`mapping_${j}_type`] = this.config[`mapping_${sourceIdx}_type`]
								this.config[`mapping_${j}_noteOrCC`] = this.config[`mapping_${sourceIdx}_noteOrCC`]
								this.config[`mapping_${j}_bank`] = this.config[`mapping_${sourceIdx}_bank`]
								this.config[`mapping_${j}_program`] = this.config[`mapping_${sourceIdx}_program`]
								this.config[`mapping_${j}_oscIP`] = this.config[`mapping_${sourceIdx}_oscIP`]
								this.config[`mapping_${j}_oscPort`] = this.config[`mapping_${sourceIdx}_oscPort`]
								this.config[`mapping_${j}_oscAddress`] = this.config[`mapping_${sourceIdx}_oscAddress`]
								this.config[`mapping_${j}_oscArgs`] = this.config[`mapping_${sourceIdx}_oscArgs`]
							}

							// Clear the last mapping
							const lastIdx = newMappingCount - 1
							delete this.config[`mapping_${lastIdx}_name`]
							delete this.config[`mapping_${lastIdx}_enabled`]
							delete this.config[`mapping_${lastIdx}_action`]
							delete this.config[`mapping_${lastIdx}_channel`]
							delete this.config[`mapping_${lastIdx}_type`]
							delete this.config[`mapping_${lastIdx}_noteOrCC`]
							delete this.config[`mapping_${lastIdx}_bank`]
							delete this.config[`mapping_${lastIdx}_program`]
							delete this.config[`mapping_${lastIdx}_oscIP`]
							delete this.config[`mapping_${lastIdx}_oscPort`]
							delete this.config[`mapping_${lastIdx}_oscAddress`]
							delete this.config[`mapping_${lastIdx}_oscArgs`]

							this.config.mappingCount = newMappingCount - 1
							this.log('warn', `Deleted rule ${i + 1}`)
						} else {
							this.log('warn', 'Cannot delete the last rule')
						}
						break
					}

					case 'move_up': {
						if (i > 0) {
							const targetIdx = i - 1
							// Swap with previous mapping
							const fields = [
								'name',
								'enabled',
								'channel',
								'type',
								'noteOrCC',
								'bank',
								'program',
								'oscIP',
								'oscPort',
								'oscAddress',
								'oscArgs',
							]
							for (const field of fields) {
								const temp = this.config[`mapping_${i}_${field}`]
								this.config[`mapping_${i}_${field}`] = this.config[`mapping_${targetIdx}_${field}`]
								this.config[`mapping_${targetIdx}_${field}`] = temp
							}
							this.log('warn', `Moved rule ${i + 1} up`)
						}
						break
					}

					case 'move_down': {
						if (i < newMappingCount - 1) {
							const targetIdx = i + 1
							// Swap with next mapping
							const fields = [
								'name',
								'enabled',
								'channel',
								'type',
								'noteOrCC',
								'bank',
								'program',
								'oscIP',
								'oscPort',
								'oscAddress',
								'oscArgs',
							]
							for (const field of fields) {
								const temp = this.config[`mapping_${i}_${field}`]
								this.config[`mapping_${i}_${field}`] = this.config[`mapping_${targetIdx}_${field}`]
								this.config[`mapping_${targetIdx}_${field}`] = temp
							}
							this.log('warn', `Moved rule ${i + 1} down`)
						}
						break
					}

					case 'export': {
						// For single rule, still use simple array format for compatibility
						const singleRule = {
							name: this.config[`mapping_${i}_name`] || `Rule ${i + 1}`,
							enabled: this.config[`mapping_${i}_enabled`],
							channel: this.config[`mapping_${i}_channel`],
							type: this.config[`mapping_${i}_type`],
							noteOrCC: this.config[`mapping_${i}_noteOrCC`],
							bank: this.config[`mapping_${i}_bank`],
							program: this.config[`mapping_${i}_program`],
							oscIP: this.config[`mapping_${i}_oscIP`],
							oscPort: this.config[`mapping_${i}_oscPort`],
							oscAddress: this.config[`mapping_${i}_oscAddress`],
							oscArgs: this.config[`mapping_${i}_oscArgs`],
						}
						const singleRuleJson = JSON.stringify([singleRule], null, 2)
						this.log('warn', `=====COPY FROM HERE INCLUDING THIS LINE=====`)
						// Output pretty-printed JSON line by line
						const lines = singleRuleJson.split('\n')
						for (const line of lines) {
							this.log('warn', line)
						}
						this.log('warn', '=====COPY TO HERE INCLUDING THIS LINE=====')
						break
					}
				}

				// Reset the action dropdown
				this.config[`mapping_${i}_action`] = 'none'
			}
		}

		// If we made changes through actions, save and return
		if (configChanged) {
			this.saveConfig(this.config)
			return
		}

		// Handle normal config updates (mapping count changes, etc.)

		// If mapping count increased, set defaults for new mappings
		if (newMappingCount > oldMappingCount) {
			for (let i = oldMappingCount; i < newMappingCount; i++) {
				// Only set defaults if the fields are undefined
				if (this.config[`mapping_${i}_name`] === undefined) {
					this.config[`mapping_${i}_name`] = `Rule ${i + 1}`
				}
				if (this.config[`mapping_${i}_enabled`] === undefined) {
					this.config[`mapping_${i}_enabled`] = false
				}
				if (this.config[`mapping_${i}_action`] === undefined) {
					this.config[`mapping_${i}_action`] = 'none'
				}
				if (this.config[`mapping_${i}_channel`] === undefined) {
					this.config[`mapping_${i}_channel`] = 0
				}
				if (this.config[`mapping_${i}_type`] === undefined) {
					this.config[`mapping_${i}_type`] = 'note'
				}
				if (this.config[`mapping_${i}_noteOrCC`] === undefined) {
					this.config[`mapping_${i}_noteOrCC`] = 60 + i
				}
				if (this.config[`mapping_${i}_bank`] === undefined) {
					this.config[`mapping_${i}_bank`] = 0
				}
				if (this.config[`mapping_${i}_program`] === undefined) {
					this.config[`mapping_${i}_program`] = i
				}
				if (this.config[`mapping_${i}_oscIP`] === undefined) {
					this.config[`mapping_${i}_oscIP`] = '127.0.0.1'
				}
				if (this.config[`mapping_${i}_oscPort`] === undefined) {
					this.config[`mapping_${i}_oscPort`] = 8000
				}
				if (this.config[`mapping_${i}_oscAddress`] === undefined) {
					this.config[`mapping_${i}_oscAddress`] = `/midi/note/${60 + i}`
				}
				if (this.config[`mapping_${i}_oscArgs`] === undefined) {
					this.config[`mapping_${i}_oscArgs`] = '$(value)'
				}
			}
		}

		this.parseMappings()

		// Reinitialize handlers
		if (this.midiHandler) {
			await this.midiHandler.destroy()
			this.midiHandler = null
		}

		try {
			this.midiHandler = new MidiHandler(this)
			await this.midiHandler.refreshPorts()
			await this.midiHandler.init(this.config)
		} catch (error) {
			this.log('error', `MIDI reinitialization error: ${error.message}`)
		}

		// Reinitialize OSC handler
		if (this.oscHandler) {
			await this.oscHandler.destroy()
			this.oscHandler = new OscHandler(this)
			await this.oscHandler.init(this.config)
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
					'<div style="background: #e3f2fd; padding: 15px; border-radius: 8px; border-left: 4px solid #2196F3; margin-top: 20px;"><h2 style="margin: 0; color: #1565c0;">Step 2: Make Your Rules 📝</h2><p style="margin: 5px 0 0 0; color: #555;">Tell the module: "When we receive THIS MIDI message, send THAT OSC message"</p></div>',
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
					'<div style="background: #f0f0f0; padding: 15px; border-radius: 8px; margin-top: 30px;"><h3 style="margin: 0 0 10px 0;">Need Help? 🤔</h3><p style="margin: 5px 0;"><strong>What is OSC?</strong> It\'s a way for programs to talk to each other over the network.</p><p style="margin: 5px 0;"><strong>What is a MIDI Note?</strong> It\'s the number of the key you press (Middle C = 60).</p><p style="margin: 5px 0;"><strong>What is CC?</strong> Control Change - like knobs and sliders on your keyboard.</p><p style="margin: 5px 0;"><strong>What is Program Change?</strong> Used to switch sounds/patches. Banks (0-16383) organize programs (0-127) into groups.</p></div>',
			},
		]
	}

	getMidiDisplayText() {
		if (!this.lastMidiMessage) {
			return 'Waiting for MIDI input...'
		}

		const msg = this.lastMidiMessage
		const matchText = msg.hasMatch ? '✓ MATCHED' : '✗ No match'

		if (msg.type === 'program') {
			return `Program Change | Ch ${msg.channel} | Bank ${msg.bank} | Prog ${msg.program} | ${matchText}`
		} else {
			const typeText = msg.type === 'note' ? 'Note' : 'CC'
			return `${typeText} | Ch ${msg.channel} | #${msg.noteOrCC} | Val ${msg.value} | ${matchText}`
		}
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
			{ id: 'program', label: '🎵 Program Change' },
		]

		const actionChoices = [
			{ id: 'none', label: '-- Select Action --' },
			{ id: 'duplicate', label: '📋 Duplicate this rule' },
			{ id: 'delete', label: '🗑️ Delete this rule' },
			{ id: 'move_up', label: '⬆️ Move this rule up' },
			{ id: 'move_down', label: '⬇️ Move this rule down' },
			{ id: 'export', label: '📤 Export this rule to log' },
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

		// Add import/export section
		fields.push({
			type: 'static-text',
			id: 'import_export_info',
			label: '',
			width: 12,
			value: `<div style="background: #f0e6ff; padding: 15px; border-radius: 8px; border: 2px solid #9C27B0; margin-bottom: 15px;">
				<h3 style="margin: 0 0 10px 0; color: #6a1b9a;">💾 Import/Export Rules</h3>
				<div style="background: #d4edda; padding: 10px; border-radius: 5px; margin: 10px 0; border: 2px solid #28a745;">
					<strong>✅ EASY COPY & PASTE!</strong> The import function automatically cleans up timestamps and markers!
				</div>
				<p style="margin: 10px 0; color: #333;"><strong>📤 TO EXPORT:</strong></p>
				<ol style="margin: 5px 0 10px 20px; color: #555;">
					<li>Select "Export ALL rules" from Global Actions dropdown (or use a rule's Export action)</li>
					<li>Click SAVE</li>
					<li>Open Companion Log: <strong>View → Log</strong> (Cmd/Ctrl+Shift+L)</li>
					<li>Find the lines with <code>=====COPY FROM HERE=====</code></li>
					<li>Select EVERYTHING from "COPY FROM HERE" to "COPY TO HERE" (including those lines)</li>
					<li>Copy (Cmd/Ctrl+C) and save to a text file</li>
				</ol>
				<p style="margin: 10px 0; color: #333;"><strong>📥 TO IMPORT:</strong></p>
				<ol style="margin: 5px 0 10px 20px; color: #555;">
					<li>Paste your exported data (with timestamps and all) in the field below</li>
					<li>Click SAVE - the import will automatically clean it up!</li>
				</ol>
			</div>`,
		})

		fields.push({
			type: 'textinput',
			id: 'import_json',
			label: '📥 Import Rules (paste JSON here)',
			width: 12,
			default: '',
			tooltip: 'Paste exported rules JSON here and click SAVE to import',
			useVariables: false,
		})

		fields.push({
			type: 'dropdown',
			id: 'global_action',
			label: '🌐 Global Actions',
			width: 12,
			default: 'none',
			choices: [
				{ id: 'none', label: '-- Select Global Action --' },
				{ id: 'export_all', label: '📤 Export ALL rules to Companion Log (View → Log)' },
				{ id: 'clear_all', label: '🗑️ Clear ALL rules' },
			],
			tooltip: 'Select an action and click SAVE. Exports appear in Companion Log window!',
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

		// Generate simple fields for each mapping with enhanced UI
		for (let i = 0; i < mappingCount; i++) {
			const ruleNumber = i + 1
			// Generate different darker background colors for each map
			const bgColors = [
				'#e8e8e8',
				'#d4e6f1',
				'#d5f4e6',
				'#fdebd0',
				'#fadbd8',
				'#e8daef',
				'#d6eaf8',
				'#d1f2eb',
				'#fcf3cf',
				'#fadbd8',
				'#ebdef0',
				'#d5dbdb',
				'#aed6f1',
				'#a9dfbf',
				'#f9e79f',
				'#f5b7b1',
				'#d2b4de',
				'#aed6f1',
				'#a9dfbf',
				'#f9e79f',
				'#85c1e2',
				'#7dcea0',
				'#f8c471',
				'#f1948a',
			]
			const bgColor = bgColors[i % bgColors.length]

			fields.push(
				{
					type: 'static-text',
					id: `rule_${i}_header`,
					label: '',
					width: 12,
					value: `<div style="background: ${bgColor}; padding: 15px; border-radius: 8px; border: 2px solid #999; margin-top: ${i > 0 ? '20px' : '0'}; box-shadow: 0 3px 6px rgba(0,0,0,0.1);">
						<div style="background: linear-gradient(90deg, #4CAF50, #45a049); color: white; padding: 12px; border-radius: 6px; margin: -15px -15px 15px -15px;">
							<strong style="font-size: 18px;">✨ Rule ${ruleNumber}</strong>
						</div>`,
				},
				{
					type: 'textinput',
					id: `mapping_${i}_name`,
					label: '📝 Rule Name',
					width: 6,
					default: `Rule ${ruleNumber}`,
					tooltip: 'Give this rule a descriptive name for easy identification',
					useVariables: false,
				},
				{
					type: 'dropdown',
					id: `mapping_${i}_action`,
					label: '⚙️ Rule Actions',
					width: 6,
					default: 'none',
					choices: actionChoices,
					tooltip: 'Select an action and click SAVE to execute',
				},
				{
					type: 'checkbox',
					id: `mapping_${i}_enabled`,
					label: '✅ Enable this rule',
					width: 12,
					default: i === 0,
					tooltip: 'Turn this rule on or off',
				},
				{
					type: 'static-text',
					id: `rule_${i}_action_reminder`,
					label: '',
					width: 12,
					value: `<div style="background: #fff3cd; padding: 8px; border-radius: 4px; margin: 5px 0; text-align: center; font-size: 12px;">
						💡 <strong>Tip:</strong> Select an action from the dropdown above and click SAVE to duplicate, delete, or move this rule
					</div>`,
				},
				{
					type: 'static-text',
					id: `rule_${i}_when`,
					label: '',
					width: 12,
					value: `<div style="background: rgba(255,255,255,0.9); padding: 10px; border-left: 4px solid #2196F3; margin-top: 10px; border-radius: 3px;"><strong style="color: #1976d2; font-size: 16px;">WHEN we receive...</strong></div>`,
				},
				{
					type: 'static-text',
					id: `rule_${i}_program_help`,
					label: '',
					width: 12,
					value:
						'<div style="background: #fffbf0; padding: 8px; border-radius: 5px; margin: 5px 0; font-size: 12px; color: #666;"><strong>For Program Changes:</strong> Your MIDI device sends Bank Select (CC 0/32) then Program Change. Configure which bank/program combo triggers this rule. Example: Bank 2, Program 5 = Patch 261 (2×128+5)</div>',
				},
				{
					type: 'dropdown',
					id: `mapping_${i}_type`,
					label: 'What kind of control?',
					width: 12,
					default: 'note',
					choices: typeChoices,
				},
				{
					type: 'dropdown',
					id: `mapping_${i}_channel`,
					label: 'From which channel?',
					width: 4,
					default: 0,
					choices: channelChoices,
				},
				{
					type: 'number',
					id: `mapping_${i}_noteOrCC`,
					label: 'Note/CC Number',
					width: 4,
					default: 60 + i,
					min: 0,
					max: 127,
					tooltip: 'For Notes: Middle C = 60 | For CC: Controller number | Leave as-is for Program Changes',
				},
				{
					type: 'static-text',
					id: `rule_${i}_or`,
					label: '',
					width: 4,
					value: '<div style="text-align: center; padding-top: 20px; color: #888;">— OR —</div>',
				},
				{
					type: 'static-text',
					id: `rule_${i}_program_section`,
					label: '',
					width: 12,
					value:
						'<div style="background: rgba(240,248,255,0.9); padding: 8px; border-radius: 5px; margin-top: 10px;"><strong>For Program Change Type Only:</strong></div>',
				},
				{
					type: 'number',
					id: `mapping_${i}_bank`,
					label: '🏦 Bank Number',
					width: 6,
					default: 0,
					min: 0,
					max: 16383,
					tooltip: 'Which bank to respond to (0-16383). Your device sends CC 0/32 to select this.',
				},
				{
					type: 'number',
					id: `mapping_${i}_program`,
					label: '🎵 Program Number',
					width: 6,
					default: 0,
					min: 0,
					max: 127,
					tooltip: 'Which program in the bank (0-127)',
				},
				{
					type: 'static-text',
					id: `rule_${i}_then`,
					label: '',
					width: 12,
					value: `<div style="background: rgba(255,255,255,0.9); padding: 10px; border-left: 4px solid #4CAF50; margin-top: 10px; border-radius: 3px;"><strong style="color: #388e3c; font-size: 16px;">THEN send this message...</strong></div>`,
				},
				{
					type: 'textinput',
					id: `mapping_${i}_oscAddress`,
					label: '📬 Message name',
					width: 6,
					default: `/midi/note/${60 + i}`,
					tooltip: 'Like an address for your message',
					useVariables: true,
				},
				{
					type: 'textinput',
					id: `mapping_${i}_oscArgs`,
					label: '📝 Message data',
					width: 6,
					default: '$(value)',
					tooltip: 'Variables: $(value), $(channel), $(bank), $(program)',
					useVariables: true,
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
				},
				{
					type: 'static-text',
					id: `rule_${i}_footer`,
					label: '',
					width: 12,
					value: '</div>',
				}
			)
		}

		// Add helpful tips section
		fields.push({
			type: 'static-text',
			id: 'tips_section',
			label: '',
			width: 12,
			value: `<div style="background: #e8f5e9; padding: 15px; border-radius: 8px; margin-top: 20px; border: 1px solid #4CAF50;">
				<h3 style="margin: 0 0 10px 0; color: #2e7d32;">💡 Pro Tips</h3>
				<ul style="margin: 0; padding-left: 20px; color: #555;">
					<li><strong>Quick duplicate:</strong> Select "Duplicate this rule" from the dropdown and click SAVE</li>
					<li><strong>Name your rules</strong> to easily identify them later</li>
					<li><strong>Disable rules temporarily</strong> instead of deleting them</li>
					<li><strong>Test each rule</strong> by pressing keys/knobs on your MIDI device</li>
					<li><strong>Export your rules</strong> before making major changes (use Export action)</li>
				</ul>
			</div>`,
		})

		return fields
	}

	duplicateMapping(index) {
		const mappingCount = this.config.mappingCount || 0
		if (index < 0 || index >= mappingCount) return

		// Increase mapping count
		const newMappingCount = Math.min(mappingCount + 1, 24)
		if (newMappingCount === mappingCount) {
			this.log('warn', 'Maximum number of mappings (24) reached')
			return
		}

		// Copy the mapping configuration
		const newConfig = { ...this.config }
		newConfig.mappingCount = newMappingCount

		// Shift all mappings after the index down by 1
		for (let i = newMappingCount - 1; i > index + 1; i--) {
			const sourceIndex = i - 1
			newConfig[`mapping_${i}_name`] = newConfig[`mapping_${sourceIndex}_name`]
			newConfig[`mapping_${i}_enabled`] = newConfig[`mapping_${sourceIndex}_enabled`]
			newConfig[`mapping_${i}_action`] = 'none' // Reset action dropdown
			newConfig[`mapping_${i}_collapsed`] = newConfig[`mapping_${sourceIndex}_collapsed`]
			newConfig[`mapping_${i}_channel`] = newConfig[`mapping_${sourceIndex}_channel`]
			newConfig[`mapping_${i}_type`] = newConfig[`mapping_${sourceIndex}_type`]
			newConfig[`mapping_${i}_noteOrCC`] = newConfig[`mapping_${sourceIndex}_noteOrCC`]
			newConfig[`mapping_${i}_bank`] = newConfig[`mapping_${sourceIndex}_bank`]
			newConfig[`mapping_${i}_program`] = newConfig[`mapping_${sourceIndex}_program`]
			newConfig[`mapping_${i}_oscIP`] = newConfig[`mapping_${sourceIndex}_oscIP`]
			newConfig[`mapping_${i}_oscPort`] = newConfig[`mapping_${sourceIndex}_oscPort`]
			newConfig[`mapping_${i}_oscAddress`] = newConfig[`mapping_${sourceIndex}_oscAddress`]
			newConfig[`mapping_${i}_oscArgs`] = newConfig[`mapping_${sourceIndex}_oscArgs`]
		}

		// Duplicate the mapping at index + 1
		const newIndex = index + 1
		newConfig[`mapping_${newIndex}_name`] = `${newConfig[`mapping_${index}_name`] || `Rule ${index + 1}`} (copy)`
		newConfig[`mapping_${newIndex}_enabled`] = newConfig[`mapping_${index}_enabled`]
		newConfig[`mapping_${newIndex}_action`] = 'none' // Reset action dropdown
		newConfig[`mapping_${newIndex}_collapsed`] = newConfig[`mapping_${index}_collapsed`]
		newConfig[`mapping_${newIndex}_channel`] = newConfig[`mapping_${index}_channel`]
		newConfig[`mapping_${newIndex}_type`] = newConfig[`mapping_${index}_type`]
		newConfig[`mapping_${newIndex}_noteOrCC`] = newConfig[`mapping_${index}_noteOrCC`]
		newConfig[`mapping_${newIndex}_bank`] = newConfig[`mapping_${index}_bank`]
		newConfig[`mapping_${newIndex}_program`] = newConfig[`mapping_${index}_program`]
		newConfig[`mapping_${newIndex}_oscIP`] = newConfig[`mapping_${index}_oscIP`]
		newConfig[`mapping_${newIndex}_oscPort`] = newConfig[`mapping_${index}_oscPort`]
		newConfig[`mapping_${newIndex}_oscAddress`] = newConfig[`mapping_${index}_oscAddress`]
		newConfig[`mapping_${newIndex}_oscArgs`] = newConfig[`mapping_${index}_oscArgs`]

		this.saveConfig(newConfig)
		this.log('info', `Duplicated mapping ${index + 1}`)
	}

	deleteMapping(index) {
		const mappingCount = this.config.mappingCount || 0
		if (index < 0 || index >= mappingCount || mappingCount <= 1) return

		const newConfig = { ...this.config }
		newConfig.mappingCount = mappingCount - 1

		// Shift all mappings after the deleted one up by 1
		for (let i = index; i < newConfig.mappingCount; i++) {
			const sourceIndex = i + 1
			newConfig[`mapping_${i}_name`] = newConfig[`mapping_${sourceIndex}_name`]
			newConfig[`mapping_${i}_enabled`] = newConfig[`mapping_${sourceIndex}_enabled`]
			newConfig[`mapping_${i}_action`] = 'none' // Reset action dropdown
			newConfig[`mapping_${i}_collapsed`] = newConfig[`mapping_${sourceIndex}_collapsed`]
			newConfig[`mapping_${i}_channel`] = newConfig[`mapping_${sourceIndex}_channel`]
			newConfig[`mapping_${i}_type`] = newConfig[`mapping_${sourceIndex}_type`]
			newConfig[`mapping_${i}_noteOrCC`] = newConfig[`mapping_${sourceIndex}_noteOrCC`]
			newConfig[`mapping_${i}_bank`] = newConfig[`mapping_${sourceIndex}_bank`]
			newConfig[`mapping_${i}_program`] = newConfig[`mapping_${sourceIndex}_program`]
			newConfig[`mapping_${i}_oscIP`] = newConfig[`mapping_${sourceIndex}_oscIP`]
			newConfig[`mapping_${i}_oscPort`] = newConfig[`mapping_${sourceIndex}_oscPort`]
			newConfig[`mapping_${i}_oscAddress`] = newConfig[`mapping_${sourceIndex}_oscAddress`]
			newConfig[`mapping_${i}_oscArgs`] = newConfig[`mapping_${sourceIndex}_oscArgs`]
		}

		// Clear the last mapping fields
		const lastIndex = mappingCount - 1
		delete newConfig[`mapping_${lastIndex}_name`]
		delete newConfig[`mapping_${lastIndex}_enabled`]
		delete newConfig[`mapping_${lastIndex}_action`]
		delete newConfig[`mapping_${lastIndex}_collapsed`]
		delete newConfig[`mapping_${lastIndex}_channel`]
		delete newConfig[`mapping_${lastIndex}_type`]
		delete newConfig[`mapping_${lastIndex}_noteOrCC`]
		delete newConfig[`mapping_${lastIndex}_bank`]
		delete newConfig[`mapping_${lastIndex}_program`]
		delete newConfig[`mapping_${lastIndex}_oscIP`]
		delete newConfig[`mapping_${lastIndex}_oscPort`]
		delete newConfig[`mapping_${lastIndex}_oscAddress`]
		delete newConfig[`mapping_${lastIndex}_oscArgs`]

		this.saveConfig(newConfig)
		this.log('info', `Deleted mapping ${index + 1}`)
	}

	moveMapping(index, direction) {
		const mappingCount = this.config.mappingCount || 0
		if (index < 0 || index >= mappingCount) return

		const targetIndex = direction === 'up' ? index - 1 : index + 1
		if (targetIndex < 0 || targetIndex >= mappingCount) return

		const newConfig = { ...this.config }

		// Swap the two mappings
		const fields = [
			'name',
			'enabled',
			'collapsed',
			'channel',
			'type',
			'noteOrCC',
			'bank',
			'program',
			'oscIP',
			'oscPort',
			'oscAddress',
			'oscArgs',
		]
		for (const field of fields) {
			const temp = newConfig[`mapping_${index}_${field}`]
			newConfig[`mapping_${index}_${field}`] = newConfig[`mapping_${targetIndex}_${field}`]
			newConfig[`mapping_${targetIndex}_${field}`] = temp
		}

		// Reset action dropdowns for both swapped mappings
		newConfig[`mapping_${index}_action`] = 'none'
		newConfig[`mapping_${targetIndex}_action`] = 'none'

		this.saveConfig(newConfig)
		this.log('info', `Moved mapping ${index + 1} ${direction}`)
	}

	exportMappings() {
		const mappingCount = this.config.mappingCount || 0

		// Include the MIDI port in the export
		const exportData = {
			midiPort: this.config.midiPort || '',
			mappings: [],
		}

		for (let i = 0; i < mappingCount; i++) {
			exportData.mappings.push({
				name: this.config[`mapping_${i}_name`] || `Rule ${i + 1}`,
				enabled: this.config[`mapping_${i}_enabled`],
				collapsed: this.config[`mapping_${i}_collapsed`],
				channel: this.config[`mapping_${i}_channel`],
				type: this.config[`mapping_${i}_type`],
				noteOrCC: this.config[`mapping_${i}_noteOrCC`],
				bank: this.config[`mapping_${i}_bank`],
				program: this.config[`mapping_${i}_program`],
				oscIP: this.config[`mapping_${i}_oscIP`],
				oscPort: this.config[`mapping_${i}_oscPort`],
				oscAddress: this.config[`mapping_${i}_oscAddress`],
				oscArgs: this.config[`mapping_${i}_oscArgs`],
			})
		}

		return JSON.stringify(exportData, null, 2)
	}

	importMappings(jsonData) {
		let cleanedData = ''
		try {
			this.log('warn', 'Starting import...')

			// First, strip out all timestamps from each line
			const lines = jsonData.split('\n')
			const strippedLines = []

			for (const line of lines) {
				let cleanLine = line
				// Remove timestamp prefix if present (format: "DD.MM.YY HH:MM:SS Instance/Wrapper/MIDI2OSC: ")
				const timestampMatch = line.match(/^\d{2}\.\d{2}\.\d{2}\s+\d{2}:\d{2}:\d{2}\s+[^:]+:\s+(.*)$/)
				if (timestampMatch) {
					cleanLine = timestampMatch[1]
				}
				strippedLines.push(cleanLine)
			}

			// Join all lines back together
			const fullText = strippedLines.join('\n')

			// Now find the JSON - look for either array [...] or object {...}
			// First try to find an array
			let startIdx = fullText.indexOf('[')
			let endIdx = -1

			if (startIdx >= 0) {
				// Find the matching closing bracket
				let bracketCount = 0
				let inString = false
				let escapeNext = false

				for (let i = startIdx; i < fullText.length; i++) {
					const char = fullText[i]

					if (escapeNext) {
						escapeNext = false
						continue
					}

					if (char === '\\') {
						escapeNext = true
						continue
					}

					if (char === '"' && !escapeNext) {
						inString = !inString
						continue
					}

					if (!inString) {
						if (char === '[') bracketCount++
						else if (char === ']') {
							bracketCount--
							if (bracketCount === 0) {
								endIdx = i
								break
							}
						}
					}
				}

				if (endIdx > startIdx) {
					cleanedData = fullText.substring(startIdx, endIdx + 1)
					this.log('warn', `Found JSON array from position ${startIdx} to ${endIdx}`)
				}
			}

			// If no array found, try to find an object
			if (!cleanedData) {
				startIdx = fullText.indexOf('{')
				if (startIdx >= 0) {
					// Find the matching closing brace
					let braceCount = 0
					let inString = false
					let escapeNext = false

					for (let i = startIdx; i < fullText.length; i++) {
						const char = fullText[i]

						if (escapeNext) {
							escapeNext = false
							continue
						}

						if (char === '\\') {
							escapeNext = true
							continue
						}

						if (char === '"' && !escapeNext) {
							inString = !inString
							continue
						}

						if (!inString) {
							if (char === '{') braceCount++
							else if (char === '}') {
								braceCount--
								if (braceCount === 0) {
									endIdx = i
									break
								}
							}
						}
					}

					if (endIdx > startIdx) {
						cleanedData = fullText.substring(startIdx, endIdx + 1)
						this.log('warn', `Found JSON object from position ${startIdx} to ${endIdx}`)
					}
				}
			}

			if (!cleanedData) {
				throw new Error('Could not find valid JSON array or object in the input')
			}

			this.log('warn', `Extracted JSON length: ${cleanedData.length} chars`)

			// Parse the cleaned JSON
			const parsedData = JSON.parse(cleanedData)

			let mappings = []
			let midiPort = null

			// Handle both old format (array) and new format (object with midiPort and mappings)
			if (Array.isArray(parsedData)) {
				// Old format - just an array of mappings
				mappings = parsedData
			} else if (parsedData && typeof parsedData === 'object' && Array.isArray(parsedData.mappings)) {
				// New format with midiPort
				mappings = parsedData.mappings
				midiPort = parsedData.midiPort
			} else {
				throw new Error('Invalid mappings format - expected an array or object with mappings array')
			}

			const newConfig = { ...this.config }

			// Update the mapping count to match imported mappings
			newConfig.mappingCount = Math.min(mappings.length, 24)

			// Preserve MIDI port if provided
			if (midiPort !== null && midiPort !== '') {
				newConfig.midiPort = midiPort
				this.log('warn', `Setting MIDI port to: ${midiPort}`)
			}

			// Clear the action dropdowns first
			for (let i = 0; i < 24; i++) {
				newConfig[`mapping_${i}_action`] = 'none'
			}

			for (let i = 0; i < newConfig.mappingCount; i++) {
				const mapping = mappings[i]
				newConfig[`mapping_${i}_name`] = mapping.name || `Rule ${i + 1}`
				newConfig[`mapping_${i}_enabled`] = mapping.enabled !== undefined ? mapping.enabled : false
				newConfig[`mapping_${i}_collapsed`] = mapping.collapsed !== undefined ? mapping.collapsed : false
				newConfig[`mapping_${i}_channel`] = mapping.channel !== undefined ? mapping.channel : 0
				newConfig[`mapping_${i}_type`] = mapping.type || 'note'
				newConfig[`mapping_${i}_noteOrCC`] = mapping.noteOrCC !== undefined ? mapping.noteOrCC : 60
				newConfig[`mapping_${i}_bank`] = mapping.bank !== undefined ? mapping.bank : 0
				newConfig[`mapping_${i}_program`] = mapping.program !== undefined ? mapping.program : 0
				newConfig[`mapping_${i}_oscIP`] = mapping.oscIP || '127.0.0.1'
				newConfig[`mapping_${i}_oscPort`] = mapping.oscPort !== undefined ? mapping.oscPort : 8000
				newConfig[`mapping_${i}_oscAddress`] = mapping.oscAddress || '/midi'
				newConfig[`mapping_${i}_oscArgs`] = mapping.oscArgs || '$(value)'
				newConfig[`mapping_${i}_action`] = 'none'
			}

			// Clear the import field after successful import
			newConfig.import_json = ''

			// Update the instance config with the new config
			this.config = newConfig
			this.saveConfig(newConfig)

			this.log(
				'warn',
				`✅ Successfully imported ${newConfig.mappingCount} rule${newConfig.mappingCount !== 1 ? 's' : ''}`
			)
			if (midiPort) {
				this.log('warn', `✅ MIDI port set to: ${midiPort}`)
			}
			return true
		} catch (error) {
			this.log('error', `Failed to import mappings: ${error.message}`)
			this.log('error', 'Make sure you copied everything between and including the COPY markers')
			this.log(
				'error',
				`Debug: First 200 chars of cleaned data: ${cleanedData ? cleanedData.substring(0, 200) : 'undefined'}`
			)
			return false
		}
	}
}

runEntrypoint(Midi2OscInstance, upgrades)
