# Person Room Card

כרטיס Lovelace פשוט שמציג מיקום לפי חדר (BLE) ועדיין נותן אינדיקציה כללית לפי GPS (נקודה ירוקה/אפרה).

## התקנה דרך HACS (Dashboard / Plugin)
1. הוסף את הריפו כ־Custom Repository ב־HACS עם Type = **Dashboard** (זה עדיין נקרא "plugin" בצד של HACS).
2. התקן את הריפו מתוך HACS.
3. הוסף את המשאב (Resources):
   - URL: `/hacsfiles/person-room-card/person-room-card.js`
   - Type: `JavaScript Module`

> הערה: ב־HACS הדרישה היא שקובץ ה־`.js` יהיה בשורש הריפו או ב־`dist/`, ושאחד הקבצים יהיה בשם זהה לריפו. לכן שם הריפו צריך להיות `person-room-card` (או שם שתואם לקובץ ה־JS).

## דוגמת שימוש
```yaml
type: custom:person-room-card
name: תומר
room_entities:
  - entity: sensor.private_ble_device_tomer_iphone16_pro_area
    label: טלפון
  - entity: sensor.tomer_apple_watch_private_ble_area
    label: שעון
gps_entity: device_tracker.tomers_iphone
tap_action:
  action: navigate
  navigation_path: >-
    /history?entity_id=sensor.tomer_apple_watch_private_ble_area%2Csensor.private_ble_device_tomer_iphone16_pro_area%2Cdevice_tracker.tomers_iphone
```

### דוגמה עם ישות חדר אחת בלבד
```yaml
type: custom:person-room-card
name: תומר
room_entities:
  - sensor.private_ble_device_tomer_iphone16_pro_area
gps_entity: device_tracker.tomers_iphone
```

## אפשרויות קונפיגורציה
- `name` (string): שם שיופיע בכרטיס.
- `room_entities` (array, חובה): עד שתי ישויות שמחזירות חדר. אפשר לתת:
  - מחרוזות של entity_id
  - או אובייקטים עם `entity` ו־`label`
- `gps_entity` (string, אופציונלי): ישות GPS (device_tracker) לנקודת מצב בבית/לא בבית.
- `area_attribute` (string, ברירת מחדל `area_name`): שם האטריביוט שמכיל את שם החדר.
- `icon_home` / `icon_away` (string): אייקונים ל־mdi כשהחדר קיים/לא קיים.
- `text` (object): החלפת טקסטים. שדות אפשריים:
  - `away`: טקסט כשלא בבית
  - `same_room`: טקסט כששני המכשירים באותו חדר (`{room}`)
  - `both`: טקסט כשכל אחד בחדר אחר (`{label1}`, `{room1}`, `{label2}`, `{room2}`)
  - `single`: טקסט כשיש רק חדר אחד (`{room}`)
- `tap_action` (object, אופציונלי): כרגע נתמך `action: navigate` עם `navigation_path`.

## hacs.json
בפרויקט הזה יש `hacs.json` בשורש הריפו עם `name`, `filename` ו־`render_readme`.
