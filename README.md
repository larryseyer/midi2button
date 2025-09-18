# companion-module-generic-midi2buttons

![Version](https://img.shields.io/badge/version-1.4.6-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![Companion](https://img.shields.io/badge/Companion-3.0+-orange)

Turn your MIDI controller into a button trigger for Companion.

[Download](https://github.com/bitfocus/companion-module-generic-midi2buttons/releases/latest)

## What Does This Do?

This module lets your MIDI controller trigger Companion buttons directly. When you press a key, turn a knob, or send a program change, it can press any button on any page in Companion - triggering your macros, controlling your devices, and automating your workflow.

## Typical Use Cases

- **Live Performance**: Use a MIDI foot controller to trigger scenes, cues, or camera switches in your show
- **Broadcast Control**: Map MIDI controllers to Companion buttons that control your entire broadcast setup
- **Studio Automation**: Convert MIDI keyboard/pad messages to button presses for controlling OBS, vMix, or streaming software
- **Program Changes**: Use MIDI Bank/Program Change messages from keyboards or controllers to access thousands of different button combinations (16,384 banks × 128 programs = over 2 million possible triggers!)

## Features

✅ **Super Simple Setup** - Connect your MIDI device in seconds
✅ **Live Monitoring** - See what's happening in real-time
✅ **Works with Any MIDI Device** - Keyboards, drum pads, controllers, foot pedals
✅ **Flexible Rules** - Create up to 20 different mappings (default 10)
✅ **Visual Feedback** - See triggered buttons in Companion
✅ **Bank & Program Changes** - Full support for MIDI Bank Select (0-16383) and Program Change messages
✅ **Note On/Off/Both** - Trigger on key press, release, or both
✅ **Control Changes** - Map any CC message to any button
✅ **Any Channel** - Listen to specific MIDI channels or all at once

## Quick Start Guide (3 Easy Steps!)

### Step 1: Connect Your Keyboard 🎹

1. Plug in your MIDI keyboard to your computer
2. Open the module settings in Companion
3. Pick your keyboard from the dropdown list
4. Click SAVE at the bottom

### Step 2: Configure Your Mappings 📝

1. Stay in the module settings
2. You'll see 10 mapping rules by default (can adjust up to 20)
3. For each rule:
   - Check the "On" checkbox to enable it ✅
   - Pick the Type: Note, CC, or Program
   - Set the Channel (0 = all channels)
   - Set the Bank (for Program Changes, -1 = any bank)
   - Set the Value (note number, CC number, or program number)
   - Choose Trigger: On, Off, or Both (for notes)
   - Enter the Button location: page/row/column (e.g., 1/0/0)
4. Click SAVE and you're done!

### Step 3: Test It! 🎉

1. Press keys on your MIDI controller
2. Watch the Companion buttons get triggered
3. Check the log for confirmation messages

### Monitoring Variables 📊

The module provides these variables for monitoring:

- **$(midi2buttons:midi_connected)** - Shows MIDI connection status
- **$(midi2buttons:last_triggered_page)** - Last triggered page number
- **$(midi2buttons:last_triggered_row)** - Last triggered row number
- **$(midi2buttons:last_triggered_col)** - Last triggered column number
- **$(midi2buttons:trigger_count)** - Total number of triggers

## Installation

### Easy Way

1. Download the module file from the releases page
2. Open Companion
3. Go to the Developer tab
4. Click "Import Module" and pick the file
5. Done! Find it in your Connections list

## Understanding the Settings

### What's a Mapping?

A mapping tells the module: "When I receive THIS MIDI message, press THAT Companion button"

### Mapping Settings Explained

**On** - Enable or disable this mapping

**Type** - What kind of MIDI message to listen for:
- **Note** = Piano keys, drum pads
- **CC** = Control Change (knobs, sliders, pedals)
- **Prog** = Program Change (preset/patch switches)

**Ch** - MIDI channel (1-16, or 0 for all channels)

**Bank** - For Program Changes only (-1 = any bank, 0-16383 = specific bank)

**Value** - The MIDI value to match:
- For Notes: 0-127 (Middle C = 60)
- For CC: Controller number 0-127
- For Program: Program number 0-127

**Trigger** - When to trigger (Notes only):
- **On** = Key press/pad hit
- **Off** = Key release
- **Both** = Both press and release

**Button** - Companion button location as page/row/column (e.g., 1/0/0)

### Example: Setting Up Your First Mapping

Let's make Middle C trigger button 1/0/0 in Companion:

1. **Check the On box** - Enable the mapping
2. **Set Type to Note** - We're using a piano key
3. **Set Ch to 0** - Listen on all channels
4. **Set Value to 60** - Middle C
5. **Set Trigger to On** - Trigger on key press
6. **Set Button to 1/0/0** - First button on page 1
7. **Click SAVE** at the bottom
8. **Press Middle C** - Watch button 1/0/0 get triggered!

### Using Bank and Program Changes 🎵

Program Changes let you trigger different buttons by switching "patches" on your MIDI device. Combined with Bank Select, you can access thousands of different button triggers from a single MIDI controller!

#### What Are Program Changes?

Originally designed to switch sounds on synthesizers, Program Changes are perfect for triggering different scenes, cues, or states. Many MIDI foot controllers, keyboards, and pad controllers can send these messages.

#### How It Works

1. **Your MIDI device sends:**
   - **Bank Select** (optional): CC 0 and/or CC 32 to choose a bank (0-16383)
   - **Program Change**: Selects a program number (0-127) within that bank

2. **The module responds:**
   - Tracks the current bank for each MIDI channel
   - When a Program Change arrives, checks if you have a mapping for that bank/program combo
   - Triggers the configured Companion button if there's a match

#### Setting Up a Program Change Mapping

1. Set **Type** to **"Prog"**
2. Set the **Bank** number (-1 for any bank, or 0-16383 for specific bank)
3. Set the **Value** (program number 0-127)
4. Set the **Button** location to trigger
5. Save your configuration

#### Real-World Examples

- **Live Theater**: Bank 0 = Act 1, Bank 1 = Act 2. Programs trigger different lighting/sound cues
- **Live Music**: Each song gets its own bank. Programs switch between verse/chorus/bridge
- **Broadcast**: Bank per show segment. Programs trigger camera angles or graphics
- **Installation**: Different banks for different modes (day/night/special events)

## Version History

### v1.4.6 (2025-09-18)
- Fixed default mapping count from 5 to 10
- All mappings now initialize with proper defaults

### v1.4.5 (2025-09-18)
- Fixed save button issue with regex validation

### v1.4.4 (2025-09-18)
- Fixed UI layout column widths for better visibility

### v1.4.3 (2025-09-18)
- Added full bank support for Program Changes
- Each mapping now has configurable bank field
- Program Changes only trigger when both bank and program match

### v1.4.2 (2025-09-17)
- Complete rewrite as MIDI to Button trigger module
- Direct Companion button triggering via HTTP API
- Support for Notes, CC, and Program Changes with Bank Select
- Real-time MIDI monitoring and variables

## Support

For issues or feature requests, please visit the [GitHub repository](https://github.com/bitfocus/companion-module-generic-midi2buttons).

## License

MIT License - See LICENSE file for details.