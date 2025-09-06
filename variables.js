export function getVariableDefinitions() {
	return [
		{
			variableId: 'midi_status',
			name: 'MIDI Connection Status',
		},
		{
			variableId: 'midi_port',
			name: 'Connected MIDI Port',
		},
		{
			variableId: 'messages_received',
			name: 'MIDI Messages Received',
		},
		{
			variableId: 'messages_sent',
			name: 'OSC Messages Sent',
		},
		{
			variableId: 'errors',
			name: 'Error Count',
		},
		{
			variableId: 'mappings_count',
			name: 'Number of Active Mappings',
		},
		{
			variableId: 'last_midi_message',
			name: 'Last MIDI Message Display',
		},
		{
			variableId: 'last_osc_message',
			name: 'Last OSC Message Display',
		},
	]
}
