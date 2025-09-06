import { combineRgb } from '@companion-module/base'

export function getPresets(_self) {
	const presets = []

	// Essential monitoring buttons only - Simple and clear

	// Group 1: Status
	presets.push({
		type: 'button',
		category: '1. Status',
		name: 'MIDI Connection',
		style: {
			text: '🎹 MIDI\\n$(generic-midi2osc:midi_status)\\n$(generic-midi2osc:midi_port)',
			size: '7',
			color: combineRgb(255, 255, 255),
			bgcolor: combineRgb(0, 0, 0),
		},
		steps: [],
		feedbacks: [
			{
				feedbackId: 'midi_connected',
				style: {
					bgcolor: combineRgb(0, 200, 0),
					color: combineRgb(255, 255, 255),
				},
			},
			{
				feedbackId: 'midi_disconnected',
				style: {
					bgcolor: combineRgb(200, 0, 0),
					color: combineRgb(255, 255, 255),
				},
			},
		],
	})

	presets.push({
		type: 'button',
		category: '1. Status',
		name: 'Activity Light',
		style: {
			text: '✓\\nMATCHED',
			size: '18',
			color: combineRgb(255, 255, 255),
			bgcolor: combineRgb(40, 40, 40),
		},
		steps: [],
		feedbacks: [
			{
				feedbackId: 'midi_message_matched',
				style: {
					bgcolor: combineRgb(0, 255, 0),
					color: combineRgb(0, 0, 0),
				},
			},
		],
	})

	// Group 2: Monitors
	presets.push({
		type: 'button',
		category: '2. Monitors',
		name: 'MIDI Input',
		style: {
			text: '🎹 IN\\n$(generic-midi2osc:last_midi_message)',
			size: '7',
			color: combineRgb(255, 255, 255),
			bgcolor: combineRgb(0, 0, 40),
		},
		steps: [],
		feedbacks: [
			{
				feedbackId: 'midi_message_matched',
				style: {
					bgcolor: combineRgb(0, 100, 0),
				},
			},
			{
				feedbackId: 'midi_message_unmatched',
				style: {
					bgcolor: combineRgb(100, 50, 0),
				},
			},
		],
	})

	presets.push({
		type: 'button',
		category: '2. Monitors',
		name: 'OSC Output',
		style: {
			text: '📡 OUT\\n$(generic-midi2osc:last_osc_message)',
			size: '7',
			color: combineRgb(255, 255, 255),
			bgcolor: combineRgb(0, 0, 40),
		},
		steps: [],
		feedbacks: [
			{
				feedbackId: 'osc_message_active',
				style: {
					bgcolor: combineRgb(0, 50, 100),
				},
			},
		],
	})

	// Group 3: Testing
	presets.push({
		type: 'button',
		category: '3. Testing',
		name: 'Send Test OSC',
		style: {
			text: '🔧\\nTest\\nOSC',
			size: '14',
			color: combineRgb(255, 255, 255),
			bgcolor: combineRgb(100, 100, 0),
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

	presets.push({
		type: 'button',
		category: '3. Testing',
		name: 'Error Display',
		style: {
			text: '⚠️\\nErrors\\n$(generic-midi2osc:errors)',
			size: '14',
			color: combineRgb(255, 255, 255),
			bgcolor: combineRgb(40, 40, 40),
		},
		steps: [],
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

	// Group 4: Quick Triggers - 24 preset buttons to trigger mappings
	for (let i = 1; i <= 24; i++) {
		presets.push({
			type: 'button',
			category: '4. Quick Triggers',
			name: `Trigger ${i}`,
			style: {
				text: `🎯\\nTrigger\\n${i}`,
				size: '14',
				color: combineRgb(255, 255, 255),
				bgcolor: combineRgb(0, 100, 150),
			},
			steps: [
				{
					down: [
						{
							actionId: 'trigger_mapping',
							options: {
								mapping_index: i,
								value: 127,
							},
						},
					],
					up: [
						{
							actionId: 'trigger_mapping',
							options: {
								mapping_index: i,
								value: 0,
							},
						},
					],
				},
			],
			feedbacks: [
				{
					feedbackId: 'mapping_not_configured',
					options: {
						mapping_index: i,
					},
					style: {
						bgcolor: combineRgb(60, 60, 60),
						color: combineRgb(150, 150, 150),
					},
				},
			],
		})
	}

	return presets
}
