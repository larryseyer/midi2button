# companion-module-generic-midi2buttons

![Version](https://img.shields.io/badge/version-2.0.2-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![Companion](https://img.shields.io/badge/Companion-3.0+-orange)

Turn your MIDI controller into a button trigger for Companion.

[Download](https://github.com/bitfocus/companion-module-generic-midi2buttons/releases/latest)

## What Does This Do?

This module lets your MIDI controller trigger Companion buttons directly. When you press a key, turn a knob, or send a program change, it can press any button on any page in Companion - triggering your macros, controlling your devices, and automating your workflow.

## 🚀 Version 2.0.2 - Bug Fix

**Fixed mapping count configuration:**

- Fixed typo preventing mapping_count configuration from working properly
- Users can now set mapping_count to any value between 1-200
- Previously, mappings beyond 10 were being ignored due to incorrect config field name

## Version 2.0.1 - Bug Fix

**Fixed critical startup crash on fresh installations:**

- Module now initializes properly on new machines without existing configuration
- Added proper default values for all configuration parameters
- No migration or backward compatibility changes - clean fix only

## Version 2.0.0 - Major Update

**Complete redesign with a powerful text-based mapping system!**

- No more confusing menus - just simple, readable text mappings
- Support for unlimited mappings (previously limited to 20)
- Cleaner, more intuitive syntax
- Full bank support for program changes (MSB and LSB)

## Typical Use Cases

- **Live Performance**: Use a MIDI foot controller to trigger scenes, cues, or camera switches in your show
- **Broadcast Control**: Map MIDI controllers to Companion buttons that control your entire broadcast setup
- **Studio Automation**: Convert MIDI keyboard/pad messages to button presses for controlling OBS, vMix, or streaming software
- **Program Changes**: Use MIDI Bank/Program Change messages from keyboards or controllers to access thousands of different button combinations (16,384 banks × 128 programs = over 2 million possible triggers!)

## Features

✅ **Text-Based Mapping** - Simple, readable format for all your mappings
✅ **Unlimited Mappings** - No more limits, add as many as you need
✅ **Live Monitoring** - See what's happening in real-time
✅ **Works with Any MIDI Device** - Keyboards, drum pads, controllers, foot pedals
✅ **Visual Feedback** - See triggered buttons in Companion
✅ **Full Bank Support** - Complete MSB/LSB bank select for 16,384 banks
✅ **Note On/Off/Both** - Trigger on key press, release, or both
✅ **Control Changes** - Map any CC message to any button
✅ **Any Channel** - Listen to specific MIDI channels or all at once

## Quick Start Guide (Even Easier!)

### Step 1: Connect Your MIDI Device 🎹

1. Plug in your MIDI controller to your computer
2. Open the module settings in Companion
3. Pick your device from the MIDI Port dropdown
4. Click SAVE

### Step 2: Add Your Mappings 📝

In the **Mappings** text area, enter one mapping per line using this simple format:

```
{MIDI: command} {page/row/column}
```

### Examples:

```
// Program Changes with Bank Select
{MIDI: CC00.9, PC12@1} {1/0/0}     // Bank 9, Program 12, Channel 1
{MIDI: CC00.2, CC32.5, PC64@1} {1/0/1}  // Bank MSB 2, LSB 5, Program 64
{MIDI: PC12@1} {1/0/2}             // Program 12, Channel 1 (no bank change)

// Notes
{MIDI: N60@1.on} {1/1/0}           // Middle C, Channel 1, Note On
{MIDI: N60@1.off} {1/1/1}          // Middle C, Channel 1, Note Off
{MIDI: N60@0.both} {1/1/2}         // Middle C, All channels, both on/off

// Control Changes
{MIDI: CC7@1} {1/2/0}              // Volume (CC7), Channel 1
{MIDI: CC64@0} {1/2/1}             // Sustain pedal, All channels
{MIDI: CC1@16} {1/2/2}             // Mod wheel, Channel 16
```

### Step 3: Save and Test! 🎉

1. Click SAVE at the bottom
2. Press keys on your MIDI controller
3. Watch Companion buttons get triggered
4. Check the log for confirmation

## Mapping Syntax Guide

### Format

`{MIDI: <commands>} {page/row/column}`

### Commands

**Program Changes:**

- `PC<num>@<channel>` - Program change (0-127) on channel (1-16, 0=all)
- `CC00.<value>` - Bank MSB (0-127)
- `CC32.<value>` - Bank LSB (0-127)

**Notes:**

- `N<num>@<channel>.<trigger>` - Note (0-127) on channel with trigger
- Trigger options: `on`, `off`, `both`

**Control Changes:**

- `CC<num>@<channel>` - Control Change (0-127) on channel

### Tips

- Use `@0` or omit channel for all channels
- Comments can be added with `//`
- Bank values: 0-127 for MSB/LSB
- Note/CC/Program values: 0-127
- Middle C = Note 60

## Monitoring Variables 📊

The module provides these variables:

- **$(midi2buttons:midi_status)** - MIDI connection status
- **$(midi2buttons:last_triggered_page)** - Last triggered page
- **$(midi2buttons:last_triggered_row)** - Last triggered row
- **$(midi2buttons:last_triggered_col)** - Last triggered column
- **$(midi2buttons:trigger_count)** - Total triggers count

## Installation

### Easy Way

1. Download the module file from releases
2. Open Companion
3. Go to Developer tab
4. Click "Import Module" and select the file
5. Find it in your Connections list!

## Real-World Examples

### Live Theater

```
// Act 1 cues (Bank 0)
{MIDI: CC00.0, PC1@1} {1/0/0}   // Opening scene
{MIDI: CC00.0, PC2@1} {1/0/1}   // Scene 2
{MIDI: CC00.0, PC3@1} {1/0/2}   // Scene 3

// Act 2 cues (Bank 1)
{MIDI: CC00.1, PC1@1} {2/0/0}   // Act 2 opening
{MIDI: CC00.1, PC2@1} {2/0/1}   // Scene 2
```

### Broadcast Control

```
// Camera switching
{MIDI: N36@10.on} {1/0/0}       // Cam 1 (kick drum triggers cam)
{MIDI: N38@10.on} {1/0/1}       // Cam 2 (snare triggers cam)
{MIDI: N42@10.on} {1/0/2}       // Cam 3 (hi-hat triggers cam)

// Graphics control
{MIDI: CC1@1} {1/1/0}           // Mod wheel controls lower third
{MIDI: CC7@1} {1/1/1}           // Volume fader controls overlay
```

## Version History

### v2.0.0 (2025-01-19)

- **Major Update**: Complete redesign with text-based mapping system
- Removed complex UI menus in favor of simple text format
- Support for unlimited mappings
- Improved parsing with better error handling
- Updated to use modern fetch API for button triggers
- Full support for Bank MSB and LSB (16,384 banks)
- Fixed button state management for reliable repeated triggers
- Implemented proper down/up button press sequence with optimized delays
- Added button press queueing to handle rapid MIDI messages

### v1.4.6 (2025-01-18)

- Fixed default mapping count and initialization

### v1.4.2 (2025-01-17)

- Initial release of MIDI to Button trigger module

## Support

For issues or feature requests, visit the [GitHub repository](https://github.com/bitfocus/companion-module-generic-midi2buttons).

## License

MIT License - See LICENSE file for details.
