export function getActions(self) {
	return {
		refresh_ports: {
			name: 'Refresh MIDI Ports',
			options: [],
			callback: async () => {
				self.log('info', 'Refreshing MIDI ports...')
				if (self.midiHandler) {
					// Store current port name if connected
					const wasConnected = self.midiHandler.isConnected
					const previousPortName = self.midiHandler.currentPortName

					await self.midiHandler.refreshPorts()
					self.log('info', `Found ${self.midiPorts?.length || 0} MIDI ports`)

					// Try to reconnect to the same port if it still exists
					if (wasConnected && previousPortName) {
						const portIndex = self.midiPorts.findIndex((p) => p.name === previousPortName)
						if (portIndex >= 0) {
							await self.midiHandler.openPort(portIndex)
							self.config.midi_port_index = portIndex
							self.saveConfig(self.config)
							self.log('info', `Reconnected to ${previousPortName}`)
						}
					}

					// Update actions to refresh dropdown
					self.updateActions()
				}
			},
		},

		connect_port: {
			name: 'Connect to MIDI Port',
			options: [
				{
					type: 'dropdown',
					label: 'MIDI Port',
					id: 'port',
					default: -1,
					choices: self.midiPortChoices,
				},
			],
			callback: async (action) => {
				const portIndex = action.options.port
				if (self.midiHandler && portIndex >= 0) {
					const success = await self.midiHandler.openPort(portIndex)
					if (success) {
						self.config.midi_port_index = portIndex
						self.saveConfig(self.config)
					}
				}
			},
		},

		disconnect_port: {
			name: 'Disconnect MIDI Port',
			options: [],
			callback: async () => {
				if (self.midiHandler) {
					await self.midiHandler.closePort()
					self.config.midi_port_index = -1
					self.saveConfig(self.config)
				}
			},
		},

		trigger_mapping: {
			name: 'Trigger Mapping',
			options: [
				{
					type: 'number',
					label: 'Mapping Number',
					id: 'mapping_index',
					default: 1,
					min: 1,
					max: 24,
					tooltip: 'Which mapping to trigger (1-24)',
				},
				{
					type: 'number',
					label: 'Value',
					id: 'value',
					default: 127,
					min: 0,
					max: 127,
					tooltip: 'The value to send (0-127)',
				},
			],
			callback: async (action) => {
				const mappingIndex = action.options.mapping_index - 1 // Convert to 0-based index
				const value = action.options.value

				// Check if the mapping exists and is enabled
				if (mappingIndex >= 0 && mappingIndex < (self.config.mappingCount || 0)) {
					const mapping = self.mappings?.[mappingIndex]
					if (mapping && mapping.enabled) {
						// Send OSC message for this mapping
						if (self.oscHandler) {
							let args = mapping.oscArgs || ''

							// Handle variable substitution based on mapping type
							if (mapping.type === 'program') {
								// For program changes, substitute bank and program values
								const bank = mapping.bank || 0
								const program = mapping.program || 0
								const channel = mapping.channel || 1

								args = args.replace(/\$\(bank\)/g, bank.toString())
								args = args.replace(/\$\(program\)/g, program.toString())
								args = args.replace(/\$\(channel\)/g, channel.toString())
								args = args.replace(/\$\(value\)/g, value.toString())
							} else {
								// For notes and CC, just replace value
								args = args.replace(/\$\(value\)/g, value.toString())
							}

							const success = self.oscHandler.sendMessage(mapping.oscIP, mapping.oscPort, mapping.oscAddress, args)
							if (success) {
								self.stats.messagesSent++
								// Store last sent OSC message in the proper format for display
								self.lastOscMessage = {
									ip: mapping.oscIP,
									port: mapping.oscPort,
									address: mapping.oscAddress,
									args: args,
									timestamp: Date.now(),
								}
								self.updateVariables()

								// Clear OSC display after timeout
								if (self.oscDisplayTimeout) {
									clearTimeout(self.oscDisplayTimeout)
								}
								self.oscDisplayTimeout = setTimeout(() => {
									self.lastOscMessage = null
									self.refreshConfigFields() // Refresh UI
									self.updateVariables()
								}, 3000)

								self.log('info', `Triggered mapping ${mappingIndex + 1}: ${mapping.oscAddress}`)
							}
						}
					} else {
						self.log('warn', `Mapping ${mappingIndex + 1} is not configured or disabled`)
					}
				} else {
					self.log('warn', `Mapping ${action.options.mapping_index} does not exist`)
				}
			},
		},

		add_mapping: {
			name: 'Add New Mapping',
			options: [],
			callback: async () => {
				const currentCount = self.config.mappingCount || 1
				if (currentCount < 24) {
					const newIndex = currentCount
					// Set defaults for the new mapping
					self.config[`mapping_${newIndex}_enabled`] = true
					self.config[`mapping_${newIndex}_channel`] = 1
					self.config[`mapping_${newIndex}_type`] = 'note'
					self.config[`mapping_${newIndex}_noteOrCC`] = 60 + newIndex
					self.config[`mapping_${newIndex}_oscIP`] = '127.0.0.1'
					self.config[`mapping_${newIndex}_oscPort`] = 8000
					self.config[`mapping_${newIndex}_oscAddress`] = `/midi/note/${60 + newIndex}`
					self.config[`mapping_${newIndex}_oscArgs`] = '$(value)'

					self.config.mappingCount = currentCount + 1
					self.saveConfig(self.config)
					self.log('info', `Added mapping ${currentCount + 1}`)
				} else {
					self.log('warn', 'Maximum number of mappings (24) reached')
				}
			},
		},

		remove_mapping: {
			name: 'Remove Last Mapping',
			options: [],
			callback: async () => {
				const currentCount = self.config.mappingCount || 1
				if (currentCount > 1) {
					// Keep at least one mapping
					const lastIndex = currentCount - 1
					// Clear the last mapping
					delete self.config[`mapping_${lastIndex}_enabled`]
					delete self.config[`mapping_${lastIndex}_channel`]
					delete self.config[`mapping_${lastIndex}_type`]
					delete self.config[`mapping_${lastIndex}_noteOrCC`]
					delete self.config[`mapping_${lastIndex}_oscIP`]
					delete self.config[`mapping_${lastIndex}_oscPort`]
					delete self.config[`mapping_${lastIndex}_oscAddress`]
					delete self.config[`mapping_${lastIndex}_oscArgs`]

					self.config.mappingCount = currentCount - 1
					self.saveConfig(self.config)
					self.log('info', `Removed mapping ${currentCount}`)
				} else {
					self.log('warn', 'Cannot remove last mapping - at least one must exist')
				}
			},
		},

		clear_mappings: {
			name: 'Clear All Mappings',
			options: [],
			callback: async () => {
				const currentCount = self.config.mappingCount || 0
				// Clear all existing mappings
				for (let i = 0; i < currentCount; i++) {
					delete self.config[`mapping_${i}_enabled`]
					delete self.config[`mapping_${i}_channel`]
					delete self.config[`mapping_${i}_type`]
					delete self.config[`mapping_${i}_noteOrCC`]
					delete self.config[`mapping_${i}_oscIP`]
					delete self.config[`mapping_${i}_oscPort`]
					delete self.config[`mapping_${i}_oscAddress`]
					delete self.config[`mapping_${i}_oscArgs`]
				}
				// Always keep at least one mapping with defaults
				self.config.mappingCount = 1
				self.config[`mapping_0_enabled`] = false // Start disabled
				self.config[`mapping_0_channel`] = 1
				self.config[`mapping_0_type`] = 'note'
				self.config[`mapping_0_noteOrCC`] = 60
				self.config[`mapping_0_oscIP`] = '127.0.0.1'
				self.config[`mapping_0_oscPort`] = 8000
				self.config[`mapping_0_oscAddress`] = '/midi/note/60'
				self.config[`mapping_0_oscArgs`] = '$(value)'

				self.mappings = []
				self.saveConfig(self.config)
				self.log('info', 'Reset mappings to default template')
				self.updateVariables()
			},
		},

		reset_stats: {
			name: 'Reset Statistics',
			options: [],
			callback: async () => {
				self.stats = {
					messagesReceived: 0,
					messagesSent: 0,
					errors: 0,
				}
				self.updateVariables()
				self.log('info', 'Statistics reset')
			},
		},

		send_test_osc: {
			name: 'Send Test OSC Message',
			options: [
				{
					type: 'textinput',
					label: 'OSC Address',
					id: 'address',
					default: '/test',
				},
				{
					type: 'textinput',
					label: 'Arguments (comma separated)',
					id: 'args',
					default: '1, hello, 3.14',
				},
				{
					type: 'textinput',
					label: 'Target IP',
					id: 'ip',
					default: '127.0.0.1',
					regex: '/^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/',
				},
				{
					type: 'number',
					label: 'Target Port',
					id: 'port',
					default: 8000,
					min: 1,
					max: 65535,
				},
			],
			callback: async (action) => {
				if (self.oscHandler) {
					const success = self.oscHandler.sendMessage(
						action.options.ip,
						action.options.port,
						action.options.address,
						action.options.args
					)
					if (success) {
						self.stats.messagesSent++
						self.updateVariables()
						self.log('info', `Sent test OSC message to ${action.options.ip}:${action.options.port}`)
					}
				}
			},
		},
	}
}
