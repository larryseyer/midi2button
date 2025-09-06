import { combineRgb } from '@companion-module/base'

export function getFeedbacks(self) {
	return {
		midi_connected: {
			type: 'boolean',
			name: 'MIDI Port Connected',
			description: 'Change button color when MIDI port is connected',
			defaultStyle: {
				bgcolor: combineRgb(0, 255, 0),
				color: combineRgb(0, 0, 0),
			},
			options: [],
			callback: () => {
				return self.midiHandler?.isConnected || false
			},
		},

		midi_disconnected: {
			type: 'boolean',
			name: 'MIDI Port Disconnected',
			description: 'Change button color when MIDI port is disconnected',
			defaultStyle: {
				bgcolor: combineRgb(255, 0, 0),
				color: combineRgb(255, 255, 255),
			},
			options: [],
			callback: () => {
				return !self.midiHandler?.isConnected
			},
		},

		has_mappings: {
			type: 'boolean',
			name: 'Has Active Mappings',
			description: 'Change button color when there are active mappings',
			defaultStyle: {
				bgcolor: combineRgb(0, 100, 255),
				color: combineRgb(255, 255, 255),
			},
			options: [],
			callback: () => {
				return self.mappings && self.mappings.length > 0
			},
		},

		mapping_active: {
			type: 'boolean',
			name: 'Specific Mapping Active',
			description: 'Change button color when a specific MIDI mapping is active',
			defaultStyle: {
				bgcolor: combineRgb(255, 255, 0),
				color: combineRgb(0, 0, 0),
			},
			options: [
				{
					type: 'number',
					label: 'MIDI Channel (0=All)',
					id: 'channel',
					default: 0,
					min: 0,
					max: 16,
				},
				{
					type: 'dropdown',
					label: 'Type',
					id: 'type',
					default: 'note',
					choices: [
						{ id: 'note', label: 'Note' },
						{ id: 'cc', label: 'Control Change' },
					],
				},
				{
					type: 'number',
					label: 'Note/CC Number',
					id: 'noteOrCC',
					default: 60,
					min: 0,
					max: 127,
				},
			],
			callback: (feedback) => {
				if (!self.mappings || self.mappings.length === 0) {
					return false
				}

				return self.mappings.some(
					(mapping) =>
						mapping.enabled &&
						mapping.channel === feedback.options.channel &&
						mapping.type === feedback.options.type &&
						mapping.noteOrCC === feedback.options.noteOrCC
				)
			},
		},

		has_errors: {
			type: 'boolean',
			name: 'Has Errors',
			description: 'Change button color when there have been errors',
			defaultStyle: {
				bgcolor: combineRgb(255, 100, 0),
				color: combineRgb(255, 255, 255),
			},
			options: [],
			callback: () => {
				return self.stats?.errors > 0
			},
		},

		message_activity: {
			type: 'boolean',
			name: 'Message Activity',
			description: 'Flash when messages are being processed',
			defaultStyle: {
				bgcolor: combineRgb(0, 255, 255),
				color: combineRgb(0, 0, 0),
			},
			options: [
				{
					type: 'number',
					label: 'Activity Threshold (messages)',
					id: 'threshold',
					default: 10,
					min: 1,
					max: 1000,
				},
			],
			callback: (feedback) => {
				const total = (self.stats?.messagesReceived || 0) + (self.stats?.messagesSent || 0)
				return total >= feedback.options.threshold
			},
		},

		midi_message_matched: {
			type: 'boolean',
			name: 'MIDI Message Matched',
			description: 'Indicates when last MIDI message matched a mapping',
			defaultStyle: {
				bgcolor: combineRgb(0, 255, 0),
				color: combineRgb(0, 0, 0),
			},
			options: [],
			callback: () => {
				if (!self.lastMidiMessage) return false
				const age = Date.now() - self.lastMidiMessage.timestamp
				return age < 2000 && self.lastMidiMessage.hasMatch
			},
		},

		midi_message_unmatched: {
			type: 'boolean',
			name: 'MIDI Message Unmatched',
			description: 'Indicates when last MIDI message did not match any mapping',
			defaultStyle: {
				bgcolor: combineRgb(255, 165, 0),
				color: combineRgb(0, 0, 0),
			},
			options: [],
			callback: () => {
				if (!self.lastMidiMessage) return false
				const age = Date.now() - self.lastMidiMessage.timestamp
				return age < 2000 && !self.lastMidiMessage.hasMatch
			},
		},

		osc_message_active: {
			type: 'boolean',
			name: 'OSC Message Active',
			description: 'Indicates when an OSC message was recently sent',
			defaultStyle: {
				bgcolor: combineRgb(0, 100, 255),
				color: combineRgb(255, 255, 255),
			},
			options: [],
			callback: () => {
				return self.lastOscMessage !== null
			},
		},

		mapping_configured: {
			type: 'boolean',
			name: 'Mapping Configured',
			description: 'Change button appearance when a specific mapping is configured and enabled',
			defaultStyle: {
				bgcolor: combineRgb(0, 100, 150),
				color: combineRgb(255, 255, 255),
			},
			options: [
				{
					type: 'number',
					label: 'Mapping Number',
					id: 'mapping_index',
					default: 1,
					min: 1,
					max: 24,
				},
			],
			callback: (feedback) => {
				const mappingIndex = feedback.options.mapping_index - 1 // Convert to 0-based index

				// Check if the mapping exists and is enabled
				if (mappingIndex >= 0 && mappingIndex < (self.config.mappingCount || 0)) {
					const mapping = self.mappings?.[mappingIndex]
					return mapping && mapping.enabled
				}
				return false
			},
		},

		mapping_not_configured: {
			type: 'boolean',
			name: 'Mapping Not Configured',
			description: 'Change button appearance when a specific mapping is NOT configured or disabled',
			defaultStyle: {
				bgcolor: combineRgb(60, 60, 60),
				color: combineRgb(150, 150, 150),
			},
			options: [
				{
					type: 'number',
					label: 'Mapping Number',
					id: 'mapping_index',
					default: 1,
					min: 1,
					max: 24,
				},
			],
			callback: (feedback) => {
				const mappingIndex = feedback.options.mapping_index - 1 // Convert to 0-based index

				// Check if the mapping doesn't exist or is disabled
				if (mappingIndex >= 0 && mappingIndex < 24) {
					if (mappingIndex >= (self.config.mappingCount || 0)) {
						// Mapping doesn't exist
						return true
					}
					const mapping = self.mappings?.[mappingIndex]
					// Return true if mapping doesn't exist or is disabled
					return !mapping || !mapping.enabled
				}
				return false
			},
		},
	}
}
