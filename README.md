# companion-module-generic-midi2osc

![Version](https://img.shields.io/badge/version-1.0.4-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![Companion](https://img.shields.io/badge/Companion-3.0+-orange)

Turn your MIDI keyboard into an OSC controller.

[Download](https://github.com/larryseyer/companion-module-generic-midi2osc/releases/download/v1.0.4/generic-midi2osc-1.0.4.tgz)

## What Does This Do?

This module lets your MIDI keyboard talk to other programs using OSC messages. When you press a key on your keyboard or send a bank and program change, it can send a message to control lighting, audio, video, or any other OSC-enabled software.

## Typical Use Cases

- **Live Performance**: Use a MIDI foot controller to trigger scenes, cues, or effects in QLab, Resolume, or other OSC-enabled software
- **Broadcast Control**: Map MIDI controllers to control video switchers, audio mixers, or lighting consoles via OSC
- **Studio Automation**: Convert MIDI keyboard/pad messages to OSC for controlling DAWs, plugins, or custom software
- **Program Changes**: Use MIDI Bank/Program Change messages from keyboards or controllers to switch between hundreds of different OSC commands (16,384 banks × 128 programs = over 2 million possible combinations!)

## Features

✅ **Super Simple Setup** - Connect your keyboard in seconds
✅ **Live Monitoring** - See what's happening in real-time
✅ **Works with Any MIDI Device** - Keyboards, drum pads, controllers
✅ **Flexible Rules** - Create up to 24 different mappings with custom names
✅ **Visual Feedback** - Buttons light up to show activity
✅ **Bank & Program Changes** - Support for MIDI Bank Select and Program Change messages
✅ **Enhanced UI** - Color-coded rules, duplicate/delete/reorder capabilities
✅ **Import/Export** - Share or backup your rule configurations

## Quick Start Guide (3 Easy Steps!)

### Step 1: Connect Your Keyboard 🎹

1. Plug in your MIDI keyboard to your computer
2. Open the module settings in Companion
3. Pick your keyboard from the dropdown list
4. Click SAVE at the bottom

### Step 2: Make Your Rules 📝

1. Stay in the module settings
2. Choose how many rules you want (start with 1 or 2, up to 24)
3. Click SAVE to see your rules appear
4. For each rule:
   - Give it a name (optional but helpful!)
   - Check "Enable this rule" ✅
   - Pick what key triggers it (like Middle C = 60)
   - Set where to send the message (usually keep the defaults)
5. Click SAVE again and you're done!

### Step 3: Test It! 🎉

1. Press keys on your MIDI keyboard
2. If a key matches one of your rules, it sends an OSC message
3. Check your receiving program to see the messages arrive

### Optional: Monitor with Stream Deck Buttons 🎯

If you have a Stream Deck and want to see what's happening:

1. Go to the Buttons tab in Companion
2. Find "generic-midi2osc" in the list
3. Drag these monitoring buttons to your Stream Deck:
   - **MIDI Connection** - Shows if your keyboard is connected (green = good!)
   - **Activity Light** - Flashes green when messages are sent
   - **MIDI Input** - Shows what key you're pressing
   - **OSC Output** - Shows what message was sent

## Installation

### Easy Way

1. Download the module file from the releases page
2. Open Companion
3. Go to the Developer tab
4. Click "Import Module" and pick the file
5. Done! Find it in your Connections list

## Understanding the Settings

### What's a Rule?

A rule tells the module: "When I press THIS key, send THAT message"

### Rule Settings Explained (In Simple Terms)

**📝 Rule Name** - Give your rule a descriptive name (e.g., "Trigger Next Cue", "Red Lights")

**✅ Enable this rule** - Check this box to make the rule work

**📦 Collapse rule details** - Save screen space by hiding the rule configuration

**What kind of control?**

- 🎹 Piano Key = A regular key on your keyboard
- 🎛️ Knob/Slider = A knob or slider that you can turn/move
- 🎵 Program Change = Used to switch sounds/patches with bank selection

**Which number?** - Every key has a number (Middle C = 60)

- Don't know the number? Press the key and watch the MIDI Input button!

**From which channel?** - Usually keep this on "🌍 All Keys"

**Message name** - The name of your OSC message (like `/midi/note/60`)

**Message data** - What information to send:

- `$(value)` = How hard you pressed the key (velocity)
- `$(channel)` = The MIDI channel number
- `$(bank)` = The bank number (for Program Changes)
- `$(program)` = The program number (for Program Changes)
- Keep this as-is unless you know what you're doing

**To which computer?** - Where to send the message:

- `127.0.0.1` = This computer (most common)
- Or enter another computer's IP address

**On which port?** - The network port number (usually 8000 or 9000)

### Example: Setting Up Your First Rule

Let's make Middle C on your keyboard send an OSC message:

1. **Name your rule** - Type something like "My First Rule" (optional)
2. **Turn on Rule 1** - Check the "✅ Enable this rule" box
3. **Set it to Piano Key** - Choose "🎹 Piano Key" from the dropdown
4. **Enter 60** - That's Middle C's number
5. **Keep the rest as default** - It's already set up correctly
6. **Click SAVE** at the bottom
7. **Press Middle C** - Watch the Activity Light turn green!

That's it! When you press Middle C, it sends `/midi/note/60` with the velocity value.

### Using Bank and Program Changes 🎵

Program Changes let you trigger different OSC commands by switching "patches" on your MIDI device. Combined with Bank Select, you can access thousands of different triggers from a single MIDI controller!

#### What Are Program Changes?

Originally designed to switch sounds on synthesizers, Program Changes are perfect for triggering different scenes, cues, or states in your software. Many MIDI foot controllers, keyboards, and pad controllers can send these messages.

#### How It Works

1. **Your MIDI device sends two things:**
   - **Bank Select** (optional): CC 0 and/or CC 32 to choose a bank (0-16383)
   - **Program Change**: Selects a program number (0-127) within that bank

2. **The module responds:**
   - Tracks the current bank for each MIDI channel
   - When a Program Change arrives, checks if you have a rule for that bank/program combo
   - Sends your configured OSC message if there's a match

#### Setting Up a Program Change Rule

1. In your rule configuration, select **"🎵 Program Change"** from the dropdown
2. Set the **🏦 Bank Number** (0-16383) - which bank to listen for
3. Set the **🎵 Program Number** (0-127) - which program in that bank
4. Configure your **OSC message** to send when this combo is received
5. Save your configuration

#### Real-World Examples

- **Live Theater**: Bank 0 = Act 1, Bank 1 = Act 2. Program Changes trigger different lighting/sound cues
- **Live Music**: Each song gets its own bank. Program Changes switch between verse/chorus/bridge effects
- **Broadcast**: Bank per show segment. Programs trigger different camera angles or graphics
- **Installation**: Different banks for different modes (day/night/special events)

**Example Setup**:

- MIDI sends: Bank 2, Program 5
- Module sends: `/qlab/go/next` to trigger the next cue
- Or: `/resolume/layer/1/clip/17/connect` to trigger a specific video clip

### Advanced Features (New in 1.0.4!)

#### Rule Management

Each rule now has a **dropdown menu** with actions:

1. **📋 Duplicate this rule** - Create a copy of the rule
2. **🗑️ Delete this rule** - Remove the rule
3. **⬆️ Move this rule up** - Reorder rules
4. **⬇️ Move this rule down** - Reorder rules
5. **📤 Export this rule to log** - Export just this rule

**How to use:** Select an action from the dropdown and click SAVE. The action executes and the dropdown resets.

#### Global Actions

At the top of the configuration, use the Global Actions dropdown for:

- **📤 Export ALL rules to Companion Log** - Exports all rules as JSON
- **🗑️ Clear ALL rules** - Remove all rules and start fresh

#### Import/Export Rules

**IMPORTANT:** Exports appear in the **Companion Log Window** formatted as JSON with clear copy markers!

**To Export:**

1. Select "Export ALL rules" from Global Actions dropdown (or "Export this rule" from a rule's dropdown)
2. Click SAVE
3. Open Companion's Log window: **View → Log** (or press Cmd/Ctrl+Shift+L)
4. Look for the lines between `=====COPY FROM HERE=====` and `=====COPY TO HERE=====`
5. Select **EVERYTHING** from the first marker to the last marker (including the marker lines)
6. Copy (Cmd/Ctrl+C) - don't worry about timestamps, they're automatically cleaned during import!

**To Import:**

1. Copy your exported data from the log (including all timestamps and markers) or from a saved file
2. Paste it directly into the "Import Rules" field in the configuration
3. Click SAVE
4. Your rules will be imported and the mapping count will update automatically
5. The import field will clear upon successful import

**What's Included in Export:**

- All your mapping rules with their settings
- MIDI port configuration (automatically restored on import)
- Rule names and all parameters

**Smart Import Features:**

- Automatically strips timestamps from log output
- Finds and extracts JSON data regardless of format
- Handles both old format (array) and new format (with MIDI port)
- Updates mapping count to match imported rules
- Clears import field after successful import

Perfect for:

- Backing up your configuration with MIDI port settings
- Sharing complete setups with colleagues
- Moving configurations between computers
- Creating templates for different shows/events
- Recovering from configuration issues

## Usage

### Quick Start with Stream Deck

1. Add the module in Companion
2. Go to the Buttons tab in Companion
3. Click on "**1. Complete Control Panel**" preset category
4. Drag all 9 buttons to your Stream Deck (they form a complete control interface)
5. Press the **CP: Refresh Ports** button to scan for MIDI devices
6. Check the **CP: MIDI Status** button - it will turn green when connected
7. Watch the **CP: MIDI Monitor** to see incoming MIDI messages
8. Press **CP: Add Mapping** to create MIDI to OSC mappings
9. The **CP: OSC Monitor** will show messages being sent

### Manual Setup via Config

1. Add the module in Companion
2. Open the module configuration
3. Select your MIDI input device from the dropdown
4. Click Save to connect
5. Configure your mappings (or use the Stream Deck buttons to add them)
6. OSC messages will be sent automatically when matching MIDI is received

## Optional: Stream Deck Button Reference

_Note: These buttons are optional! Everything can be configured in the module settings. Use these only if you want real-time monitoring and control on your Stream Deck._

### Category 1: Status Buttons

#### 🎹 MIDI Connection

Shows if your keyboard is connected

- **Green** = Connected and ready!
- **Red** = Not connected (check your keyboard)
- Also shows your keyboard's name

#### ✓ Activity Light

**LIGHTS UP GREEN** when a MIDI key matches a rule and sends OSC!

- This is your main indicator that everything is working
- If it doesn't light up, check that your rules are turned on

### Category 2: Monitor Buttons

#### 🎹 MIDI Input

Shows exactly what you're pressing on your keyboard

- **Green background** = This key has a rule and sent OSC!
- **Orange background** = No rule for this key yet
- Shows: Type | Channel | Number | Value

#### 📡 OSC Output

Shows the OSC message that was just sent

- **Blue background** = Message sent!
- Shows where it went and what was sent
- Disappears after 3 seconds

### Category 3: Testing Buttons

#### 🔧 Send Test OSC

Press this to test your OSC connection

- Sends a test message to make sure OSC is working
- If your receiving program sees this, you're all set!

#### ⚠️ Error Display

Shows if something went wrong

- Normally shows 0 errors
- **Orange background** = There's a problem to fix

### Category 4: Quick Triggers (NEW!)

#### 🎯 Trigger 1-24

**24 Quick-action buttons to manually trigger your configured mappings!**

Each button (Trigger 1 through Trigger 24) corresponds to one of your configured rules:

- **Press** = Sends the OSC message with value 127 (full velocity)
- **Release** = Sends the OSC message with value 0 (note off)
- **Works exactly like pressing the configured MIDI key** on your keyboard

Perfect for:

- Testing your mappings without needing the MIDI keyboard
- Creating Stream Deck shortcuts for frequently used OSC messages
- Triggering OSC events when your MIDI keyboard isn't available
- Building a hybrid control surface with both MIDI and Stream Deck triggers
- **Filling an entire Stream Deck XL page** (24 buttons + 2 for page navigation = 32 total)

**Note**: These buttons only work if the corresponding mapping is configured and enabled. For example, Trigger 1 only works if Rule 1 is set up and turned on in your configuration. Unconfigured buttons appear greyed out for visual clarity.

### Actions

Available actions for button programming:

- **Refresh MIDI Ports**: Scan for available MIDI devices
- **Connect to MIDI Port**: Connect to a specific MIDI port
- **Disconnect MIDI Port**: Disconnect current MIDI connection
- **Trigger Mapping** (NEW!): Manually trigger a specific mapping with a custom value
- **Add New Mapping**: Add a new MIDI to OSC mapping
- **Remove Last Mapping**: Remove the most recently added mapping
- **Clear All Mappings**: Remove all mappings
- **Reset Statistics**: Reset message counters
- **Send Test OSC**: Send a test OSC message

### Feedbacks

Visual feedback options for buttons:

- **MIDI Port Connected**: Green when connected
- **MIDI Port Disconnected**: Red when disconnected
- **Has Active Mappings**: Blue when mappings exist
- **Specific Mapping Active**: Yellow for specific MIDI mapping
- **Mapping Configured** (NEW!): Shows when a specific mapping number is configured and enabled
- **Mapping Not Configured** (NEW!): Grey out button when mapping is not configured or disabled
- **Has Errors**: Orange when errors occurred
- **Message Activity**: Cyan flash on message activity

### Variables

Available variables for display:

- `$(generic-midi2osc:midi_status)`: Connection status
- `$(generic-midi2osc:midi_port)`: Connected port name
- `$(generic-midi2osc:messages_received)`: MIDI message count
- `$(generic-midi2osc:messages_sent)`: OSC message count
- `$(generic-midi2osc:errors)`: Error count
- `$(generic-midi2osc:mappings_count)`: Number of mappings

## Troubleshooting (When Things Don't Work)

### My keyboard isn't showing up!

- Make sure it's plugged in and turned on
- Try unplugging and plugging it back in
- Restart Companion
- Make sure no other program is using your keyboard

### The Activity Light doesn't turn green!

- Check that your rule is turned ON (checkbox checked)
- Make sure you're pressing the right key number
- Check that your MIDI Connection button is green

### My other program isn't getting OSC messages!

- Make sure the port number matches (try 9000 if 8000 doesn't work)
- Check that your other program is listening for OSC
- Press the "Send Test OSC" button - if that works, the problem is with your rules
- Make sure the IP address is correct (127.0.0.1 for same computer)

### Common Port Numbers

- **8000** - Default (but sometimes used by other programs)
- **9000** - Good alternative if 8000 is busy
- **7000** - Another option
- **53000** - QLab default

## Support

- **Bug Reports**: [GitHub Issues](https://github.com/bitfocus/companion-module-generic-midi2osc/issues)
- **Feature Requests**: [GitHub Discussions](https://github.com/bitfocus/companion-module-generic-midi2osc/discussions)
- **Community**: [Bitfocus Slack](https://bitfocus.io/slack)

## Development

### Building from Source

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Build for production
npm run build

# Create package
npm run package
```

### Code Quality

```bash
# Format code
npm run format

# Run linter
npm run lint
```

## License

MIT License - see [LICENSE](LICENSE) file for details

## Credits

Created by Larry Seyer

Based on the Bitfocus Companion module framework
