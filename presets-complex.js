import { combineRgb } from '@companion-module/base'

export function getPresets(_self) {
	const presets = []

	// Complete Control Panel - A full set of controls for Stream Deck management
	presets.push({
		type: 'button',
		category: '1. Complete Control Panel',
		name: 'COMPLETE CONTROL PANEL (8x4 grid)',
		style: {
			text: 'Full\\nControl\\nPanel',
			size: '14',
			color: combineRgb(255, 255, 255),
			bgcolor: combineRgb(100, 0, 100),
		},
		steps: [],
		feedbacks: [],
	})

	// Row 1: Monitors
	presets.push({
		type: 'button',
		category: '1. Complete Control Panel',
		name: 'CP: MIDI Monitor',
		style: {
			text: 'MIDI IN\\n$(generic-midi2osc:last_midi_message)',
			size: '7',
			color: combineRgb(255, 255, 255),
			bgcolor: combineRgb(0, 0, 0),
		},
		steps: [],
		feedbacks: [
			{
				feedbackId: 'midi_message_matched',
				style: { bgcolor: combineRgb(0, 100, 0) },
			},
			{
				feedbackId: 'midi_message_unmatched',
				style: { bgcolor: combineRgb(100, 50, 0) },
			},
		],
	})

	presets.push({
		type: 'button',
		category: '1. Complete Control Panel',
		name: 'CP: OSC Monitor',
		style: {
			text: 'OSC OUT\\n$(generic-midi2osc:last_osc_message)',
			size: '7',
			color: combineRgb(255, 255, 255),
			bgcolor: combineRgb(0, 0, 0),
		},
		steps: [],
		feedbacks: [
			{
				feedbackId: 'osc_message_active',
				style: { bgcolor: combineRgb(0, 50, 100) },
			},
		],
	})

	// Row 2: Connection
	presets.push({
		type: 'button',
		category: '1. Complete Control Panel',
		name: 'CP: MIDI Status',
		style: {
			text: 'MIDI\\n$(generic-midi2osc:midi_status)\\n$(generic-midi2osc:midi_port)',
			size: '7',
			color: combineRgb(255, 255, 255),
			bgcolor: combineRgb(0, 0, 0),
		},
		steps: [],
		feedbacks: [
			{
				feedbackId: 'midi_connected',
				style: { bgcolor: combineRgb(0, 255, 0), color: combineRgb(0, 0, 0) },
			},
			{
				feedbackId: 'midi_disconnected',
				style: { bgcolor: combineRgb(255, 0, 0), color: combineRgb(255, 255, 255) },
			},
		],
	})

	presets.push({
		type: 'button',
		category: '1. Complete Control Panel',
		name: 'CP: Refresh Ports',
		style: {
			text: '🔄\\nRefresh\\nPorts',
			size: '14',
			color: combineRgb(255, 255, 255),
			bgcolor: combineRgb(0, 0, 100),
		},
		steps: [
			{
				down: [{ actionId: 'refresh_ports' }],
				up: [],
			},
		],
		feedbacks: [],
	})

	// Row 3: Mapping Management
	presets.push({
		type: 'button',
		category: '1. Complete Control Panel',
		name: 'CP: Add Mapping',
		style: {
			text: '➕\\nAdd',
			size: '18',
			color: combineRgb(255, 255, 255),
			bgcolor: combineRgb(0, 100, 0),
		},
		steps: [
			{
				down: [{ actionId: 'add_mapping' }],
				up: [],
			},
		],
		feedbacks: [],
	})

	presets.push({
		type: 'button',
		category: '1. Complete Control Panel',
		name: 'CP: Remove Mapping',
		style: {
			text: '➖\\nRemove',
			size: '18',
			color: combineRgb(255, 255, 255),
			bgcolor: combineRgb(150, 50, 0),
		},
		steps: [
			{
				down: [{ actionId: 'remove_mapping' }],
				up: [],
			},
		],
		feedbacks: [],
	})

	presets.push({
		type: 'button',
		category: '1. Complete Control Panel',
		name: 'CP: Mapping Count',
		style: {
			text: '📊\\n$(generic-midi2osc:mappings_count)/20',
			size: '14',
			color: combineRgb(255, 255, 255),
			bgcolor: combineRgb(0, 0, 0),
		},
		steps: [],
		feedbacks: [
			{
				feedbackId: 'has_mappings',
				style: { bgcolor: combineRgb(0, 100, 255) },
			},
		],
	})

	// Row 4: Statistics
	presets.push({
		type: 'button',
		category: '1. Complete Control Panel',
		name: 'CP: Message Stats',
		style: {
			text: 'IN: $(generic-midi2osc:messages_received)\\nOUT: $(generic-midi2osc:messages_sent)',
			size: '7',
			color: combineRgb(255, 255, 255),
			bgcolor: combineRgb(0, 0, 0),
		},
		steps: [],
		feedbacks: [
			{
				feedbackId: 'message_activity',
				options: { threshold: 10 },
				style: { bgcolor: combineRgb(0, 255, 255) },
			},
		],
	})

	presets.push({
		type: 'button',
		category: '1. Complete Control Panel',
		name: 'CP: Reset Stats',
		style: {
			text: '🔄\\nReset\\nStats',
			size: '14',
			color: combineRgb(255, 255, 255),
			bgcolor: combineRgb(100, 0, 0),
		},
		steps: [
			{
				down: [{ actionId: 'reset_stats' }],
				up: [],
			},
		],
		feedbacks: [],
	})

	// Monitor presets - These show real-time MIDI and OSC data
	presets.push({
		type: 'button',
		category: '2. Monitors (Real-time Display)',
		name: 'MIDI Input Monitor (Full)',
		style: {
			text: 'MIDI IN\\n$(generic-midi2osc:last_midi_message)',
			size: '7',
			color: combineRgb(255, 255, 255),
			bgcolor: combineRgb(0, 0, 0),
		},
		steps: [
			{
				down: [],
				up: [],
			},
		],
		feedbacks: [
			{
				feedbackId: 'midi_message_matched',
				style: {
					bgcolor: combineRgb(0, 100, 0),
					color: combineRgb(255, 255, 255),
				},
			},
			{
				feedbackId: 'midi_message_unmatched',
				style: {
					bgcolor: combineRgb(100, 50, 0),
					color: combineRgb(255, 255, 255),
				},
			},
		],
	})

	presets.push({
		type: 'button',
		category: '2. Monitors (Real-time Display)',
		name: 'OSC Output Monitor (Full)',
		style: {
			text: 'OSC OUT\\n$(generic-midi2osc:last_osc_message)',
			size: '7',
			color: combineRgb(255, 255, 255),
			bgcolor: combineRgb(0, 0, 0),
		},
		steps: [
			{
				down: [],
				up: [],
			},
		],
		feedbacks: [
			{
				feedbackId: 'osc_message_active',
				style: {
					bgcolor: combineRgb(0, 50, 100),
					color: combineRgb(255, 255, 255),
				},
			},
		],
	})

	// Compact monitor presets
	presets.push({
		type: 'button',
		category: '2. Monitors (Real-time Display)',
		name: 'MIDI Monitor (Compact)',
		style: {
			text: '$(generic-midi2osc:last_midi_message)',
			size: '7',
			color: combineRgb(255, 255, 255),
			bgcolor: combineRgb(30, 30, 30),
		},
		steps: [
			{
				down: [],
				up: [],
			},
		],
		feedbacks: [
			{
				feedbackId: 'midi_message_matched',
				style: {
					bgcolor: combineRgb(0, 80, 0),
				},
			},
			{
				feedbackId: 'midi_message_unmatched',
				style: {
					bgcolor: combineRgb(80, 40, 0),
				},
			},
		],
	})

	presets.push({
		type: 'button',
		category: '2. Monitors (Real-time Display)',
		name: 'OSC Monitor (Compact)',
		style: {
			text: '$(generic-midi2osc:last_osc_message)',
			size: '7',
			color: combineRgb(255, 255, 255),
			bgcolor: combineRgb(30, 30, 30),
		},
		steps: [
			{
				down: [],
				up: [],
			},
		],
		feedbacks: [
			{
				feedbackId: 'osc_message_active',
				style: {
					bgcolor: combineRgb(0, 40, 80),
				},
			},
		],
	})

	// Connection control presets
	presets.push({
		type: 'button',
		category: '3. Connection Management',
		name: 'Connect to First MIDI Port',
		style: {
			text: 'Connect\\nFirst Port',
			size: '14',
			color: combineRgb(255, 255, 255),
			bgcolor: combineRgb(0, 100, 0),
		},
		steps: [
			{
				down: [
					{
						actionId: 'connect_port',
						options: {
							port: 0,
						},
					},
				],
				up: [],
			},
		],
		feedbacks: [],
	})

	presets.push({
		type: 'button',
		category: '3. Connection Management',
		name: 'Disconnect MIDI',
		style: {
			text: 'Disconnect\\nMIDI',
			size: '14',
			color: combineRgb(255, 255, 255),
			bgcolor: combineRgb(100, 0, 0),
		},
		steps: [
			{
				down: [
					{
						actionId: 'disconnect_port',
					},
				],
				up: [],
			},
		],
		feedbacks: [],
	})

	presets.push({
		type: 'button',
		category: '3. Connection Management',
		name: 'MIDI Connection Status',
		style: {
			text: 'MIDI\\n$(generic-midi2osc:midi_status)',
			size: '14',
			color: combineRgb(255, 255, 255),
			bgcolor: combineRgb(0, 0, 0),
		},
		steps: [
			{
				down: [],
				up: [],
			},
		],
		feedbacks: [
			{
				feedbackId: 'midi_connected',
				style: {
					bgcolor: combineRgb(0, 255, 0),
					color: combineRgb(0, 0, 0),
				},
			},
			{
				feedbackId: 'midi_disconnected',
				style: {
					bgcolor: combineRgb(255, 0, 0),
					color: combineRgb(255, 255, 255),
				},
			},
		],
	})

	// Statistics presets
	presets.push({
		type: 'button',
		category: '4. Statistics',
		name: 'Error Monitor',
		style: {
			text: 'Reset\\nStats',
			size: '14',
			color: combineRgb(255, 255, 255),
			bgcolor: combineRgb(100, 0, 0),
		},
		steps: [
			{
				down: [
					{
						actionId: 'reset_stats',
					},
				],
				up: [],
			},
		],
		feedbacks: [],
	})

	presets.push({
		type: 'button',
		category: '4. Statistics',
		name: 'Error Counter',
		style: {
			text: 'Errors\\n$(generic-midi2osc:errors)',
			size: '14',
			color: combineRgb(255, 255, 255),
			bgcolor: combineRgb(0, 0, 0),
		},
		steps: [
			{
				down: [],
				up: [],
			},
		],
		feedbacks: [
			{
				feedbackId: 'has_errors',
				style: {
					bgcolor: combineRgb(255, 100, 0),
					color: combineRgb(255, 255, 255),
				},
			},
		],
	})

	// Mapping management is covered in Control Panel section

	// Common MIDI note mappings
	const commonNotes = [
		{ note: 36, name: 'C1' },
		{ note: 48, name: 'C2' },
		{ note: 60, name: 'C3' },
		{ note: 72, name: 'C4' },
	]

	commonNotes.forEach((noteInfo) => {
		presets.push({
			type: 'button',
			category: '5. Quick Mappings - Notes',
			name: `Add Note ${noteInfo.name} Mapping`,
			style: {
				text: `Map\\n${noteInfo.name}`,
				size: '14',
				color: combineRgb(255, 255, 255),
				bgcolor: combineRgb(0, 50, 100),
			},
			steps: [
				{
					down: [
						{
							actionId: 'add_mapping',
							options: {
								channel: 0,
								type: 'note',
								noteOrCC: noteInfo.note,
								oscAddress: `/midi/note/${noteInfo.note}`,
								oscArgs: '$(value)',
								oscIP: '127.0.0.1',
								oscPort: 8000,
							},
						},
					],
					up: [],
				},
			],
			feedbacks: [
				{
					feedbackId: 'mapping_active',
					options: {
						channel: 0,
						type: 'note',
						noteOrCC: noteInfo.note,
					},
					style: {
						bgcolor: combineRgb(255, 255, 0),
						color: combineRgb(0, 0, 0),
					},
				},
			],
		})
	})

	// Common CC mappings
	const commonCCs = [
		{ cc: 1, name: 'Mod Wheel' },
		{ cc: 7, name: 'Volume' },
		{ cc: 10, name: 'Pan' },
		{ cc: 11, name: 'Expression' },
	]

	commonCCs.forEach((ccInfo) => {
		presets.push({
			type: 'button',
			category: '6. Quick Mappings - CC',
			name: `Add CC${ccInfo.cc} ${ccInfo.name} Mapping`,
			style: {
				text: `Map CC${ccInfo.cc}\\n${ccInfo.name}`,
				size: '14',
				color: combineRgb(255, 255, 255),
				bgcolor: combineRgb(100, 0, 100),
			},
			steps: [
				{
					down: [
						{
							actionId: 'add_mapping',
							options: {
								channel: 0,
								type: 'cc',
								noteOrCC: ccInfo.cc,
								oscAddress: `/midi/cc/${ccInfo.cc}`,
								oscArgs: '$(value)',
								oscIP: '127.0.0.1',
								oscPort: 8000,
							},
						},
					],
					up: [],
				},
			],
			feedbacks: [
				{
					feedbackId: 'mapping_active',
					options: {
						channel: 0,
						type: 'cc',
						noteOrCC: ccInfo.cc,
					},
					style: {
						bgcolor: combineRgb(255, 255, 0),
						color: combineRgb(0, 0, 0),
					},
				},
			],
		})
	})

	// Test OSC preset
	presets.push({
		type: 'button',
		category: '7. Testing',
		name: 'Send Test OSC',
		style: {
			text: 'Test\\nOSC',
			size: '14',
			color: combineRgb(255, 255, 255),
			bgcolor: combineRgb(0, 100, 0),
		},
		steps: [
			{
				down: [
					{
						actionId: 'send_test_osc',
						options: {
							address: '/test',
							args: '1, hello, 3.14',
							ip: '127.0.0.1',
							port: 8000,
						},
					},
				],
				up: [],
			},
		],
		feedbacks: [],
	})

	return presets
}
