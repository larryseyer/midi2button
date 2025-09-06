import osc from 'osc'

export class OscHandler {
	constructor(instance) {
		this.instance = instance
		this.udpPort = null
		this.sockets = new Map() // Cache UDP sockets per target
	}

	async init(_config) {
		// Initialize OSC
		try {
			// Create a UDP port for sending OSC messages
			this.udpPort = new osc.UDPPort({
				localAddress: '0.0.0.0',
				localPort: 0, // Use any available port
				broadcast: true,
			})

			this.udpPort.on('error', (error) => {
				this.instance.log('error', `OSC error: ${error.message}`)
				this.instance.stats.errors++
				this.instance.updateVariables()
			})

			// Open the port
			await new Promise((resolve, reject) => {
				this.udpPort.open()
				this.udpPort.on('ready', resolve)
				this.udpPort.on('error', reject)
				setTimeout(() => reject(new Error('OSC port open timeout')), 5000)
			})

			this.instance.log('info', 'OSC handler initialized')
			return true
		} catch (error) {
			this.instance.log('error', `Failed to initialize OSC: ${error.message}`)
			return false
		}
	}

	parseArguments(argsString) {
		if (!argsString || argsString.trim() === '') {
			return []
		}

		const args = []
		const parts = argsString.split(',').map((s) => s.trim())

		for (const part of parts) {
			// Try to parse as number
			const num = parseFloat(part)
			if (!isNaN(num)) {
				args.push({
					type: part.includes('.') ? 'f' : 'i',
					value: num,
				})
			} else {
				// Treat as string
				args.push({
					type: 's',
					value: part,
				})
			}
		}

		return args
	}

	sendMessage(ip, port, address, argsString) {
		if (!this.udpPort) {
			this.instance.log('error', 'OSC handler not initialized')
			return false
		}

		try {
			// Parse arguments
			const args = this.parseArguments(argsString)

			// Create OSC message
			const oscMessage = {
				address: address,
				args: args,
			}

			if (this.instance.config.enable_logging) {
				this.instance.log('debug', `Sending OSC to ${ip}:${port} - ${address} with args: ${JSON.stringify(args)}`)
			}

			// Send the message
			this.udpPort.send(oscMessage, ip, port)

			return true
		} catch (error) {
			this.instance.log('error', `Failed to send OSC message: ${error.message}`)
			this.instance.stats.errors++
			this.instance.updateVariables()
			return false
		}
	}

	async destroy() {
		// Close all sockets
		for (const socket of this.sockets.values()) {
			try {
				socket.close()
			} catch (_error) {
				// Ignore errors during cleanup
			}
		}
		this.sockets.clear()

		// Close UDP port
		if (this.udpPort) {
			try {
				await new Promise((resolve) => {
					this.udpPort.close()
					setTimeout(resolve, 100)
				})
			} catch (_error) {
				// Ignore errors during cleanup
			}
			this.udpPort = null
		}
	}
}
