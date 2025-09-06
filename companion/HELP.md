# MIDI to OSC Converter

## Overview

This module converts MIDI messages to OSC (Open Sound Control) messages, allowing you to bridge MIDI controllers with OSC-enabled software and hardware. It provides flexible mapping configuration and real-time message conversion.

## Quick Start

1. **Connect your MIDI device** to your computer
2. **Select the MIDI port** from the dropdown in the module configuration
3. **Create mappings** to define how MIDI messages are converted to OSC
4. **Start sending MIDI** - the module will automatically convert and send OSC messages

## Configuration

### MIDI Settings

- **MIDI Input Port**: Choose your MIDI device from the dropdown list
- **Auto-Connect**: Enable to automatically connect to the first available MIDI device

### Mapping Configuration

The mapping table is where you define how MIDI messages are converted to OSC. Each row represents one mapping.

#### Mapping Fields:

**Enabled**

- Toggle the mapping on/off without deleting it

**Channel**

- `0` = Accept messages from all MIDI channels
- `1-16` = Only accept messages from the specified channel

**Type**

- `note` = Note On/Off messages
- `cc` = Control Change messages

**Note/CC Number**

- For notes: 0-127 (Middle C = 60)
- For CC: 0-127 (see common CC numbers below)

**OSC Address**

- The OSC path to send to (e.g., `/mixer/fader1`)
- Must start with `/`

**OSC Arguments**

- Values to send with the OSC message
- Can use variables (see below)
- Multiple values separated by commas

**Target IP**

- IP address of the OSC receiver
- Use `127.0.0.1` for local applications

**Target Port**

- UDP port the receiver is listening on
- Common ports: 8000, 9000, 53000

### Variable Substitution

Use these variables in OSC Arguments:

- `$(value)` - The MIDI value (0-127)
  - For notes: velocity
  - For CC: controller value
- `$(channel)` - MIDI channel number (1-16)
- `$(type)` - Message type ('note' or 'cc')
- `$(notecc)` - The note or CC number

#### Examples:

- Simple value: `$(value)`
- Multiple arguments: `$(channel), $(value)`
- Mixed types: `1, $(value), hello`
- Scaled value: `$(value)` (scale in receiving application)

## Common MIDI Mappings

### Note Numbers

| Note | Number | Note | Number |
| ---- | ------ | ---- | ------ |
| C3   | 60     | C4   | 72     |
| D3   | 62     | D4   | 74     |
| E3   | 64     | E4   | 76     |
| F3   | 65     | F4   | 77     |
| G3   | 67     | G4   | 79     |
| A3   | 69     | A4   | 81     |
| B3   | 71     | B4   | 83     |

### Common CC Numbers

| CC # | Common Use     | CC # | Common Use        |
| ---- | -------------- | ---- | ----------------- |
| 1    | Mod Wheel      | 64   | Sustain Pedal     |
| 7    | Channel Volume | 65   | Portamento On/Off |
| 10   | Pan            | 71   | Filter Resonance  |
| 11   | Expression     | 74   | Filter Cutoff     |
| 91   | Reverb Level   | 93   | Chorus Level      |

## Actions

### Connection Management

**Refresh MIDI Ports**

- Scans for available MIDI devices
- Use after connecting a new MIDI device

**Connect to MIDI Port**

- Manually connect to a specific MIDI port

**Disconnect MIDI Port**

- Disconnect the current MIDI connection

### Mapping Management

**Add Mapping**

- Create a new MIDI to OSC mapping via action
- Useful for dynamic configuration

**Clear All Mappings**

- Remove all mapping configurations
- ⚠️ This cannot be undone

### Monitoring

**Reset Statistics**

- Reset all message counters to zero

**Send Test OSC**

- Send a test OSC message to verify connectivity
- Useful for troubleshooting

## Feedbacks

Visual feedback for button states:

- **MIDI Connected** - Green when MIDI port is connected
- **MIDI Disconnected** - Red when no MIDI connection
- **Has Mappings** - Blue when mappings are configured
- **Mapping Active** - Yellow for specific MIDI mapping
- **Has Errors** - Orange when errors have occurred
- **Message Activity** - Cyan when messages are flowing

## Variables

Display information on buttons:

- `$(generic-midi2osc:midi_status)` - "Connected" or "Disconnected"
- `$(generic-midi2osc:midi_port)` - Name of connected MIDI port
- `$(generic-midi2osc:messages_received)` - Count of MIDI messages
- `$(generic-midi2osc:messages_sent)` - Count of OSC messages
- `$(generic-midi2osc:errors)` - Number of errors
- `$(generic-midi2osc:mappings_count)` - Number of active mappings

## Presets

Ready-to-use button configurations:

### Connection

- **Refresh Ports** - Scan for MIDI devices
- **Connection Status** - Shows MIDI connection state

### Statistics

- **Message Counter** - Display in/out message counts
- **Error Monitor** - Show error count
- **Reset Stats** - Clear all counters

### Quick Mappings

- **Note Mappings** - C1, C2, C3, C4 quick setup
- **CC Mappings** - Common controllers (Mod, Volume, Pan, Expression)

### Testing

- **Send Test OSC** - Verify OSC connectivity

## Troubleshooting

### MIDI Device Not Found

1. Ensure MIDI device is connected before starting Companion
2. Click "Refresh MIDI Ports" action
3. Check device is not in use by another application
4. On Windows: Check MIDI device appears in Device Manager
5. On macOS: Check device in Audio MIDI Setup
6. On Linux: Check with `aconnect -l` command

### No OSC Output

1. Verify target IP address is correct
2. Check target port number
3. Ensure receiving application is running
4. Check firewall settings allow UDP traffic
5. Use "Send Test OSC" action to verify
6. Enable debug logging to see detailed messages

### Mappings Not Working

1. Check mapping is enabled (checkbox)
2. Verify channel setting (0 for all channels)
3. Confirm MIDI type matches your input
4. Test with debug logging enabled
5. Check OSC address starts with `/`
6. Verify OSC arguments syntax

### High CPU Usage

1. Reduce number of active mappings
2. Disable unused mappings
3. Avoid sending to many different IPs
4. Close unused MIDI applications

## Example Configurations

### Basic Fader Control

```
Channel: 0
Type: cc
Number: 7
OSC Address: /mixer/fader1
Arguments: $(value)
IP: 127.0.0.1
Port: 8000
```

### Note Trigger

```
Channel: 10
Type: note
Number: 36
OSC Address: /trigger/kick
Arguments: $(value)
IP: 192.168.1.100
Port: 9000
```

### Multi-Argument Message

```
Channel: 1
Type: cc
Number: 1
OSC Address: /synth/modulation
Arguments: $(channel), $(value), 0.5
IP: 127.0.0.1
Port: 53000
```

## Tips and Best Practices

1. **Start simple** - Test with one mapping first
2. **Use channel 0** initially to accept all MIDI channels
3. **Monitor statistics** to verify message flow
4. **Enable debug logging** when troubleshooting
5. **Document your mappings** for future reference
6. **Test OSC reception** with a tool like OSCulator or Pure Data
7. **Save your configuration** regularly in Companion

## Support Resources

- **Documentation**: See README.md in the module folder
- **Issues**: Report bugs on GitHub
- **Community**: Join the Bitfocus Slack
- **Updates**: Check for module updates regularly

## Performance Notes

- The module can handle hundreds of messages per second
- Each mapping adds minimal processing overhead
- Network latency depends on your network configuration
- For best performance, use wired connections
- Close unnecessary applications to reduce system load

---

_Module Version: 1.0.0_  
_Compatible with Companion 3.0+_
