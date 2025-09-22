import { InstanceBase, runEntrypoint, InstanceStatus, combineRgb } from '@companion-module/base'
import { MidiHandler } from './midi.js'
import { upgrades } from './upgrades.js'

// Node.js 18+ has fetch built-in
/* global fetch, AbortController */

class Midi2ButtonsInstance extends InstanceBase {
	constructor(internal) {
		super(internal)
		this.midiHandler = null
		this.mappings = []
		this.midiPorts = []
		this.midiPortChoices = [{ id: -1, label: 'Select MIDI Port' }]
		this.buttonPressQueue = []
		this.processingQueue = false
	}

	async init(config) {
		// Ensure config is always an object, even if null/undefined is passed
		this.config = config || {}

		// Set default values for essential config properties
		if (!this.config.http_host) this.config.http_host = '127.0.0.1'
		if (!this.config.http_port) this.config.http_port = 8000
		if (!this.config.mappingCount) this.config.mappingCount = 10
		if (this.config.midi_port_index === undefined) this.config.midi_port_index = -1
		if (!this.config.press_delay) this.config.press_delay = 500

		this.updateStatus(InstanceStatus.Connecting)

		// Initialize variables
		this.setVariableDefinitions([
			{ variableId: 'midi_status', name: 'MIDI Connection Status' },
			{ variableId: 'midi_port', name: 'MIDI Port Name' },
			{ variableId: 'last_triggered_page', name: 'Last Triggered Page' },
			{ variableId: 'last_triggered_row', name: 'Last Triggered Row' },
			{ variableId: 'last_triggered_col', name: 'Last Triggered Column' },
			{ variableId: 'last_triggered_button', name: 'Last Triggered Button Number' },
			{ variableId: 'trigger_count', name: 'Trigger Count' },
			{ variableId: 'mapping_count', name: 'Number of Active Mappings' },
		])

		// Set initial variable values
		this.setVariableValues({
			midi_status: 'Disconnected',
			midi_port: 'None',
			last_triggered_page: 0,
			last_triggered_row: 0,
			last_triggered_col: 0,
			trigger_count: 0,
			mapping_count: 0,
		})

		// Initialize actions
		this.setActionDefinitions({
			refreshPorts: {
				name: 'Refresh MIDI Ports',
				options: [],
				callback: async () => {
					this.log('info', 'Refreshing MIDI ports...')
					if (this.midiHandler) {
						await this.midiHandler.refreshPorts()
						this.init(this.config)
					}
				},
			},
			testButton: {
				name: 'Test Button Press',
				options: [
					{
						type: 'textinput',
						id: 'location',
						label: 'Button Location',
						default: '1/0/0',
						tooltip: 'Format: page/row/column',
					},
				],
				callback: async (action) => {
					const parts = action.options.location.split('/')
					if (parts.length === 3) {
						const page = parseInt(parts[0])
						const row = parseInt(parts[1])
						const col = parseInt(parts[2])
						this.log('info', `🧪 TEST: Manually triggering button ${page}/${row}/${col}`)
						this.queueButtonPress(page, row, col)
					}
				},
			},
			reloadMappings: {
				name: 'Reload Mappings',
				options: [],
				callback: () => {
					this.log('info', '🔄 Reloading mappings...')
					this.parseMappings()
				},
			},
			directTest: {
				name: 'Direct Button Test (Try All IPs)',
				options: [
					{
						type: 'textinput',
						id: 'location',
						label: 'Button Location',
						default: '1/0/0',
						tooltip: 'Format: page/row/column',
					},
				],
				callback: async (action) => {
					const parts = action.options.location.split('/')
					if (parts.length !== 3) return

					const page = parseInt(parts[0])
					const row = parseInt(parts[1])
					const col = parseInt(parts[2])
					const port = this.config.http_port || 8000

					// Try different IPs to see which one actually triggers the button
					const hosts = [this.config.http_host || '127.0.0.1', '127.0.0.1', 'localhost']

					for (const host of hosts) {
						const url = `http://${host}:${port}/api/location/${page}/${row}/${col}/press`
						this.log('warn', `🧪 DIRECT TEST: Trying ${url}`)

						try {
							const response = await fetch(url, {
								method: 'POST',
								headers: { 'Content-Type': 'application/json' },
								body: '{}',
							})

							if (response.ok) {
								this.log(
									'warn',
									`✅ SUCCESS at ${host}: Status ${response.status} - Check if button ${page}/${row}/${col} flashed!`
								)
							} else {
								this.log('info', `❌ Failed at ${host}: Status ${response.status}`)
							}
						} catch (error) {
							this.log('info', `❌ Error at ${host}: ${error.message}`)
						}

						// Small delay between attempts
						await new Promise((resolve) => setTimeout(resolve, 500))
					}
				},
			},
			testHttp: {
				name: 'Test HTTP Connection',
				options: [],
				callback: async () => {
					const host = this.config.http_host || '127.0.0.1'
					const port = this.config.http_port || 8000

					// First test basic connectivity
					const baseUrl = `http://${host}:${port}/api/`
					this.log('warn', `🧪 Testing HTTP connection to ${baseUrl}`)

					try {
						const controller = new AbortController()
						const timeoutId = setTimeout(() => controller.abort(), 3000)

						const response = await fetch(baseUrl, {
							method: 'GET',
							signal: controller.signal,
						})

						clearTimeout(timeoutId)

						if (response.ok) {
							this.log('warn', `✅ API REACHABLE: Companion API found at ${host}:${port}`)

							// Test multiple endpoints to find which works
							const testEndpoints = [
								{ url: `http://${host}:${port}/api/location/1/0/0/press`, desc: `API at ${host}: page/row/col` },
								{ url: `http://127.0.0.1:${port}/api/location/1/0/0/press`, desc: 'API at 127.0.0.1: page/row/col' },
								{ url: `http://localhost:${port}/api/location/1/0/0/press`, desc: 'API at localhost: page/row/col' },
							]

							for (const endpoint of testEndpoints) {
								this.log('warn', `🧪 Testing: ${endpoint.desc}`)

								try {
									const testResponse = await fetch(endpoint.url, {
										method: 'POST',
										headers: {
											'Content-Type': 'application/json',
										},
										body: '{}',
									})

									if (testResponse.ok) {
										this.log('warn', `✅ SUCCESS: ${endpoint.desc} works (status ${testResponse.status})`)
									} else {
										this.log('info', `❌ FAILED: ${endpoint.desc} (status ${testResponse.status})`)
									}
								} catch (e) {
									this.log('info', `❌ ERROR: ${endpoint.desc} - ${e.message}`)
								}
							}
						} else {
							this.log('error', `❌ HTTP TEST FAILED: Status ${response.status} from ${baseUrl}`)
						}
					} catch (error) {
						this.log('error', `❌ HTTP TEST ERROR: Cannot reach ${baseUrl} - ${error.message}`)
						this.log('error', `Make sure:`)
						this.log('error', `1. Companion HTTP API is enabled in Settings → Web Buttons`)
						this.log('error', `2. IP address is correct (current: ${host})`)
						this.log('error', `3. Port is correct (current: ${port})`)
					}
				},
			},
		})

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

		// Initialize presets
		this.setPresetDefinitions({
			status: {
				name: 'MIDI Status',
				category: 'Status',
				type: 'button',
				style: {
					text: 'MIDI\\n$(midi2buttons:midi_status)',
					size: '14',
					color: combineRgb(255, 255, 255),
					bgcolor: combineRgb(0, 0, 0),
				},
				steps: [],
				feedbacks: [
					{
						feedbackId: 'midi_active',
						style: {
							bgcolor: combineRgb(0, 255, 0),
							color: combineRgb(0, 0, 0),
						},
					},
				],
			},
			refresh: {
				name: 'Refresh MIDI',
				category: 'Control',
				type: 'button',
				style: {
					text: 'Refresh\\nMIDI',
					size: '18',
					color: combineRgb(255, 255, 255),
					bgcolor: combineRgb(0, 0, 128),
				},
				steps: [
					{
						down: [
							{
								actionId: 'refreshPorts',
							},
						],
					},
				],
				feedbacks: [],
			},
			reload: {
				name: 'Reload Mappings',
				category: 'Control',
				type: 'button',
				style: {
					text: 'Reload\\nMappings',
					size: '18',
					color: combineRgb(255, 255, 255),
					bgcolor: combineRgb(128, 0, 128),
				},
				steps: [
					{
						down: [
							{
								actionId: 'reloadMappings',
							},
						],
					},
				],
				feedbacks: [],
			},
			test1: {
				name: 'Test Button 1/0/0',
				category: 'Testing',
				type: 'button',
				style: {
					text: 'Test\\n1/0/0',
					size: '18',
					color: combineRgb(255, 255, 255),
					bgcolor: combineRgb(128, 128, 0),
				},
				steps: [
					{
						down: [
							{
								actionId: 'testButton',
								options: {
									location: '1/0/0',
								},
							},
						],
					},
				],
				feedbacks: [],
			},
			test2: {
				name: 'Test Button 1/0/1',
				category: 'Testing',
				type: 'button',
				style: {
					text: 'Test\\n1/0/1',
					size: '18',
					color: combineRgb(255, 255, 255),
					bgcolor: combineRgb(128, 128, 0),
				},
				steps: [
					{
						down: [
							{
								actionId: 'testButton',
								options: {
									location: '1/0/1',
								},
							},
						],
					},
				],
				feedbacks: [],
			},
			lastTrigger: {
				name: 'Last Triggered',
				category: 'Monitor',
				type: 'button',
				style: {
					text: 'Last:\\n$(midi2buttons:last_triggered_page)/$(midi2buttons:last_triggered_row)/$(midi2buttons:last_triggered_col)',
					size: '14',
					color: combineRgb(255, 255, 255),
					bgcolor: combineRgb(64, 64, 64),
				},
				steps: [],
				feedbacks: [],
			},
			triggerCount: {
				name: 'Trigger Count',
				category: 'Monitor',
				type: 'button',
				style: {
					text: 'Count:\\n$(midi2buttons:trigger_count)',
					size: '18',
					color: combineRgb(255, 255, 255),
					bgcolor: combineRgb(0, 64, 64),
				},
				steps: [],
				feedbacks: [],
			},
			exampleNote: {
				name: 'Example: Note C4',
				category: 'Examples',
				type: 'button',
				style: {
					text: '{MIDI: N60@1.on}\\n{1/0/0}',
					size: '14',
					color: combineRgb(255, 255, 0),
					bgcolor: combineRgb(32, 32, 32),
				},
				steps: [],
				feedbacks: [],
			},
			examplePC: {
				name: 'Example: Program Change',
				category: 'Examples',
				type: 'button',
				style: {
					text: '{MIDI: CC00.9,\\nPC12@1}\\n{1/0/1}',
					size: '14',
					color: combineRgb(0, 255, 255),
					bgcolor: combineRgb(32, 32, 32),
				},
				steps: [],
				feedbacks: [],
			},
			exampleCC: {
				name: 'Example: CC7 Volume',
				category: 'Examples',
				type: 'button',
				style: {
					text: '{MIDI: CC7@1}\\n{1/0/2}',
					size: '14',
					color: combineRgb(255, 0, 255),
					bgcolor: combineRgb(32, 32, 32),
				},
				steps: [],
				feedbacks: [],
			},
		})

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
		this.log(
			'warn',
			`✅ Module initialized - IP: ${this.config.http_host || '127.0.0.1'}:${this.config.http_port || 8000}`
		)
	}

	parseMappings() {
		this.mappings = []

		// Ensure config exists
		if (!this.config) {
			this.log('warn', 'No configuration available - cannot parse mappings')
			return
		}

		// Collect all mapping lines from individual fields
		const lines = []
		const mappingCount = this.config.mappingCount || 10
		for (let i = 0; i < mappingCount; i++) {
			const mapping = this.config[`mapping_${i}`]
			if (mapping && mapping.trim()) {
				lines.push(mapping.trim())
				this.log('debug', `Found mapping ${i + 1}: ${mapping.trim()}`)
			}
		}

		if (lines.length === 0) {
			this.log('warn', 'No mappings configured - add mappings in module settings')
			return
		}

		for (let lineNum = 0; lineNum < lines.length; lineNum++) {
			const line = lines[lineNum].trim()

			// Skip empty lines and comments
			if (!line || line.startsWith('//')) continue

			// Parse line format: {MIDI: commands} {page/row/col}
			const match = line.match(/^{MIDI:\s*([^}]+)}\s*{(\d+)\/(\d+)\/(\d+)}/)
			if (!match) {
				if (line.length > 0) {
					this.log('warn', `Line ${lineNum + 1}: Invalid format: ${line}`)
				}
				continue
			}

			const [, midiCommands, pageStr, rowStr, colStr] = match
			const page = parseInt(pageStr)
			const row = parseInt(rowStr)
			const column = parseInt(colStr)

			// Parse MIDI commands (can be multiple, comma-separated)
			const commands = midiCommands.split(',').map((cmd) => cmd.trim())

			let bankMSB = -1
			let bankLSB = -1
			let programChange = null
			let note = null
			let cc = null
			let channel = 1
			let trigger = 'on'

			for (const cmd of commands) {
				// Bank MSB: CC00.value
				if (cmd.startsWith('CC00.')) {
					bankMSB = parseInt(cmd.substring(5))
					if (isNaN(bankMSB) || bankMSB < 0 || bankMSB > 127) {
						this.log('warn', `Line ${lineNum + 1}: Invalid bank MSB: ${cmd}`)
						continue
					}
				}
				// Bank LSB: CC32.value
				else if (cmd.startsWith('CC32.')) {
					bankLSB = parseInt(cmd.substring(5))
					if (isNaN(bankLSB) || bankLSB < 0 || bankLSB > 127) {
						this.log('warn', `Line ${lineNum + 1}: Invalid bank LSB: ${cmd}`)
						continue
					}
				}
				// Program Change: PC<num>@<channel>
				else if (cmd.match(/^PC(\d+)@?(\d+)?$/)) {
					const pcMatch = cmd.match(/^PC(\d+)@?(\d+)?$/)
					programChange = parseInt(pcMatch[1])
					if (pcMatch[2]) channel = parseInt(pcMatch[2])
					if (isNaN(programChange) || programChange < 0 || programChange > 127) {
						this.log('warn', `Line ${lineNum + 1}: Invalid program change: ${cmd}`)
						programChange = null
					}
				}
				// Note: N<num>@<channel>.<trigger>
				else if (cmd.match(/^N(\d+)@?(\d+)?\.?(on|off|both)?$/)) {
					const noteMatch = cmd.match(/^N(\d+)@?(\d+)?\.?(on|off|both)?$/)
					note = parseInt(noteMatch[1])
					if (noteMatch[2]) channel = parseInt(noteMatch[2])
					if (noteMatch[3]) trigger = noteMatch[3]
					if (isNaN(note) || note < 0 || note > 127) {
						this.log('warn', `Line ${lineNum + 1}: Invalid note: ${cmd}`)
						note = null
					}
				}
				// Control Change: CC<num>@<channel>
				else if (cmd.match(/^CC(\d+)@?(\d+)?$/)) {
					const ccMatch = cmd.match(/^CC(\d+)@?(\d+)?$/)
					cc = parseInt(ccMatch[1])
					if (ccMatch[2]) channel = parseInt(ccMatch[2])
					if (isNaN(cc) || cc < 0 || cc > 127) {
						this.log('warn', `Line ${lineNum + 1}: Invalid CC: ${cmd}`)
						cc = null
					}
				} else {
					this.log('warn', `Line ${lineNum + 1}: Unknown command: ${cmd}`)
				}
			}

			// Create mapping based on what was found
			if (programChange !== null) {
				// Calculate full bank number from MSB and LSB
				let bank = -1
				if (bankMSB >= 0) {
					bank = bankMSB * 128 + (bankLSB >= 0 ? bankLSB : 0)
				}

				this.mappings.push({
					enabled: true,
					type: 'program',
					channel: channel,
					bank: bank,
					value: programChange,
					trigger: 'on', // Not used for program changes
					page: page,
					row: row,
					column: column,
				})
				this.log('warn', `✅ Parsed: PC${programChange} Ch${channel} Bank${bank} -> Button ${page}/${row}/${column}`)
			}

			if (note !== null) {
				this.mappings.push({
					enabled: true,
					type: 'note',
					channel: channel,
					bank: -1, // Not used for notes
					value: note,
					trigger: trigger,
					page: page,
					row: row,
					column: column,
				})
				this.log('warn', `✅ Parsed: Note${note} Ch${channel} ${trigger} -> Button ${page}/${row}/${column}`)
			}

			if (cc !== null && cc !== 0 && cc !== 32) {
				// Don't map bank select CCs as triggers
				this.mappings.push({
					enabled: true,
					type: 'cc',
					channel: channel,
					bank: -1, // Not used for CC
					value: cc,
					trigger: 'on', // Not used for CC
					page: page,
					row: row,
					column: column,
				})
				this.log('warn', `✅ Parsed: CC${cc} Ch${channel} -> Button ${page}/${row}/${column}`)
			}
		}

		this.log('info', `Loaded ${this.mappings.length} mappings`)
		this.setVariableValues({ mapping_count: this.mappings.length })
	}

	processMidiMessage(channel, type, noteOrCC, value) {
		// Log incoming MIDI in a clear format - using warn to ensure visibility
		if (type === 'note') {
			const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
			const octave = Math.floor(noteOrCC / 12) - 1
			const noteName = noteNames[noteOrCC % 12]
			this.log(
				'warn',
				`🎹 MIDI IN: Note ${noteName}${octave} (${noteOrCC}) Ch${channel} Vel${value} [${value > 0 ? 'ON' : 'OFF'}]`
			)
		} else if (type === 'cc') {
			this.log('warn', `🎛️ MIDI IN: CC${noteOrCC} Ch${channel} Value${value}`)
		}

		this.log('info', `Active mappings count: ${this.mappings.length}`)

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
			this.log('info', `❌ No matching mapping for: ${type} ${noteOrCC} Ch${channel}`)
		} else {
			matchingMappings.forEach((m) => {
				this.log('warn', `✨ MATCH! Triggering button ${m.page}/${m.row}/${m.column}`)
				this.queueButtonPress(m.page, m.row, m.column)
			})
		}
	}

	processMidiProgramChange(channel, bank, program) {
		this.log('warn', `🎵 MIDI IN: Program Change ${program} Ch${channel} Bank${bank}`)

		// Find matching mappings
		const matchingMappings = this.mappings.filter((m) => {
			if (!m.enabled) return false
			if (m.type !== 'program') return false
			if (m.channel !== 0 && m.channel !== channel) return false
			if (m.bank !== -1 && m.bank !== bank) return false // Check bank: -1 means any bank
			if (m.value !== program) return false
			return true
		})

		// Trigger buttons
		if (matchingMappings.length === 0) {
			this.log('info', `❌ No matching mapping for: PC${program} Ch${channel} Bank${bank}`)
		} else {
			matchingMappings.forEach((m) => {
				this.log('warn', `✨ MATCH! Triggering button ${m.page}/${m.row}/${m.column}`)
				this.queueButtonPress(m.page, m.row, m.column)
			})
		}
	}

	queueButtonPress(page, row, column) {
		// Add to queue
		this.buttonPressQueue.push({ page, row, column })

		if (this.buttonPressQueue.length > 1) {
			this.log('info', `📋 Queued button ${page}/${row}/${column} (${this.buttonPressQueue.length} in queue)`)
		}

		// Process queue if not already processing
		if (!this.processingQueue) {
			this.processButtonQueue()
		}
	}

	async processButtonQueue() {
		if (this.processingQueue || this.buttonPressQueue.length === 0) {
			return
		}

		this.processingQueue = true

		while (this.buttonPressQueue.length > 0) {
			const { page, row, column } = this.buttonPressQueue.shift()
			const startTime = Date.now()
			await this.pressButton(page, row, column)
			const elapsed = Date.now() - startTime
			this.log('info', `⏱️ Button press completed in ${elapsed}ms`)

			// Add delay between button presses to let Companion process the action
			if (this.buttonPressQueue.length > 0) {
				const delay = this.config.press_delay || 500
				this.log('info', `⏸️ Waiting ${delay}ms before next press`)
				await new Promise((resolve) => setTimeout(resolve, delay))
			}
		}

		this.processingQueue = false
	}

	async pressButton(page, row, column) {
		// Use Companion's HTTP API to press the button
		const host = this.config.http_host || '127.0.0.1'
		const port = this.config.http_port || 8000
		// const method = this.config.press_method || 'press' // Not used anymore, always using down/up

		// ALWAYS use down/up for proper state management
		// Even in "press" mode, we'll do down/up to ensure clean state
		const downUrl = `http://${host}:${port}/api/location/${page}/${row}/${column}/down`
		const upUrl = `http://${host}:${port}/api/location/${page}/${row}/${column}/up`

		this.log('warn', `📤 HTTP: Button ${page}/${row}/${column} DOWN`)

		try {
			// Send DOWN
			const downResponse = await fetch(downUrl, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: '{}',
			})

			if (!downResponse.ok) {
				this.log('error', `❌ DOWN FAILED: ${downResponse.status}`)

				// If down fails, try the press endpoint as fallback
				const pressUrl = `http://${host}:${port}/api/location/${page}/${row}/${column}/press`
				const pressResponse = await fetch(pressUrl, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: '{}',
				})

				if (pressResponse.ok) {
					this.log('warn', `✅ FALLBACK: Used /press endpoint successfully`)
				}
				return
			}

			// INCREASED DELAY: Hold the button down longer to ensure Companion registers it
			// This simulates a more realistic human button press duration
			await new Promise((resolve) => setTimeout(resolve, 200))

			this.log('info', `📤 HTTP: Button ${page}/${row}/${column} UP`)

			// Send UP - CRITICAL for state reset
			const upResponse = await fetch(upUrl, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: '{}',
			})

			if (upResponse.ok) {
				this.log('warn', `✅ SUCCESS: Button ${page}/${row}/${column} cycle complete`)
			} else {
				this.log('error', `⚠️ UP FAILED: ${upResponse.status} - button might be stuck`)
			}

			// Give Companion a bit more time to fully process and reset button state
			// This prevents rapid successive triggers from interfering with each other
			await new Promise((resolve) => setTimeout(resolve, 150))
		} catch (error) {
			this.log('error', `❌ HTTP ERROR: ${error.message}`)
		}

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
		// Ensure config is always an object
		this.config = config || {}

		// Set default values for essential config properties
		if (!this.config.http_host) this.config.http_host = '127.0.0.1'
		if (!this.config.http_port) this.config.http_port = 8000
		if (!this.config.mappingCount) this.config.mappingCount = 10
		if (this.config.midi_port_index === undefined) this.config.midi_port_index = -1
		if (!this.config.press_delay) this.config.press_delay = 500

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
		// Get available MIDI ports for dropdown
		const midiPortChoices = this.midiPortChoices || [{ id: -1, label: 'None - Please refresh MIDI ports' }]

		// Count how many mapping fields we need
		let mappingCount = parseInt(this.config.mapping_count) || 10
		const mappingFields = []

		// Create text input fields for mappings
		for (let i = 0; i < mappingCount; i++) {
			mappingFields.push({
				type: 'textinput',
				id: `mapping_${i}`,
				label: i === 0 ? 'Mappings' : '', // Only show label on first field
				width: 12,
				default: '',
				tooltip: 'Format: {MIDI: command} {page/row/column}',
			})
		}

		return [
			{
				type: 'static-text',
				id: 'info',
				label: 'Information',
				width: 12,
				value: `
					<div style="font-family: monospace;">
						<strong>🎹 MIDI to Button Trigger v2.0.0</strong><br/>
						<br/>
						<strong>Quick Start:</strong><br/>
						1. Select your MIDI port below<br/>
						2. Enter mappings (one per line)<br/>
						3. Click SAVE<br/>
						<br/>
						<strong>Mapping Format:</strong> {MIDI: command} {page/row/column}<br/>
						<br/>
						<strong>Examples:</strong><br/>
						<code>{MIDI: N60@1.on} {1/0/0}</code> - Note 60 on ch 1 → Button 1/0/0<br/>
						<code>{MIDI: CC7@1} {1/1/0}</code> - CC7 on ch 1 → Button 1/1/0<br/>
						<code>{MIDI: PC12@1} {1/2/0}</code> - Program 12 → Button 1/2/0<br/>
						<code>{MIDI: CC00.9, PC12@1} {1/3/0}</code> - Bank 9, Prog 12<br/>
						<br/>
						Use // for comments
					</div>
				`,
			},
			{
				type: 'dropdown',
				id: 'midi_port_index',
				label: 'MIDI Port',
				width: 8,
				choices: midiPortChoices,
				default: -1,
				tooltip: 'Select the MIDI input port to listen to',
			},
			{
				type: 'button',
				id: 'refresh_ports',
				label: 'Refresh',
				width: 4,
				value: 'Refresh MIDI Ports',
				callback: async () => {
					await this.refreshMidiPorts()
				},
			},
			{
				type: 'textinput',
				id: 'http_host',
				label: 'Companion IP',
				width: 6,
				default: '127.0.0.1',
				tooltip: 'IP address of Companion (usually 127.0.0.1 for local)',
				regex: '/^(?:[0-9]{1,3}\\.){3}[0-9]{1,3}$/',
			},
			{
				type: 'number',
				id: 'http_port',
				label: 'HTTP Port',
				width: 6,
				default: 8000,
				min: 1,
				max: 65535,
				tooltip: 'Companion HTTP port (default 8000)',
			},
			{
				type: 'number',
				id: 'mapping_count',
				label: 'Number of Mapping Lines',
				width: 6,
				default: 10,
				min: 1,
				max: 200,
				tooltip: 'How many mapping lines to show (save to update)',
			},
			{
				type: 'checkbox',
				id: 'debug',
				label: 'Debug Logging',
				width: 6,
				default: true,
				tooltip: 'Enable detailed logging for troubleshooting',
			},
			...mappingFields,
			{
				type: 'static-text',
				id: 'examples',
				label: 'Full Examples',
				width: 12,
				value: `
					<div style="font-family: monospace; font-size: 11px;">
						<strong>Common Use Cases:</strong><br/>
						<pre style="background: #f0f0f0; padding: 8px; border-radius: 4px;">
// === NOTES ===
{MIDI: N60@1.on} {1/0/0}     // Middle C on ch 1, note on only
{MIDI: N60@1.off} {1/0/1}    // Middle C on ch 1, note off only  
{MIDI: N60@1.both} {1/0/2}   // Middle C on ch 1, both on and off
{MIDI: N60@0.on} {1/0/3}     // Middle C any channel (@0 or omit)

// === CONTROL CHANGES ===
{MIDI: CC1@1} {1/1/0}        // Mod wheel on channel 1
{MIDI: CC7@1} {1/1/1}        // Volume on channel 1
{MIDI: CC64@1} {1/1/2}       // Sustain pedal on channel 1
{MIDI: CC10@1} {1/1/3}       // Pan on channel 1

// === PROGRAM CHANGES WITH BANKS ===
{MIDI: PC0@1} {1/2/0}        // Program 0, channel 1, current bank
{MIDI: CC00.0, PC0@1} {1/2/1}   // Bank 0 (MSB 0), Program 0
{MIDI: CC00.1, PC0@1} {1/2/2}   // Bank 128 (MSB 1), Program 0
{MIDI: CC00.2, PC0@1} {1/2/3}   // Bank 256 (MSB 2), Program 0

// === ADVANCED BANKS (MSB + LSB) ===
{MIDI: CC00.0, CC32.0, PC0@1} {2/0/0}   // Bank 0 (MSB 0, LSB 0)
{MIDI: CC00.0, CC32.1, PC0@1} {2/0/1}   // Bank 1 (MSB 0, LSB 1)
{MIDI: CC00.1, CC32.0, PC0@1} {2/0/2}   // Bank 128 (MSB 1, LSB 0)
{MIDI: CC00.1, CC32.1, PC0@1} {2/0/3}   // Bank 129 (MSB 1, LSB 1)

// === DRUM PADS TO CAMERAS ===
{MIDI: N36@10.on} {3/0/0}    // Kick drum (C1) → Camera 1
{MIDI: N38@10.on} {3/0/1}    // Snare (D1) → Camera 2  
{MIDI: N42@10.on} {3/0/2}    // Hi-hat (F#1) → Camera 3
{MIDI: N46@10.on} {3/0/3}    // Open hat (A#1) → Camera 4</pre>
					</div>
				`,
			},
		]
	}
}

runEntrypoint(Midi2ButtonsInstance, upgrades)
