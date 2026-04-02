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
      throw new Error("room_entities must be a non-empty array of entity IDs");
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
        
      }
      ha-card:hover {
        background-color: color-mix(in srgb, var(--card-background-color), #ffffff 8%);
      }
      @supports not (background-color: color-mix(in srgb, #000000, #ffffff)) {
        ha-card:hover {
          filter: brightness(1.04);
        }
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

    const roomEntities = room_entities.map((item, index) => {
      if (typeof item === "string") return { entity: item };
      if (item && typeof item === "object") {
        return { entity: item.entity, label: item.label };
      }
      return { entity: null };
    });

    const entries = roomEntities.map((entry, index) => {
      const label = entry.label || `מכשיר ${index + 1}`;
      const room = this._getAreaName(entry.entity, area_attribute);
      return { entity: entry.entity, label, room };
    });

    const present = entries.filter((entry) => Boolean(entry.room));
    const anyRoom = present.length > 0;

    const labelText = this._buildLabel({
      present,
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

    if (this._hasTapAction()) {
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

  _buildLabel({ present, text }) {
    const textAway = text.away || "לא בבית";
    const textSame = text.same_room || "נמצא בחדר — {room}";
    const textBoth = text.both || "{label1}: {room1} | {label2}: {room2}";
    const textSingle = text.single || "נמצא בחדר — {room}";
    const itemTemplate = text.item || "{label}: {room}";
    const separator = text.separator || " | ";
    const listTemplate = text.list || "{items}";

    if (present.length === 0) return textAway;

    const allSameRoom = present.every((entry) => entry.room === present[0].room);
    if (present.length > 1 && allSameRoom) {
      return this._replaceTokens(textSame, { room: present[0].room, count: present.length });
    }

    if (present.length === 1) {
      return this._replaceTokens(textSingle, {
        room: present[0].room,
        label: present[0].label,
      });
    }

    if (present.length === 2) {
      return this._replaceTokens(textBoth, {
        label1: present[0].label,
        room1: present[0].room,
        label2: present[1].label,
        room2: present[1].room,
      });
    }

    const items = present.map((entry) => {
      return this._replaceTokens(itemTemplate, {
        label: entry.label,
        room: entry.room,
      });
    });

    return this._replaceTokens(listTemplate, { items: items.join(separator) });
  }

  _replaceTokens(template, values) {
    return Object.keys(values).reduce((acc, key) => {
      return acc.replace(new RegExp(`\\{${key}\\}`, "g"), values[key]);
    }, template);
  }

  _handleTap() {
    const tap = this._config?.tap_action;
    if (tap && tap.action) {
      if (tap.action === "navigate" && tap.navigation_path) {
        this._navigate(tap.navigation_path);
      }
      return;
    }

    const historyPath = this._buildHistoryPath();
    if (historyPath) {
      this._navigate(historyPath);
    }
  }

  _navigate(path) {
    window.history.pushState(null, "", path);
    window.dispatchEvent(new Event("location-changed"));
  }

  _hasTapAction() {
    const tap = this._config?.tap_action;
    if (tap && tap.action) return true;
    return Boolean(this._buildHistoryPath());
  }

  _buildHistoryPath() {
    const roomEntities = Array.isArray(this._config?.room_entities)
      ? this._config.room_entities
      : [];
    const entityIds = roomEntities
      .map((item) => {
        if (typeof item === "string") return item;
        if (item && typeof item === "object") return item.entity;
        return null;
      })
      .filter((entity) => Boolean(entity));

    if (this._config?.gps_entity) {
      entityIds.push(this._config.gps_entity);
    }

    if (entityIds.length === 0) return null;
    const encoded = encodeURIComponent(entityIds.join(","));
    return `/history?entity_id=${encoded}`;
  }
}

customElements.define("person-room-card", PersonRoomCard);

window.customCards = window.customCards || [];
window.customCards.push({
  type: "person-room-card",
  name: "Person Location Card",
  description: "Shows room-level BLE presence plus GPS home/away indicator.",
});
