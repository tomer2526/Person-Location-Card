# Person Location Card

A Lovelace card that shows room-level presence from BLE entities and a general location home/away indicator.
<table>
  <tr>
    <td>
      <img width="422" height="303" alt="Screenshot 1" src="https://github.com/user-attachments/assets/c4637293-b627-4263-abd1-c9869ae5540b" />
    </td>
    <td>
      <img width="400" height="377" alt="Screenshot 2" src="https://github.com/user-attachments/assets/083d196f-f9ac-453e-bf6f-81f4049cde7e" />
    </td>
  </tr>
</table>

## Highlights
- Unlimited room entities with per-device labels
- General location entity (home/away dot)
- Optional custom icons and text templates
- UI editor with add/remove, drag-and-drop reorder, and entity pickers
- Tap to open history for all configured entities (default)

## HACS Installation (Dashboard / Plugin)
1. Add this repo as a Custom Repository in HACS with Type = **Dashboard**.
2. Install the repo from HACS.
3. Add the resource in **Settings > Dashboards > Resources**:
   - URL: `/hacsfiles/person-room-card/person-room-card.js`
   - Type: `JavaScript Module`

> Note: HACS expects the `.js` file to be in the repo root or in `dist/`, and at least one file must match the repo name. Name the repo `person-room-card` (or match the JS filename).

## Example (YAML)
```yaml
type: custom:person-room-card
name: Alex
room_entities:
  - entity: sensor.alex_phone_ble_area
    label: Phone
  - entity: sensor.alex_watch_ble_area
    label: Watch
gl_entity: device_tracker.alex_phone
```

## Example (Single Room Entity)
```yaml
type: custom:person-room-card
name: Alex
room_entities:
  - sensor.alex_phone_ble_area
gl_entity: device_tracker.alex_phone
```

## UI Configuration
The card supports the Home Assistant visual editor. You can add and remove room entities, reorder them by drag-and-drop, and set a label for each device. Entity selection is limited to `sensor` and `device_tracker`. The general location entity uses `device_tracker` only.

## Configuration Options
- `name` (string, optional): Display name.
- `room_entities` (array, required): Any number of room-level entities. You can provide:
  - entity_id strings, or
  - objects with `entity` and `label` (if not provided, defaults to `Device 1`, `Device 2`, etc.)
- `gl_entity` (string, optional): General location entity (`device_tracker`) for the home/away dot.
- `area_attribute` (string, default `area_name`): Attribute that contains the room name.
  - If set to `state`, the card will use the entity state.
  - If set to a custom attribute and it does not exist, the room will be treated as unknown.
  - Dot paths are supported (e.g., `some.nested.attribute`).
- `icon_home` / `icon_away` (string, optional): MDI icons for home/away. Use an empty string to hide the icon.
- `dot_home_color` / `dot_away_color` / `dot_unavailable_color` (string, optional): Dot colors for home, away, and unavailable states. Accepts any CSS color value.
- `text` (object, optional): Text overrides.
  - `away`: Text when not home
  - `same_room`: Text when everyone is in the same room (`{room}`, `{count}`). If `{room}` is missing, the card will append ` - {room}` automatically. If `same_room` is not set, the card falls back to `single` when everyone is in the same room.
  - `both`: Text when exactly two devices are in different rooms (`{label1}`, `{room1}`, `{label2}`, `{room2}`)
  - `single`: Text when only one room is detected (`{room}`, `{label}`). If neither `{room}` nor `{label}` is included, the card will append ` - {room}` automatically.
  - `item`: List item template (default `{label}: {room}`)
  - `separator`: Separator between items (default ` | `)
  - `list`: Wrapper template for the full list (uses `{items}`)
- `tap_action` (object, optional): Supports `action: navigate` with `navigation_path`.
  - If `tap_action` is not set, tapping opens the history page for all configured entities (`room_entities` + `gl_entity` if present).

## HACS Metadata
This project includes `hacs.json` in the repo root with `name`, `filename`, and `render_readme`.
