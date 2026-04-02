class PersonRoomCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = null;
    this._hass = null;
    this._elements = null;
  }

  static get VERSION() {
    return "0.1.0";
  }

  setConfig(config) {
    if (!config) {
      throw new Error("Config is required");
    }

    const roomEntities = config.room_entities || [];
    if (!Array.isArray(roomEntities) || roomEntities.length === 0) {
      throw new Error("room_entities must be an array with 1-2 entity IDs");
    }

    this._config = {
      name: config.name || "",
      room_entities: roomEntities,
      gps_entity: config.gps_entity || null,
      area_attribute: config.area_attribute || "area_name",
      icon_home: config.icon_home || "mdi:home-account",
      icon_away: config.icon_away || "mdi:home-off",
      tap_action: config.tap_action || null,
      text: config.text || {},
    };

    if (!this._elements) {
      this._renderSkeleton();
    }

    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    this._render();
  }

  getCardSize() {
    return 2;
  }

  _renderSkeleton() {
    const style = document.createElement("style");
    style.textContent = `
      :host { display: block; }
      ha-card {
        position: relative;
        background: var(--card-background-color);
        border-radius: 16px;
        box-shadow: var(--ha-card-box-shadow);
        border: 1px solid rgba(0, 0, 0, 0.06);
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        text-align: center;
        padding: 10px;
        transition: all 0.3s ease;
      }
      .icon {
        width: 42px;
        height: 42px;
        margin-bottom: 8px;
      }
      .icon ha-icon {
        width: 42px;
        height: 42px;
      }
      .name {
        font-size: 18px;
        font-weight: 600;
        color: var(--primary-text-color);
      }
      .label {
        font-size: 14px;
        color: var(--secondary-text-color);
        line-height: 1.4;
        text-align: center;
      }
      .status-dot {
        position: absolute;
        top: 10px;
        right: 10px;
        width: 12px;
        height: 12px;
        border-radius: 50%;
        background: rgba(0, 0, 0, 0.25);
      }
      .clickable {
        cursor: pointer;
      }
    `;

    const card = document.createElement("ha-card");

    const statusDot = document.createElement("div");
    statusDot.className = "status-dot";

    const iconWrapper = document.createElement("div");
    iconWrapper.className = "icon";
    const icon = document.createElement("ha-icon");
    iconWrapper.appendChild(icon);

    const name = document.createElement("div");
    name.className = "name";

    const label = document.createElement("div");
    label.className = "label";

    card.appendChild(statusDot);
    card.appendChild(iconWrapper);
    card.appendChild(name);
    card.appendChild(label);

    this.shadowRoot.appendChild(style);
    this.shadowRoot.appendChild(card);

    this._elements = { card, statusDot, icon, name, label };

    card.addEventListener("click", () => this._handleTap());
  }

  _render() {
    if (!this._config || !this._hass || !this._elements) return;

    const { name, room_entities, gps_entity, area_attribute, icon_home, icon_away, text } = this._config;

    const roomEntities = room_entities.slice(0, 2).map((item) => {
      if (typeof item === "string") return { entity: item };
      if (item && typeof item === "object") return { entity: item.entity, label: item.label };
      return { entity: null };
    });

    const roomNames = roomEntities.map((entry) => this._getAreaName(entry.entity, area_attribute));

    const label1 = roomEntities[0]?.label || "מכשיר 1";
    const label2 = roomEntities[1]?.label || "מכשיר 2";

    const hasRoom1 = Boolean(roomNames[0]);
    const hasRoom2 = Boolean(roomNames[1]);
    const anyRoom = hasRoom1 || hasRoom2;

    const labelText = this._buildLabel({
      hasRoom1,
      hasRoom2,
      room1: roomNames[0],
      room2: roomNames[1],
      label1,
      label2,
      text,
    });

    const icon = anyRoom ? icon_home : icon_away;
    const iconColor = anyRoom ? "var(--primary-color)" : "rgba(0,0,0,0.3)";

    this._elements.icon.setAttribute("icon", icon);
    this._elements.icon.style.color = iconColor;
    this._elements.name.textContent = name;
    this._elements.label.textContent = labelText;

    if (gps_entity) {
      const tracker = this._hass.states[gps_entity];
      const isHome = tracker && tracker.state === "home";
      const tooltip = isHome ? "הטלפון בבית לפי GPS" : "הטלפון לא בבית לפי GPS";
      this._elements.statusDot.style.background = isHome
        ? "limegreen"
        : "rgba(0,0,0,0.25)";
      this._elements.statusDot.setAttribute("title", tooltip);
      this._elements.statusDot.style.display = "block";
    } else {
      this._elements.statusDot.style.display = "none";
    }

    if (this._config.tap_action && this._config.tap_action.action) {
      this._elements.card.classList.add("clickable");
    } else {
      this._elements.card.classList.remove("clickable");
    }
  }

  _getAreaName(entityId, areaAttribute) {
    if (!entityId || !this._hass) return null;
    const stateObj = this._hass.states[entityId];
    if (!stateObj) return null;
    const attrValue = stateObj.attributes?.[areaAttribute];
    const value = attrValue ?? stateObj.state;
    if (!value || value === "unknown" || value === "unavailable") return null;
    return value;
  }

  _buildLabel({ hasRoom1, hasRoom2, room1, room2, label1, label2, text }) {
    const textAway = text.away || "לא בבית";
    const textSame = text.same_room || "נמצא בחדר — {room}";
    const textBoth = text.both || "{label1}: {room1} | {label2}: {room2}";
    const textSingle = text.single || "נמצא בחדר — {room}";

    if (!hasRoom1 && !hasRoom2) return textAway;
    if (hasRoom1 && hasRoom2 && room1 === room2) {
      return this._replaceTokens(textSame, { room: room1 });
    }
    if (hasRoom1 && hasRoom2) {
      return this._replaceTokens(textBoth, {
        label1,
        label2,
        room1,
        room2,
      });
    }
    if (hasRoom1) return this._replaceTokens(textSingle, { room: room1 });
    return this._replaceTokens(textSingle, { room: room2 });
  }

  _replaceTokens(template, values) {
    return Object.keys(values).reduce((acc, key) => {
      return acc.replace(new RegExp(`\\{${key}\\}`, "g"), values[key]);
    }, template);
  }

  _handleTap() {
    const tap = this._config?.tap_action;
    if (!tap || !tap.action) return;

    if (tap.action === "navigate" && tap.navigation_path) {
      const path = tap.navigation_path;
      window.history.pushState(null, "", path);
      window.dispatchEvent(new Event("location-changed"));
      return;
    }
  }
}

customElements.define("person-room-card", PersonRoomCard);

window.customCards = window.customCards || [];
window.customCards.push({
  type: "person-room-card",
  name: "Person Room Card",
  description: "Shows room-level BLE presence plus GPS home/away indicator.",
});
