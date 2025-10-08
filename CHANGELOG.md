# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.2] - 2025-01-22

### Fixed

- **Mapping count configuration bug**: Fixed typo where `parseMappings()` was reading `this.config.mappingCount` instead of `this.config.mapping_count`, causing the module to always default to 10 mappings regardless of user configuration

## [2.0.1] - 2025-01-22

### Fixed

- **Critical startup crash on fresh installations**: Module now properly initializes with default configuration values when no config exists
- Added null-safe config handling in `init()`, `configUpdated()`, and `parseMappings()` methods
- Default values: `http_host: '127.0.0.1'`, `http_port: 8000`, `mappingCount: 10`, `midi_port_index: -1`, `press_delay: 500`

## [2.0.0] - 2025-01-19

### Changed - BREAKING CHANGES

- **Complete UI Redesign**: Replaced complex field-based configuration with simple text-based mapping system
  - Removed all dropdown menus, checkboxes, and individual field inputs
  - New syntax: `{MIDI: command} {page/row/column}` for all mappings
  - Support for unlimited mappings (was limited to 20)
  - Much cleaner and more intuitive interface

### Added

- **Text-Based Mapping Parser**: Powerful new parser supporting:
  - Program Changes with full bank support: `{MIDI: CC00.9, PC12@1} {1/0/0}`
  - Notes with triggers: `{MIDI: N60@1.on} {1/1/0}`
  - Control Changes: `{MIDI: CC7@1} {1/2/0}`
  - Comments with `//` for documentation
  - Line-by-line error reporting

- **Enhanced Bank Support**:
  - Full MSB/LSB support for 16,384 banks
  - Syntax: `CC00.X` for MSB, `CC32.X` for LSB
  - Automatic bank calculation from MSB and LSB values

- **Comprehensive Examples**: Built-in examples showing all use cases with inline comments

### Improved

- **HTTP API Communication**: Updated to use modern fetch API instead of http.request
  - Better error handling
  - Timeout support (5 seconds)
  - More reliable button triggering

- **Simplified Configuration**: Only 4 config fields now:
  - MIDI Port selection
  - Companion IP and Port
  - Mappings text area

### Fixed

- **Column Alignment**: No more misaligned headers and fields
- **Channel Visibility**: Channel selection now fully visible
- **Bank Field**: Proper space allocation for bank values

## [1.4.6] - 2025-09-18

### Fixed

- **Default Mapping Count**: Changed default from 5 to 10 mappings
  - All 10 mappings now initialize properly with 'note' type as default
  - Fixes issue where only first 5 mappings were being initialized

## [1.4.5] - 2025-09-18

### Fixed

- **Save Button**: Fixed regex validation syntax that was preventing the configuration from saving
  - Removed incorrect quote wrapping around regex pattern

## [1.4.4] - 2025-09-18

### Fixed

- **UI Layout**: Fixed column width allocation for mapping rules
  - Increased Bank field width for better visibility of bank numbers
  - Value field now has adequate space to display 3-digit values (0-127)
  - Button location field optimized, removed "(P/R/C)" suffix to save space
  - All columns now properly align with 12-grid system preventing row overflow

## [1.4.3] - 2025-09-18

### Fixed

- **Bank Support for Program Changes**: Added proper bank filtering for Program Change messages
  - Each mapping rule now has a bank field (-1 for any bank, 0-16383 for specific banks)
  - Program Changes now only trigger when both program number AND bank match
  - Matches behavior of the OSC version which correctly filters by bank
- **UI Layout**: Adjusted column widths to accommodate new Bank field in mapping rules

### Added

- **Bank Field**: New bank configuration for each mapping rule with tooltip explaining usage
- **Enhanced Logging**: Added debug logging for bank tracking (MSB, LSB, and calculated bank number)

## [1.0.5] - 2025-09-17

### Fixed

- **MIDI Message Handling**: Enhanced MIDI message processing with comprehensive logging for all message types
- **Bank Select Tracking**: Improved bank select calculation and logging to show actual bank numbers (MSB \* 128 + LSB)
- **OSC Message Format**: Fixed OSC handler to properly send messages without arguments when none are specified (for simple path-based triggers)
- **Program Change Debugging**: Added detailed logging for program change messages to aid in troubleshooting

### Changed

- **Enhanced Logging**: All MIDI messages now logged with clear formatting for easier debugging
- **OSC Sending**: Simplified OSC message sending to support both argument-based and path-only messages
- **Bank State Display**: Bank select messages now show the calculated bank number immediately

### Improved

- **Debugging Capability**: Much more verbose and helpful logging throughout the MIDI-to-OSC pipeline
- **Message Visibility**: Clear indication of what's being received (MIDI) and sent (OSC) in logs
- **Error Reporting**: Better error messages when MIDI ports cannot be opened or OSC messages fail

## [1.0.4] - 2025-09-07

### Added

- **Rule Naming**: Each mapping rule can now have a custom name for easy identification
- **Action Dropdowns**: Each rule has a dropdown menu with actions (duplicate, delete, move up/down, export)
- **Global Actions**: New global dropdown for exporting all rules or clearing all rules
- **Import/Export**:
  - Export individual rules or all rules to Companion Log window with clear COPY markers
  - Export includes MIDI port configuration for complete backup
  - Import rules from JSON pasted in configuration field
  - Smart import that automatically strips timestamps from log output
  - Import automatically updates mapping count to match imported rules
  - Import field clears automatically after successful import
  - Clear visual markers (`=====COPY FROM HERE=====` and `=====COPY TO HERE=====`) for easy copying
- **Helper Function Buttons**: New button functions for duplicate, delete, move, import, and export operations
- **Enhanced Instructions**: Added clear UI instructions for accessing rule management features

### Changed

- **Improved UI Layout**: Rules are now wrapped in distinctly colored containers with stronger borders
- **Export Method**:
  - Exports now use warning level logs (yellow/orange) for better visibility
  - Export format changed to include MIDI port configuration
  - Exports are now pretty-printed JSON for better readability
- **Import Logic**: Uses smart JSON extraction
  - Finds JSON array/object boundaries regardless of surrounding text
  - Properly handles nested structures and quoted strings
  - Supports both old format (array) and new format (with MIDI port)
- **Action Execution**: Dropdown actions execute on SAVE and auto-reset to prevent accidental re-triggers
- **Updated Field Labels**: More descriptive labels and tooltips throughout
- **Better Visual Hierarchy**: Clearer separation between rule sections

## [1.0.3] - 2025-09-06

### Added

- **Full Bank and Program Change Support**:
  - Responds to MIDI Program Change messages with Bank Select support
  - Tracks bank state via CC 0 (MSB) and CC 32 (LSB) per MIDI channel
  - Supports 16,384 banks × 128 programs = over 2 million possible triggers
  - New "🎵 Program Change" mapping type in configuration
- **Enhanced Configuration UI**:
  - Dedicated Bank Number field (0-16383) for Program Change mappings
  - Dedicated Program Number field (0-127) for Program Change mappings
  - Clear visual separation between Note/CC and Program Change fields
  - Added helpful inline documentation for Program Change setup

- **New Variables for OSC Messages**:
  - `$(bank)` - Current bank number
  - `$(program)` - Program number
  - Works alongside existing `$(value)`, `$(channel)`, `$(notecc)` variables

### Changed

- **Improved UI Text**:
  - Changed "WHEN I press..." to "WHEN we receive..." to better reflect MIDI input nature
  - Updated help text throughout to clarify the module receives MIDI and sends OSC
  - Reorganized field layout for better visibility and understanding

- **MIDI Display Enhancement**:
  - Now shows "Program Change | Ch X | Bank Y | Prog Z" format for Program Changes
  - Maintains existing display format for Notes and CC messages

### Fixed

- **Critical Bug Fix**: Program Change messages (2-byte) were being rejected due to incorrect message length check
  - Changed minimum message length from 3 bytes to 2 bytes
  - Program Changes now work correctly

### Technical Details

- Program Change messages are properly handled as 2-byte MIDI messages (status + program)
- Bank selection uses standard MIDI implementation (CC 0 for MSB, CC 32 for LSB)
- Full 14-bit bank addressing (0-16383) per MIDI specification
- Maintains complete backward compatibility with existing Note and CC mappings
- Each MIDI channel maintains independent bank state

## [1.0.2] - 2025-09-05

### Added

- **24 Quick Trigger Preset Buttons**: New preset category "Quick Triggers" with 24 buttons (Trigger 1-24) that can manually trigger configured mappings - perfect for filling a Stream Deck XL page (24 triggers + 2 page nav = 32)
- **Trigger Mapping Action**: New action to manually trigger any configured mapping with a custom value (0-127)
- **Mapping Configuration Feedbacks**: New feedbacks to show when a mapping is configured/not configured (trigger buttons grey out when unassigned)
- **Improved Button Documentation**: Comprehensive explanations of all preset buttons in README

### Changed

- **Increased mapping limit from 20 to 24**: Support for more complex setups and full Stream Deck XL pages
- Preset buttons now organized into 4 clear categories: Status, Monitors, Testing, and Quick Triggers
- Trigger buttons send value 127 on press and 0 on release, mimicking actual MIDI key behavior

### Improved

- Better naming conventions for preset buttons - renamed "Mapping" buttons to "Trigger" for clarity
- Enhanced README with detailed explanations of each preset button's function
- Clearer documentation of the trigger functionality and use cases

## [1.0.1] - 2025-09-05

### Added

- **MIDI Display Window**: Real-time display of incoming MIDI messages (Note/CC, Channel, Number, Value) with visual feedback showing whether the message matches a configured mapping
- **OSC Message Display**: Shows the complete OSC message being sent when a MIDI trigger is received, including IP, port, address and arguments. Auto-clears after 3 seconds
- **Improved Mapping Management**: Replaced the number input field with a more intuitive display showing current mapping count and instructions to use actions for adding/removing mappings

### Changed

- Improved user interface for better user experience
- Enhanced visual feedback for MIDI message matching
- Updated configuration layout for clearer organization

### Fixed

- UI now properly refreshes when MIDI messages are received

## [1.0.0] - 2025-09-04

### Added

#### Core Features

- Initial release of MIDI to OSC converter module for Bitfocus Companion
- Full MIDI input support with automatic port detection
- Flexible MIDI to OSC mapping configuration
- Support for Note On/Off and Control Change messages
- MIDI channel filtering (all channels or specific channel)
- Dynamic OSC message generation with variable substitution

#### User Interface

- Comprehensive configuration interface with mapping table
- Real-time connection status display
- Message statistics tracking (received, sent, errors)
- Visual feedback for button states
- Debug logging option for troubleshooting

#### Presets

- Connection control presets (Refresh, Connect/Disconnect)
- Statistics monitoring presets
- Quick mapping presets for common notes (C1-C4)
- Quick mapping presets for common CCs (Mod Wheel, Volume, Pan, Expression)
- Test OSC message preset

#### Actions

- Refresh MIDI ports
- Connect to specific MIDI port
- Disconnect MIDI port
- Add new mapping dynamically
- Clear all mappings
- Reset statistics
- Send test OSC message

#### Feedbacks

- MIDI port connection status (connected/disconnected)
- Active mappings indicator
- Specific mapping active status
- Error occurrence indicator
- Message activity indicator

#### Variables

- `midi_status`: Current MIDI connection status
- `midi_port`: Name of connected MIDI port
- `messages_received`: Count of MIDI messages received
- `messages_sent`: Count of OSC messages sent
- `errors`: Count of errors occurred
- `mappings_count`: Number of active mappings

### Technical Details

- Built with @companion-module/base v1.11.3
- Uses JZZ library for MIDI handling
- Uses osc library for OSC communication
- Full TypeScript/ES6 module support
- Comprehensive error handling and logging

### Known Limitations

- Currently supports only MIDI input (not output)
- Limited to Note and CC messages (no SysEx, Program Change, etc.)
- OSC arguments support basic types (integers, floats, strings)

---

## Future Roadmap

### Planned Features

- MIDI output support for bidirectional communication
- Support for additional MIDI message types (Program Change, Pitch Bend, SysEx)
- Mapping profiles for quick switching between configurations
- MIDI learn mode for easy mapping creation
- OSC input support for bidirectional OSC communication
- Advanced filtering options (velocity ranges, value mapping curves)
- Mapping groups for organized configuration
- Import/export mapping configurations

### Under Consideration

- MIDI clock sync
- MSC (MIDI Show Control) support
- OSC bundle support
- Network MIDI (RTP-MIDI) support
- WebSocket output option
- Custom scripting for complex transformations

---

## Support

For bug reports and feature requests, please visit:

- [GitHub Issues](https://github.com/bitfocus/companion-module-generic-midi2osc/issues)

## Contributors

- Larry Seyer - Initial development and maintenance

## License

This project is licensed under the MIT License - see the LICENSE file for details.
