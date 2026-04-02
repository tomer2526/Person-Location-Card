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

    const roomEntities = config.room_entities ?? [];
    if (config.room_entities !== undefined && !Array.isArray(roomEntities)) {
      throw new Error("room_entities must be an array of entity IDs");
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
        transition: box-shadow 0.2s ease;
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
        --mdc-icon-size: 42px;
        --ha-icon-size: 42px;
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

class PersonLocationCardEditor extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = {};
    this._hass = null;
    this._editorEntries = [];
  }

  setConfig(config) {
    this._config = config || {};
    this._editorEntries = this._normalizeEntries(this._config);
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    this._render();
  }

  _render() {
    if (!this.shadowRoot) return;

    this.shadowRoot.innerHTML = `
      <style>
        .form {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .devices {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .labels {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .device-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
          align-items: center;
        }
        .device-entity {
          padding: 12px;
          border-radius: 6px;
          background: var(--secondary-background-color);
          color: var(--primary-text-color);
          font-size: 14px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .hint {
          font-size: 12px;
          color: var(--secondary-text-color);
        }
      </style>
      <div class="form">
        <ha-textfield
          label="Name"
          value="${this._config.name || ""}"
          data-field="name"
        ></ha-textfield>

        <ha-entities-picker
          label="Room entities"
          data-field="room_entities"
        ></ha-entities-picker>

        <div class="devices">
          <div class="labels">
            ${this._renderLabelRows()}
          </div>
          <div class="hint">
            אפשר להגדיר שם לכל מכשיר. אם לא מוגדר, יוצג כברירת מחדל “מכשיר 1/2/3…”.
          </div>
        </div>

        <ha-entity-picker
          label="GPS entity"
          data-field="gps_entity"
        ></ha-entity-picker>

        <ha-textfield
          label="Area attribute"
          value="${this._config.area_attribute || "area_name"}"
          data-field="area_attribute"
        ></ha-textfield>

        <ha-textfield
          label="Icon home"
          value="${this._config.icon_home || "mdi:home-account"}"
          data-field="icon_home"
        ></ha-textfield>

        <ha-textfield
          label="Icon away"
          value="${this._config.icon_away || "mdi:home-off"}"
          data-field="icon_away"
        ></ha-textfield>

        <ha-textfield
          label="Text: away"
          value="${this._config.text?.away || ""}"
          data-field="text.away"
        ></ha-textfield>

        <ha-textfield
          label="Text: same_room"
          value="${this._config.text?.same_room || ""}"
          data-field="text.same_room"
        ></ha-textfield>

        <ha-textfield
          label="Text: both"
          value="${this._config.text?.both || ""}"
          data-field="text.both"
        ></ha-textfield>

        <ha-textfield
          label="Text: single"
          value="${this._config.text?.single || ""}"
          data-field="text.single"
        ></ha-textfield>

        <ha-textfield
          label="Text: item"
          value="${this._config.text?.item || ""}"
          data-field="text.item"
        ></ha-textfield>

        <ha-textfield
          label="Text: separator"
          value="${this._config.text?.separator || ""}"
          data-field="text.separator"
        ></ha-textfield>

        <ha-textfield
          label="Text: list"
          value="${this._config.text?.list || ""}"
          data-field="text.list"
        ></ha-textfield>

      </div>
    `;

    const editorEntries = this._editorEntries;

    this.shadowRoot.querySelectorAll("ha-entity-picker").forEach((picker) => {
      picker.hass = this._hass;
    });

    const gpsPicker = this.shadowRoot.querySelector("[data-field='gps_entity']");
    if (gpsPicker) {
      gpsPicker.hass = this._hass;
      gpsPicker.value = this._config.gps_entity || "";
      gpsPicker.addEventListener("value-changed", (ev) => {
        this._updateConfig("gps_entity", ev.detail.value || "");
      });
    }

    this.shadowRoot.querySelectorAll("ha-textfield").forEach((field) => {
      field.addEventListener("input", (ev) => {
        const target = ev.target;
        const fieldName = target.dataset.field;
        if (!fieldName) return;
        this._updateConfig(fieldName, target.value);
      });
    });

    const entitiesPicker = this.shadowRoot.querySelector("[data-field='room_entities']");
    if (entitiesPicker) {
      entitiesPicker.hass = this._hass;
      entitiesPicker.value = editorEntries.map((entry) => entry.entity);
      entitiesPicker.addEventListener("value-changed", (ev) => {
        const value = ev.detail.value || [];
        this._updateEntityList(value);
      });
    }

    this.shadowRoot.querySelectorAll("[data-field='device-label']").forEach((field) => {
      const entityId = field.dataset.entity;
      field.addEventListener("input", (ev) => {
        const value = ev.target.value || "";
        this._updateDeviceLabel(entityId, value);
      });
    });
  }

  _renderLabelRows() {
    const entries = this._editorEntries;
    return entries
      .filter((entry) => entry.entity)
      .map((entry) => {
        return `
          <div class="device-row">
            <div class="device-entity" title="${entry.entity}">${entry.entity}</div>
            <ha-textfield
              label="Label"
              data-field="device-label"
              data-entity="${entry.entity}"
              value="${entry.label || ""}"
            ></ha-textfield>
          </div>
        `;
      })
      .join("");
  }

  _normalizeEntries(config) {
    const entries = Array.isArray(config.room_entities) ? config.room_entities : [];
    return entries
      .map((item) => {
        if (typeof item === "string") return { entity: item, label: "" };
        if (item && typeof item === "object") {
          return { entity: item.entity || "", label: item.label || "" };
        }
        return null;
      })
      .filter((entry) => Boolean(entry && entry.entity));
  }

  _updateEntityList(entities) {
    const prev = this._editorEntries;
    this._editorEntries = entities.map((entity) => {
      const existing = prev.find((entry) => entry.entity === entity);
      return { entity, label: existing?.label || "" };
    });
    this._commitRoomEntities();
    this._render();
  }

  _updateDeviceLabel(entityId, label) {
    if (!entityId) return;
    const entries = [...this._editorEntries];
    const index = entries.findIndex((entry) => entry.entity === entityId);
    if (index === -1) return;
    entries[index] = { ...entries[index], label };
    this._editorEntries = entries;
    this._commitRoomEntities();
  }

  _commitRoomEntities() {
    const roomEntities = this._editorEntries
      .filter((entry) => entry.entity)
      .map((entry) => {
        const label = (entry.label || "").trim();
        if (label) return { entity: entry.entity, label };
        return entry.entity;
      });
    this._updateConfig("room_entities", roomEntities);
  }

  _updateConfig(path, value) {
    const newConfig = { ...this._config };
    if (path.startsWith("text.")) {
      const key = path.split(".")[1];
      const textConfig = { ...(newConfig.text || {}) };
      if (value === "") {
        delete textConfig[key];
      } else {
        textConfig[key] = value;
      }
      if (Object.keys(textConfig).length === 0) {
        delete newConfig.text;
      } else {
        newConfig.text = textConfig;
      }
    } else {
      const shouldUnset =
        (path === "icon_home" ||
          path === "icon_away" ||
          path === "area_attribute" ||
          path === "gps_entity") &&
        value === "";
      if (shouldUnset) {
        delete newConfig[path];
      } else {
        newConfig[path] = value;
      }
    }
    this._config = newConfig;
    this.dispatchEvent(
      new CustomEvent("config-changed", {
        detail: { config: newConfig },
        bubbles: true,
        composed: true,
      })
    );
  }
}

customElements.define("person-location-card-editor", PersonLocationCardEditor);

PersonRoomCard.getConfigElement = () =>
  document.createElement("person-location-card-editor");

PersonRoomCard.getStubConfig = () => ({
  type: "custom:person-room-card",
  name: "Person",
  room_entities: [],
});
