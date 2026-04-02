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
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 10px;
        font-weight: 700;
        color: var(--primary-text-color);
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
      const label = entry.label || `Device ${index + 1}`;
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
      const state = tracker?.state;
      const isUnavailable =
        !tracker || state === "unknown" || state === "unavailable";
      const isHome = !isUnavailable && state === "home";

      if (isUnavailable) {
        this._elements.statusDot.style.background = "rgba(0,0,0,0.25)";
        this._elements.statusDot.textContent = "?";
        this._elements.statusDot.setAttribute("title", "GPS status unavailable");
      } else {
        this._elements.statusDot.textContent = "";
        this._elements.statusDot.style.background = isHome
          ? "limegreen"
          : "var(--warning-color, orange)";
        this._elements.statusDot.setAttribute(
          "title",
          isHome ? "GPS: at home" : "GPS: away"
        );
      }

      this._elements.statusDot.style.display = "flex";
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
    if (!areaAttribute || areaAttribute === "state") {
      const value = stateObj.state;
      if (!value || value === "unknown" || value === "unavailable") return null;
      return value;
    }

    const attrValue = this._getAttributeValue(stateObj.attributes, areaAttribute);
    if (attrValue !== undefined && attrValue !== null && attrValue !== "") {
      return attrValue;
    }

    if (areaAttribute === "area_name") {
      const value = stateObj.state;
      if (!value || value === "unknown" || value === "unavailable") return null;
      return value;
    }

    return null;
  }

  _getAttributeValue(attributes, path) {
    if (!attributes || !path) return undefined;
    if (!path.includes(".")) return attributes[path];
    return path.split(".").reduce((acc, key) => {
      if (acc && typeof acc === "object") return acc[key];
      return undefined;
    }, attributes);
  }

  _buildLabel({ present, text }) {
    const textAway = text.away || "Away";
    const textSame = text.same_room || "In room — {room}";
    const textBoth = text.both || "{label1}: {room1} | {label2}: {room2}";
    const textSingle = text.single || "In room — {room}";
    const itemTemplate = text.item || "{label}: {room}";
    const separator = text.separator || " | ";
    const listTemplate = text.list || "{items}";

    if (present.length === 0) return textAway;

    const allSameRoom = present.every((entry) => entry.room === present[0].room);
    if (present.length > 1 && allSameRoom) {
      const hasSameRoomCustom = Object.prototype.hasOwnProperty.call(text, "same_room");
      const hasSingleCustom = Object.prototype.hasOwnProperty.call(text, "single");
      const baseTemplate = !hasSameRoomCustom && hasSingleCustom ? textSingle : textSame;
      const sameTemplate = this._normalizeSameRoomTemplate(baseTemplate);
      return this._replaceTokens(sameTemplate, {
        room: present[0].room,
        count: present.length,
      });
    }

    if (present.length === 1) {
      const singleTemplate = this._normalizeSingleTemplate(textSingle);
      return this._replaceTokens(singleTemplate, {
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

  _normalizeSameRoomTemplate(template) {
    if (template.includes("{room}")) return template;
    return `${template} - {room}`;
  }

  _normalizeSingleTemplate(template) {
    if (template.includes("{room}") || template.includes("{label}")) return template;
    return `${template} - {room}`;
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
    this._entriesKey = "";
    this._initialized = false;
    this._hasRendered = false;
    this._keyListenerAttached = false;
  }

  setConfig(config) {
    this._config = config || {};
    this._editorEntries = this._normalizeEntries(this._config);
    const newKey = JSON.stringify(this._editorEntries.map((entry) => entry.entity));

    if (!this._initialized) {
      this._entriesKey = newKey;
      this._initialized = true;
      this._render();
      return;
    }

    if (newKey !== this._entriesKey) {
      this._entriesKey = newKey;
      this._render();
    }
  }

  set hass(hass) {
    this._hass = hass;
    if (!this._hasRendered) {
      this._render();
    }
  }

  _render() {
    if (!this.shadowRoot) return;
    this._hasRendered = true;
    const supportsEntityPicker = Boolean(customElements.get("ha-entity-picker"));

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
          grid-template-columns: auto 1fr 1fr auto;
          gap: 8px;
          align-items: center;
        }
        .device-block {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .device-title {
          font-weight: 600;
          color: var(--primary-text-color);
        }
        .picker-col {
          display: flex;
          flex-direction: column;
          gap: 4px;
          width: auto;
        }
        .picker-meta {
          font-size: 12px;
          color: var(--secondary-text-color);
        }
        .entity-input {
          width: 100%;
          padding: 10px 12px;
          border-radius: 6px;
          border: 1px solid var(--divider-color);
          background: var(--card-background-color);
          color: var(--primary-text-color);
          font-size: 14px;
        }
        .drag-handle {
          border: none;
          background: var(--secondary-background-color);
          color: var(--secondary-text-color);
          font-size: 16px;
          cursor: pointer;
          padding: 6px 8px;
          line-height: 1;
          border-radius: 6px;
          user-select: none;
        }
        .drag-handle:hover {
          color: var(--primary-text-color);
        }
        .device-row.drag-over {
          outline: 2px dashed var(--primary-color);
          outline-offset: 2px;
        }
        .add-device {
          align-self: flex-start;
          background: var(--primary-color);
          color: var(--text-primary-color, #ffffff);
          border: none;
          border-radius: 6px;
          padding: 8px 14px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
        }
        .add-device:hover {
          filter: brightness(1.05);
        }
        .remove-device {
          border: none;
          background: transparent;
          color: var(--secondary-text-color);
          font-size: 18px;
          line-height: 1;
          cursor: pointer;
          padding: 6px;
        }
        .remove-device:hover {
          color: var(--primary-text-color);
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

        <div class="devices">
          ${this._renderDeviceRows(supportsEntityPicker)}
          <button class="add-device" type="button" data-action="add-device">Add device</button>
          <div class="hint">
            You can set a label for each device. If not set, the default is “Device 1/2/3…”.
          </div>
        </div>

        ${
          supportsEntityPicker
            ? `
              <ha-entity-picker
                label="GPS entity (general location)"
                data-field="gps_entity"
              ></ha-entity-picker>
            `
            : `
              <label>
                <div class="hint">GPS entity (general location)</div>
                <input
                  class="entity-input"
                  list="plc-gps-entities"
                  data-field="gps_entity"
                  placeholder="device_tracker.person_phone"
                  value="${this._config.gps_entity || ""}"
                />
              </label>
            `
        }

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
          label="Text: single"
          value="${this._config.text?.single || ""}"
          data-field="text.single"
        ></ha-textfield>

        <ha-textfield
          label="Text: separator"
          value="${this._config.text?.separator || ""}"
          data-field="text.separator"
        ></ha-textfield>

        ${
          supportsEntityPicker
            ? ""
            : `
              <datalist id="plc-room-entities">
                ${this._buildEntityDatalistOptions(["sensor", "device_tracker"])}
              </datalist>
              <datalist id="plc-gps-entities">
                ${this._buildEntityDatalistOptions(["device_tracker"])}
              </datalist>
            `
        }
      </div>
    `;

    this.shadowRoot.querySelectorAll("ha-entity-picker").forEach((picker) => {
      picker.hass = this._hass;
    });

    this.shadowRoot.querySelectorAll("ha-textfield").forEach((field) => {
      const onCommit = (ev) => {
        const target = ev.target;
        const fieldName = target.dataset.field;
        if (!fieldName) return;
        if (fieldName === "device-label") {
          const idx = Number(target.dataset.index);
          this._updateDeviceEntry(idx, { label: target.value || "" });
          return;
        }
        this._updateConfig(fieldName, target.value);
      };
      field.addEventListener("blur", onCommit, true);
    });

    const gpsPicker = this.shadowRoot.querySelector("[data-field='gps_entity']");
    if (gpsPicker) {
      if (gpsPicker.tagName === "HA-ENTITY-PICKER") {
        gpsPicker.hass = this._hass;
        gpsPicker.value = this._config.gps_entity || "";
        gpsPicker.includeDomains = ["device_tracker"];
        gpsPicker.addEventListener("value-changed", (ev) => {
          this._updateConfig("gps_entity", ev.detail.value || "");
        });
      } else {
        gpsPicker.value = this._config.gps_entity || "";
        const onCommit = (ev) => {
          this._updateConfig("gps_entity", ev.target.value || "");
        };
        gpsPicker.addEventListener("change", onCommit);
        gpsPicker.addEventListener("keydown", (ev) => {
          if (ev.key !== "Enter") return;
          onCommit(ev);
        });
      }
    }

    this.shadowRoot.querySelectorAll("[data-action='add-device']").forEach((btn) => {
      btn.addEventListener("click", () => this._addDeviceRow());
    });

    this.shadowRoot.querySelectorAll("[data-action='remove-device']").forEach((btn) => {
      btn.addEventListener("click", (ev) => {
        const index = Number(ev.currentTarget.dataset.index);
        this._removeDeviceRow(index);
      });
    });

    this.shadowRoot.querySelectorAll(".device-row").forEach((row) => {
      row.addEventListener("dragover", (ev) => {
        ev.preventDefault();
        row.classList.add("drag-over");
      });
      row.addEventListener("dragleave", () => {
        row.classList.remove("drag-over");
      });
      row.addEventListener("drop", (ev) => {
        ev.preventDefault();
        row.classList.remove("drag-over");
        const fromIndex = Number(ev.dataTransfer?.getData("text/plain"));
        const toIndex = Number(row.dataset.index);
        if (Number.isNaN(fromIndex) || Number.isNaN(toIndex)) return;
        this._reorderDevices(fromIndex, toIndex);
      });
    });

    this.shadowRoot.querySelectorAll("[data-action='drag-handle']").forEach((handle) => {
      handle.addEventListener("dragstart", (ev) => {
        const index = Number(ev.currentTarget.dataset.index);
        ev.dataTransfer?.setData("text/plain", String(index));
        ev.dataTransfer?.setDragImage(ev.currentTarget, 0, 0);
      });
    });

    this.shadowRoot.querySelectorAll("[data-field='device-entity']").forEach((picker) => {
      const index = Number(picker.dataset.index);
      const value = this._editorEntries[index]?.entity || "";
      if (picker.tagName === "HA-ENTITY-PICKER") {
        picker.hass = this._hass;
        picker.value = value;
        picker.includeDomains = ["sensor", "device_tracker"];
        picker.addEventListener("value-changed", (ev) => {
          const idx = Number(ev.currentTarget.dataset.index);
          const newValue = ev.detail.value || "";
          this._updateDeviceEntry(idx, { entity: newValue });
        });
      } else {
        picker.value = value;
        const onCommit = (ev) => {
          const idx = Number(ev.currentTarget.dataset.index);
          const newValue = ev.target.value || "";
          this._updateDeviceEntry(idx, { entity: newValue });
        };
        picker.addEventListener("change", onCommit);
        picker.addEventListener("keydown", (ev) => {
          if (ev.key !== "Enter") return;
          onCommit(ev);
        });
      }
    });

    this.shadowRoot.querySelectorAll("[data-field='device-label']").forEach((field) => {
      const index = Number(field.dataset.index);
      field.value = this._editorEntries[index]?.label || "";
    });

    if (!this._keyListenerAttached) {
      this._keyListenerAttached = true;
      this.shadowRoot.addEventListener(
        "keydown",
        (ev) => {
          if (ev.key !== "Enter") return;
          const fieldEl = ev.composedPath().find((node) => node?.dataset?.field);
          if (!fieldEl) return;
          this._commitField(fieldEl);
        },
        true
      );
    }
  }

  _renderDeviceRows(supportsEntityPicker) {
    const entries = this._editorEntries.length > 0 ? this._editorEntries : [{ entity: "", label: "" }];
    return entries
      .map((entry, index) => {
        const entityId = entry.entity;
        const friendlyName = entityId ? this._getFriendlyName(entityId) : "Select entity";
        return `
          <div class="device-block">
            <div class="device-title">Device ${index + 1}</div>
            <div class="device-row" data-index="${index}">
              <button
                class="remove-device"
                type="button"
                data-action="remove-device"
                data-index="${index}"
                title="Remove"
                aria-label="Remove"
              >×</button>
              ${
                supportsEntityPicker
                  ? `
                    <div class="picker-col">
                      <ha-entity-picker
                        label="Room entity"
                        data-field="device-entity"
                        data-index="${index}"
                      ></ha-entity-picker>
                      <div class="picker-meta">${this._escapeHtml(entityId ? `${friendlyName} (${entityId})` : "Select entity")}</div>
                    </div>
                  `
                  : `
                    <div class="picker-col">
                      <input
                        class="entity-input"
                        list="plc-room-entities"
                        data-field="device-entity"
                        data-index="${index}"
                        placeholder="sensor.example_room"
                        value="${this._escapeHtml(entityId || "")}"
                      />
                      <div class="picker-meta">${this._escapeHtml(entityId ? `${friendlyName} (${entityId})` : "Select entity")}</div>
                    </div>
                  `
              }
              <ha-textfield
                label="Label"
                data-field="device-label"
                data-index="${index}"
                value="${entry.label || ""}"
              ></ha-textfield>
              <button
                class="drag-handle"
                type="button"
                data-action="drag-handle"
                data-index="${index}"
                draggable="true"
                title="Drag to reorder"
                aria-label="Drag to reorder"
              >≡</button>
            </div>
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

  _addDeviceRow() {
    this._editorEntries = [...this._editorEntries, { entity: "", label: "" }];
    this._render();
  }

  _removeDeviceRow(index) {
    this._editorEntries = this._editorEntries.filter((_, i) => i !== index);
    if (this._editorEntries.length === 0) {
      this._editorEntries = [{ entity: "", label: "" }];
    }
    this._commitRoomEntities();
    this._render();
  }

  _reorderDevices(fromIndex, toIndex) {
    if (fromIndex === toIndex) return;
    const entries = [...this._editorEntries];
    if (fromIndex < 0 || toIndex < 0) return;
    if (fromIndex >= entries.length || toIndex >= entries.length) return;
    const [moved] = entries.splice(fromIndex, 1);
    entries.splice(toIndex, 0, moved);
    this._editorEntries = entries;
    this._commitRoomEntities();
    this._render();
  }

  _updateDeviceEntry(index, patch) {
    const entries = this._editorEntries.length > 0 ? [...this._editorEntries] : [{ entity: "", label: "" }];
    const current = entries[index] || { entity: "", label: "" };
    entries[index] = { ...current, ...patch };
    this._editorEntries = entries;
    this._commitRoomEntities();
  }

  _commitField(fieldEl) {
    const fieldName = fieldEl.dataset.field;
    if (!fieldName) return;
    if (fieldName === "device-label") {
      const idx = Number(fieldEl.dataset.index);
      this._updateDeviceEntry(idx, { label: fieldEl.value || "" });
      return;
    }
    if (fieldName === "device-entity") {
      const idx = Number(fieldEl.dataset.index);
      this._updateDeviceEntry(idx, { entity: fieldEl.value || "" });
      return;
    }
    if (fieldName === "gps_entity") {
      this._updateConfig("gps_entity", fieldEl.value || "");
      return;
    }
    this._updateConfig(fieldName, fieldEl.value);
  }

  _getFriendlyName(entityId) {
    const stateObj = this._hass?.states?.[entityId];
    return stateObj?.attributes?.friendly_name || entityId;
  }

  _buildEntityDatalistOptions(domains) {
    return this._getEntitiesByDomains(domains)
      .map((entityId) => {
        const name = this._getFriendlyName(entityId);
        const label = `${name} (${entityId})`;
        return `<option value="${this._escapeHtml(entityId)}">${this._escapeHtml(label)}</option>`;
      })
      .join("");
  }

  _getEntitiesByDomains(domains) {
    if (!this._hass || !this._hass.states) return [];
    const entities = Object.keys(this._hass.states).filter((entityId) =>
      domains.includes(entityId.split(".")[0])
    );
    return entities.sort((a, b) => {
      const aIsArea = this._isAreaEntity(a);
      const bIsArea = this._isAreaEntity(b);
      if (aIsArea !== bIsArea) return aIsArea ? -1 : 1;
      return a.localeCompare(b);
    });
  }

  _isAreaEntity(entityId) {
    const name = this._getFriendlyName(entityId) || "";
    return (
      entityId.toLowerCase().includes("area") ||
      name.toLowerCase().includes("area")
    );
  }

  _escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
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
