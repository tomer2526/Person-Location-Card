# Person Location Card

A simple Lovelace card that shows room-level location (BLE) and a general GPS home/away indicator (green/gray dot).

## HACS Installation (Dashboard / Plugin)
1. Add this repo as a Custom Repository in HACS with Type = **Dashboard** (it is still called a "plugin" in HACS).
2. Install the repo from HACS.
3. Add the resource (Resources):
   - URL: `/hacsfiles/person-room-card/person-room-card.js`
   - Type: `JavaScript Module`

> Note: HACS expects the `.js` file to be in the repo root or in `dist/`, and at least one file must match the repo name. So the repo should be named `person-room-card` (or match the JS filename).

## Example
```yaml
type: custom:person-room-card
name: Alex
room_entities:
  - entity: sensor.private_ble_device_alex_phone_area
    label: Phone
  - entity: sensor.alex_watch_ble_area
    label: Watch
  - entity: sensor.alex_tablet_ble_area
    label: Tablet
gps_entity: device_tracker.alex_phone
tap_action:
  action: navigate
  navigation_path: >-
    /history?entity_id=sensor.alex_watch_ble_area%2Csensor.private_ble_device_alex_phone_area%2Cdevice_tracker.alex_phone
```

## UI Configuration
The card supports the Home Assistant visual editor, including adding/removing entities (restricted to `sensor` and `device_tracker`), selecting a `gps_entity`, and setting a label per device. The editor also shows each entity's `friendly_name` next to its entity ID.

### Single Room Entity Example
```yaml
type: custom:person-room-card
name: Alex
room_entities:
  - sensor.private_ble_device_alex_phone_area
gps_entity: device_tracker.alex_phone
```

## Configuration Options
- `name` (string): The display name.
- `room_entities` (array, required): Any number of room-level entities. You can provide:
  - entity_id strings
  - or objects with `entity` and `label` (if not provided, defaults to `Device 1`, `Device 2`, etc.)
- `gps_entity` (string, optional): GPS entity (device_tracker) for the home/away dot.
- `area_attribute` (string, default `area_name`): Attribute that contains the room name.  
  - If set to `state`, the card will use the entity state.  
  - If set to a custom attribute and it does not exist, the room will be treated as unknown.  
  - Dot paths are supported (e.g., `some.nested.attribute`).
- `icon_home` / `icon_away` (string): MDI icons for home/away.
- `text` (object): Text overrides. Available fields:
  - `away`: Text when not home
  - `same_room`: Text when everyone is in the same room (`{room}`, `{count}`). If `{room}` is missing, the card will append ` - {room}` automatically. If `same_room` is not set, the card will fall back to `single` when everyone is in the same room.
  - `both`: Text when exactly two devices are in different rooms (`{label1}`, `{room1}`, `{label2}`, `{room2}`)
  - `single`: Text when only one room is detected (`{room}`, `{label}`). If neither `{room}` nor `{label}` is included, the card will append ` - {room}` automatically.
  - `item`: List item template (default `{label}: {room}`)
  - `separator`: Separator between items (default ` | `)
  - `list`: Wrapper template for the full list (uses `{items}`)
- `tap_action` (object, optional): Currently supports `action: navigate` with `navigation_path`.
  - If `tap_action` is not set, tapping opens the history page for all configured entities (`room_entities` + `gps_entity` if present).

## hacs.json
This project includes `hacs.json` in the repo root with `name`, `filename`, and `render_readme`.
