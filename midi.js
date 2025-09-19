// Import JZZ directly - webpack will bundle it properly
import JZZ from 'jzz'

export class MidiHandler {
	// Static method to check if JZZ is available
	static getJZZ() {
		return JZZ
	}

	constructor(instance) {
		this.instance = instance
		this.midiIn = null
		this.isConnected = false
		this.availablePorts = []
		this.currentPortName = null
		// Track current bank state per channel (1-16)
		this.currentBank = {}
		for (let ch = 1; ch <= 16; ch++) {
			this.currentBank[ch] = { msb: 0, lsb: 0 }
		}
	}

	async init(config) {
		if (!JZZ) {
			this.instance.log('warn', 'MIDI support not available - JZZ library not loaded')
			this.instance.setVariableValues({
				midi_status: 'Not Available',
				midi_port: 'None',
			})
			return
		}

		try {
			// Initialize JZZ MIDI engine
			await JZZ().or('Cannot start MIDI engine!')

			// Refresh port list if not already done
			if (this.availablePorts.length === 0) {
				await this.refreshPorts()
			}

			// Connect to selected port
			if (config.midi_port_index !== undefined && config.midi_port_index >= 0) {
				if (config.midi_port_index < this.availablePorts.length) {
					await this.openPort(config.midi_port_index)
				} else {
					this.instance.log(
						'warn',
						`Port index ${config.midi_port_index} out of range (${this.availablePorts.length} ports available)`
					)
				}
			} else if (this.availablePorts.length > 0 && config.midi_auto_connect) {
				// Auto-connect to first available port
				this.instance.log('info', 'Auto-connecting to first available MIDI port')
				await this.openPort(0)
			}
		} catch (error) {
			this.instance.log('error', `MIDI initialization error: ${error.message || error}`)
		}
	}

	async refreshPorts() {
		if (!JZZ) {
			this.instance.log('debug', 'JZZ not available for port refresh')
			return
		}

		try {
			// Initialize JZZ and wait for it to detect MIDI backends
			const midi = await JZZ().or('Cannot start MIDI engine!')

			// Give JZZ a moment to detect MIDI backends on macOS
			await new Promise((resolve) => setTimeout(resolve, 100))

			// Try to refresh MIDI system
			await midi.refresh()

			const info = await midi.info()

			this.instance.log('info', `MIDI Engine: ${info.engine || 'none'}`)
			this.instance.log('info', `MIDI Inputs found: ${info.inputs?.length || 0}`)

			this.availablePorts = []

			// Get input ports
			if (info.inputs && info.inputs.length > 0) {
				info.inputs.forEach((port) => {
					const name = port.name || 'Unknown MIDI Device'
					// Filter out internal/virtual ports
					if (!name.includes('Midi Through')) {
						this.availablePorts.push({
							index: this.availablePorts.length,
							name: name,
							id: port.id || name,
						})
						this.instance.log('info', `Found MIDI Port ${this.availablePorts.length - 1}: ${name}`)
					}
				})
			}

			// Log raw port info if no ports found
			if (this.availablePorts.length === 0) {
				const rawInputs = midi.info().inputs
				if (rawInputs) {
					this.instance.log('debug', `Raw inputs: ${JSON.stringify(rawInputs)}`)
				}
			}

			this.instance.log('info', `Total MIDI input ports found: ${this.availablePorts.length}`)

			// Update instance properties for UI
			this.instance.midiPorts = this.availablePorts

			// Create choices array for dropdown - THIS IS CRITICAL
			this.instance.midiPortChoices = [{ id: -1, label: 'None - Select a MIDI port' }]
			this.availablePorts.forEach((port, index) => {
				this.instance.midiPortChoices.push({
					id: index,
					label: port.name || `Port ${index}`,
				})
			})
		} catch (error) {
			this.instance.log('error', `Failed to get MIDI ports: ${error.message || error}`)
			this.instance.log('error', `Error stack: ${error.stack}`)
			this.availablePorts = []
			this.instance.midiPorts = []
			this.instance.midiPortChoices = [{ id: -1, label: 'None - Error getting MIDI ports' }]
		}
	}

	async openPort(portIndex) {
		if (!JZZ) {
			this.instance.log('debug', 'JZZ not available for opening port')
			return
		}

		try {
			// Close existing connection
			if (this.midiIn) {
				this.midiIn.close()
				this.midiIn = null
				this.isConnected = false
			}

			if (portIndex < 0 || portIndex >= this.availablePorts.length) {
				this.instance.log('error', `Invalid MIDI port index: ${portIndex}`)
				return
			}

			const port = this.availablePorts[portIndex]
			this.currentPortName = port.name

			// Open the MIDI input port
			this.midiIn = await JZZ().openMidiIn(port.name).or(`Cannot open MIDI port: ${port.name}`)

			// Connect message handler
			this.midiIn.connect((msg) => {
				this.handleMidiMessage(msg)
			})

			this.isConnected = true
			this.instance.log('info', `Connected to MIDI port ${portIndex}: ${port.name}`)

			// Update Companion variables
			this.instance.setVariableValues({
				midi_status: 'Connected',
				midi_port: port.name,
			})
		} catch (error) {
			this.instance.log('error', `Failed to open MIDI port: ${error.message || error}`)
			this.isConnected = false
			this.instance.setVariableValues({
				midi_status: 'Error',
				midi_port: 'None',
			})
		}
	}

	async closePort() {
		if (this.midiIn) {
			try {
				await this.midiIn.close()
				this.instance.log('info', `Closed MIDI port: ${this.currentPortName}`)
			} catch (error) {
				this.instance.log('error', `Error closing MIDI port: ${error.message || error}`)
			}
			this.midiIn = null
		}

		this.isConnected = false
		this.currentPortName = null

		this.instance.setVariableValues({
			midi_status: 'Disconnected',
			midi_port: 'None',
		})
	}

	handleMidiMessage(msg) {
		if (!msg || msg.length < 2) return

		const statusByte = msg[0]
		const data1 = msg[1]
		const data2 = msg[2] || 0 // Program Change messages only have 2 bytes

		// Extract channel and message type
		const channel = (statusByte & 0x0f) + 1 // MIDI channels are 1-16
		const messageType = statusByte & 0xf0

		// Always log MIDI messages for debugging
		this.instance.log(
			'info',
			`MIDI Message: Status=0x${statusByte.toString(16)} Data1=${data1} Data2=${data2} Channel=${channel}`
		)

		// Process different message types
		switch (messageType) {
			case 0x90: // Note On
				if (data2 > 0) {
					// Velocity > 0 means Note On
					this.instance.processMidiMessage(channel, 'note', data1, data2)
					this.instance.log('info', `Note ON: ch=${channel} note=${data1} vel=${data2}`)
				} else {
					// Velocity = 0 means Note Off
					this.instance.processMidiMessage(channel, 'note', data1, 0)
					this.instance.log('info', `Note OFF (vel=0): ch=${channel} note=${data1}`)
				}
				break

			case 0x80: // Note Off
				this.instance.processMidiMessage(channel, 'note', data1, 0)
				this.instance.log('info', `Note OFF: ch=${channel} note=${data1}`)
				break

			case 0xb0: // Control Change
				// Track Bank Select messages
				if (data1 === 0) {
					// Bank Select MSB (CC 0)
					this.currentBank[channel].msb = data2
					this.instance.log(
						'debug',
						`Bank Select MSB: ch=${channel} value=${data2} (new bank will be ${data2 * 128 + this.currentBank[channel].lsb})`
					)
				} else if (data1 === 32) {
					// Bank Select LSB (CC 32)
					this.currentBank[channel].lsb = data2
					this.instance.log(
						'debug',
						`Bank Select LSB: ch=${channel} value=${data2} (new bank will be ${this.currentBank[channel].msb * 128 + data2})`
					)
				}

				// Process CC message (this will log it)
				this.instance.processMidiMessage(channel, 'cc', data1, data2)
				break

			case 0xc0: {
				// Program Change
				const bankNumber = this.currentBank[channel].msb * 128 + this.currentBank[channel].lsb
				const programNumber = data1

				// Process Program Change with bank information
				this.instance.log('info', `Program Change: ch=${channel} bank=${bankNumber} program=${programNumber}`)
				this.instance.log(
					'debug',
					`Bank tracking - MSB:${this.currentBank[channel].msb} LSB:${this.currentBank[channel].lsb} Total:${bankNumber}`
				)
				this.instance.processMidiProgramChange(channel, bankNumber, programNumber)
				break
			}

			default:
				// Other message types not currently supported
				this.instance.log('info', `Unsupported MIDI message type: 0x${messageType.toString(16)}`)
				break
		}
	}

	async destroy() {
		await this.closePort()
	}
}
